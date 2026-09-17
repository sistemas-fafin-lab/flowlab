-- ═══════════════════════════════════════════════════════════════════════════════
-- RH — Colaboradores (fundação do módulo)
-- Migration: 20260914150000_rh_colaboradores.sql
--
-- Ver .scratch/rh-colaboradores/spec.md para o desenho completo e as decisões já
-- tomadas. Cria a entidade `colaboradores` (própria, não um alargamento de
-- `user_profiles` — ver spec) e faz o backfill automático 1:1 a partir de todo
-- `user_profile` existente, já que foi confirmado com o usuário que todo
-- user_profile é funcionário atual ou ex-funcionário do laboratório.
--
-- Departamento/cargo ficam texto livre no v1 (reaproveita user_profiles.department).
-- data_admissao, cargo, matricula e gestor_id nascem NULL — não existe dado
-- confiável para popular nenhum deles hoje.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. VALIDAÇÃO DE CPF (dígito verificador, módulo 11 — CLT/Portaria MTP 671/2021)
--
-- Usada pelo backfill abaixo para decidir quem vira colaborador automaticamente.
-- CPFs com todos os dígitos iguais (000.000.000-00, 111.111.111-11, ...) passam
-- no cálculo do dígito verificador mas nunca são CPF real — excluídos à parte.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cpf_valido(p_cpf text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_cpf   text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  v_soma  integer;
  v_resto integer;
  v_dig1  integer;
  v_dig2  integer;
  i       integer;
BEGIN
  IF length(v_cpf) <> 11 THEN
    RETURN false;
  END IF;

  IF v_cpf = repeat(substr(v_cpf, 1, 1), 11) THEN
    RETURN false;
  END IF;

  v_soma := 0;
  FOR i IN 1..9 LOOP
    v_soma := v_soma + substr(v_cpf, i, 1)::integer * (11 - i);
  END LOOP;
  v_resto := v_soma % 11;
  v_dig1  := CASE WHEN v_resto < 2 THEN 0 ELSE 11 - v_resto END;
  IF v_dig1 <> substr(v_cpf, 10, 1)::integer THEN
    RETURN false;
  END IF;

  v_soma := 0;
  FOR i IN 1..10 LOOP
    v_soma := v_soma + substr(v_cpf, i, 1)::integer * (12 - i);
  END LOOP;
  v_resto := v_soma % 11;
  v_dig2  := CASE WHEN v_resto < 2 THEN 0 ELSE 11 - v_resto END;
  IF v_dig2 <> substr(v_cpf, 11, 1)::integer THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.cpf_valido(text) IS 'Valida CPF pelo dígito verificador (módulo 11). Aceita com ou sem máscara. Rejeita CPF com todos os dígitos iguais.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. TABELA
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.colaboradores (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id  uuid REFERENCES public.user_profiles(id),

  nome             text NOT NULL,
  email            text,
  cpf              text NOT NULL,

  departamento     text,
  cargo            text,

  data_admissao     date,
  data_desligamento date,
  status            text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'desligado')),

  gestor_id        uuid REFERENCES public.colaboradores(id),

  matricula        text,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT colaboradores_cpf_key UNIQUE (cpf)
);

COMMENT ON TABLE public.colaboradores IS 'Colaboradores (funcionários e ex-funcionários) do laboratório. Entidade própria, distinta de user_profiles (ver spec em .scratch/rh-colaboradores/spec.md) — user_profile_id é o vínculo opcional com uma conta de login.';
COMMENT ON COLUMN public.colaboradores.user_profile_id IS 'Conta de usuário do sistema vinculada, quando existir. 1:1 — ver índice único parcial abaixo.';
COMMENT ON COLUMN public.colaboradores.status IS 'ativo/desligado. No backfill, derivado de user_profiles.deleted_at/disabled_at.';

CREATE UNIQUE INDEX IF NOT EXISTS colaboradores_user_profile_id_uidx
  ON public.colaboradores(user_profile_id) WHERE user_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS colaboradores_status_idx ON public.colaboradores(status);
CREATE INDEX IF NOT EXISTS colaboradores_gestor_id_idx ON public.colaboradores(gestor_id);

CREATE OR REPLACE FUNCTION public.colaboradores_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_colaboradores_updated_at ON public.colaboradores;
CREATE TRIGGER trigger_colaboradores_updated_at
  BEFORE UPDATE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.colaboradores_set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. RLS — leitura sob canViewColaboradores (padrão do projeto). Escrita fica
-- para o ticket de edição de cadastro (canManageColaboradores), fora do escopo
-- desta leva — sem policy de INSERT/UPDATE/DELETE, authenticated não escreve.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS colaboradores_select ON public.colaboradores;
CREATE POLICY colaboradores_select ON public.colaboradores
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewColaboradores'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. RESOLUÇÃO nome/email/cpf/departamento — user_profiles vs. deleted_snapshot
--
-- soft_delete_user() (20260721120000) NÃO zera nome/e-mail do jeito que zera
-- cpf/department: ele os SOBRESCREVE com um valor sentinela não-vazio
-- ('Usuário Removido' / 'deleted_<uuid>@deleted.flowlab.local') — só
-- cpf/department viram NULL de verdade. Um simples
-- `coalesce(nullif(x, ''), snapshot->>'x')` (a fórmula do spec.md) nunca cai
-- no snapshot para nome/e-mail porque a coluna de topo nunca está vazia —
-- todo ex-funcionário apareceria como "Usuário Removido" na tela de RH,
-- exatamente o que o backfill existe para evitar (achado de code review).
-- Por isso nome/e-mail são resolvidos por deleted_at (prioriza snapshot
-- quando removido), enquanto cpf/department seguem a fórmula do spec
-- (a coluna de topo já é NULL de verdade nesse caso).
--
-- Função (não repetida inline): usada tanto pelo backfill (PARTE 5) quanto
-- pelo relatório de pendências (PARTE 6), para as duas nunca divergirem.
-- Fallback final de nome (e-mail, depois texto fixo) é rede de segurança
-- contra um user_profiles.name = '' sem snapshot — não deveria existir hoje,
-- mas evitaria abortar a migration inteira (NOT NULL de colaboradores.nome)
-- por causa de uma única linha ruim.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rh_resolver_dados_colaborador(up public.user_profiles)
RETURNS TABLE (nome text, email text, cpf text, departamento text)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    COALESCE(
      CASE WHEN up.deleted_at IS NOT NULL THEN up.deleted_snapshot ->> 'name' END,
      NULLIF(up.name, ''),
      NULLIF(up.email, ''),
      'Colaborador sem nome cadastrado'
    ) AS nome,
    CASE WHEN up.deleted_at IS NOT NULL
           THEN COALESCE(up.deleted_snapshot ->> 'profile_email', up.deleted_snapshot ->> 'email', up.email)
         ELSE up.email
    END AS email,
    COALESCE(NULLIF(up.cpf, ''), up.deleted_snapshot ->> 'cpf') AS cpf,
    COALESCE(up.department, up.deleted_snapshot ->> 'department') AS departamento;
$$;

COMMENT ON FUNCTION public.rh_resolver_dados_colaborador(public.user_profiles) IS 'Resolve nome/email/cpf/departamento de um user_profile para o backfill de colaboradores, priorizando deleted_snapshot para nome/email quando deleted_at está preenchido (soft_delete_user não zera essas duas colunas, só as anonimiza com um sentinela).';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. SYNC — cria/atualiza o colaborador correspondente a um user_profile
--
-- Função compartilhada entre o trigger (PARTE 5a, mantém colaboradores em
-- sync daqui pra frente) e o backfill (PARTE 5b, aplica a mesma regra aos
-- user_profiles já existentes). status = 'desligado' quando deleted_at OU
-- disabled_at estiver preenchido (ambas as formas de saída de acesso viram
-- "desligado" na granularidade ativo/desligado deste v1).
--
-- Nunca troca um vínculo já ativo por outro — só resolve o caso de
-- readmissão (perfil ativo assume o vínculo de um colaborador hoje desligado
-- com o mesmo CPF; colisão entre dois perfis ATIVOS com o mesmo CPF é
-- duplicidade de verdade, fica visível na PARTE 6 para curadoria manual em
-- vez de a migration decidir sozinha por ordem arbitrária de scan).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rh_sync_colaborador(up public.user_profiles)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r           record;
  v_status    text;
  v_existente record;
BEGIN
  SELECT * INTO r FROM public.rh_resolver_dados_colaborador(up);

  IF r.cpf IS NULL OR NOT public.cpf_valido(r.cpf) THEN
    RETURN; -- fica pendente (PARTE 6), tratamento manual
  END IF;

  v_status := CASE WHEN up.deleted_at IS NOT NULL OR up.disabled_at IS NOT NULL THEN 'desligado' ELSE 'ativo' END;

  SELECT * INTO v_existente FROM public.colaboradores WHERE cpf = r.cpf;

  IF NOT FOUND THEN
    INSERT INTO public.colaboradores (nome, email, cpf, departamento, status, user_profile_id)
    VALUES (r.nome, r.email, r.cpf, r.departamento, v_status, up.id)
    ON CONFLICT (cpf) DO NOTHING;
    RETURN;
  END IF;

  IF v_existente.user_profile_id = up.id THEN
    UPDATE public.colaboradores
       SET nome = r.nome, email = r.email, departamento = r.departamento, status = v_status
     WHERE id = v_existente.id;
    RETURN;
  END IF;

  IF v_status = 'ativo' AND v_existente.status = 'desligado' THEN
    UPDATE public.colaboradores
       SET user_profile_id = up.id, nome = r.nome, email = r.email,
           departamento = r.departamento, status = v_status
     WHERE id = v_existente.id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.rh_sync_colaborador(public.user_profiles) IS 'Cria ou atualiza o colaborador correspondente a um user_profile (CPF válido). Compartilhada pelo trigger de sync (PARTE 5a) e pelo backfill (PARTE 5b) — nunca troca um vínculo já ativo por outro, só resolve readmissão (ativo assume vínculo de um desligado com mesmo CPF).';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5a. TRIGGER — mantém colaboradores em sync para todo user_profile criado
-- daqui pra frente. Sem isso, todo hire futuro (CPF válido, sem duplicidade
-- nenhuma) cairia na PARTE 6 rotulado como 'cpf_duplicado' só por falta de
-- colaborador — não por duplicidade real (achado de code review).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rh_colaboradores_sync_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.rh_sync_colaborador(NEW);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_user_profiles_sync_colaborador ON public.user_profiles;
CREATE TRIGGER trigger_user_profiles_sync_colaborador
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.rh_colaboradores_sync_trigger();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5b. BACKFILL — aplica o sync a todo user_profile já existente
--
-- Ordem determinística (ativo antes de desligado, mais recente antes de mais
-- antigo) em vez de ordem arbitrária de scan: garante que, numa colisão de
-- CPF entre um desligado e um recontratado, é o perfil ativo que fica com o
-- vínculo (via a regra de readmissão da PARTE 5), não quem o Postgres
-- processou primeiro por acaso (achado de code review).
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  rec public.user_profiles%ROWTYPE;
BEGIN
  FOR rec IN
    SELECT * FROM public.user_profiles
    ORDER BY (deleted_at IS NULL AND disabled_at IS NULL) DESC, created_at DESC
  LOOP
    PERFORM public.rh_sync_colaborador(rec);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. RELATÓRIO — user_profiles sem colaborador correspondente
--
-- Baseado em "não existe colaborador para este user_profile" (não em
-- recalcular a validação de CPF) de propósito: cobre tanto CPF nulo/inválido
-- quanto o caso de dois user_profiles ATIVOS resolverem para o MESMO CPF
-- válido — rh_sync_colaborador (PARTE 5) nunca troca um vínculo já ativo por
-- outro, então o perdedor dessa colisão real fica sem colaborador, e é aqui
-- que a curadoria manual encontra o rastro (achado de code review). Por ser
-- uma view (não uma foto do momento do backfill/sync), continua correta
-- conforme colaboradores for editado nos tickets seguintes (vínculo manual,
-- etc.) e conforme o trigger da PARTE 5a for processando novos hires.
--
-- Gate por canViewColaboradores no WHERE: é o mesmo dado sensível (nome/
-- email/cpf) protegido por RLS em colaboradores (PARTE 3) — sem o filtro,
-- qualquer authenticated (não só quem tem a permission do módulo de RH)
-- conseguiria ler nome/cpf/email de todo mundo pendente, inclusive de
-- ex-funcionários recuperados de deleted_snapshot (achado de code review).
-- security_invoker = true: respeita o RLS de user_profiles por trás
-- (mesmo padrão de public.active_user_profiles, 20260721120000).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.user_profiles_cpf_pendente
WITH (security_invoker = true) AS
SELECT
  up.id,
  r.nome,
  r.email,
  r.cpf,
  CASE
    WHEN r.cpf IS NULL THEN 'cpf_nulo'
    WHEN NOT public.cpf_valido(r.cpf) THEN 'cpf_invalido'
    ELSE 'cpf_duplicado'
  END AS motivo,
  up.deleted_at IS NOT NULL AS removido
FROM public.user_profiles up
CROSS JOIN LATERAL public.rh_resolver_dados_colaborador(up) AS r
WHERE public.current_user_has_permission('canViewColaboradores')
  AND NOT EXISTS (
    SELECT 1 FROM public.colaboradores c WHERE c.user_profile_id = up.id
  );

COMMENT ON VIEW public.user_profiles_cpf_pendente IS 'user_profiles sem colaborador correspondente (CPF nulo, inválido, ou duplicado com outro user_profile já backfilled) — tratamento manual (ver spec em .scratch/rh-colaboradores/spec.md). Leitura restrita a canViewColaboradores.';

REVOKE ALL ON public.user_profiles_cpf_pendente FROM PUBLIC, anon;
GRANT SELECT ON public.user_profiles_cpf_pendente TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. MENU — adiciona "RH" em module_categories (aditivo, mesmo padrão de
-- Qualidade em 20260820120000).
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE module_categories
SET items = items || '["RH"]'::jsonb
WHERE id = 'administracao'
  AND NOT (items @> '["RH"]'::jsonb);
