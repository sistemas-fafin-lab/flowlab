-- ═══════════════════════════════════════════════════════════════════════════════
-- Gastos de TI — categorias expansíveis + auditoria do módulo
-- Migration: 20261009120000_gastos_ti_categorias.sql
-- (.scratch/gastos-ti/issues/02-categorias.md)
--
-- Plano completo e decisões em docs/plans/gastos-ti/PLANO_GASTOS_TI.md (§4.1,
-- §4.2, D5). Esta é a primeira migration do módulo e cria também a
-- infraestrutura que as próximas reaproveitam:
--   - ti_auditoria + ti_auditoria_trigger(): trilha genérica (antes/depois em
--     jsonb) ligada a cada tabela do módulo por um trigger próprio.
--
-- Categorias são EXPANSÍVEIS (D5): as 8 linhas abaixo são só a carga inicial.
-- A ordem define a cor nos gráficos (as 8 primeiras têm cor própria, da 9ª em
-- diante viram "Outros") — a resolução da cor fica no frontend
-- (domain/coresCategorias.ts), não aqui.
--
-- Nenhuma chave é gravada em custom_roles (D14): o usuário atribui
-- canViewGastosTI/canManageGastosTI manualmente. Até lá só admin enxerga.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
END $$;

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. AUDITORIA DO MÓDULO
--
-- Mesmo desenho de qa_auditoria (tabela/registro/ação/antes/depois/autor),
-- mas com tabela própria: as permissões de leitura são as do módulo, não as de
-- Qualidade. autor é NULL quando a mudança vem sem sessão (SQL Editor,
-- migration) — essas mudanças também ficam registradas, diferente de
-- qa_riscos_modulo_auditoria_trigger, que as ignora.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ti_auditoria (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tabela       text NOT NULL,
  registro_id  uuid NOT NULL,
  acao         text NOT NULL
    CONSTRAINT ti_auditoria_acao_check CHECK (acao IN ('insert', 'update', 'delete')),
  antes        jsonb,
  depois       jsonb,
  autor_id     uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ti_auditoria IS 'Trilha de auditoria do módulo Gastos de TI: toda inclusão, alteração ou exclusão nas tabelas ti_* (antes/depois em jsonb). Escrita só pelo trigger ti_auditoria_trigger().';
COMMENT ON COLUMN public.ti_auditoria.autor_id IS 'auth.uid() de quem fez a mudança. NULL quando veio sem sessão (SQL Editor, migration).';

CREATE INDEX IF NOT EXISTS ti_auditoria_registro_idx ON public.ti_auditoria(tabela, registro_id);
CREATE INDEX IF NOT EXISTS ti_auditoria_created_at_idx ON public.ti_auditoria(created_at);

-- SECURITY DEFINER: o INSERT em ti_auditoria roda como dono da tabela, então
-- não precisa (e não deve) existir policy de INSERT para authenticated — só o
-- trigger escreve aqui.
CREATE OR REPLACE FUNCTION public.ti_auditoria_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- UPDATE que não mudou nada além dos carimbos (salvar sem editar) não gera
  -- ruído — updated_at/updated_by mudam sempre, pelos triggers BEFORE UPDATE.
  IF TG_OP = 'UPDATE'
     AND (to_jsonb(OLD) - 'updated_at' - 'updated_by') = (to_jsonb(NEW) - 'updated_at' - 'updated_by') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.ti_auditoria (tabela, registro_id, acao, antes, depois, autor_id)
  VALUES (
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    lower(TG_OP),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.ti_auditoria_trigger() IS 'Trigger genérico de auditoria das tabelas ti_* (por TG_TABLE_NAME/TG_OP). Cada tabela do módulo liga o seu próprio trigger AFTER INSERT OR UPDATE OR DELETE a esta função.';

ALTER TABLE public.ti_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ti_auditoria_select ON public.ti_auditoria;
CREATE POLICY ti_auditoria_select ON public.ti_auditoria
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewGastosTI')
    OR public.current_user_has_permission('canManageGastosTI')
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. CATEGORIAS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ti_categorias (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             text NOT NULL
    CONSTRAINT ti_categorias_nome_check CHECK (nome = btrim(nome) AND length(nome) > 0),
  descricao        text,
  natureza_padrao  text NOT NULL DEFAULT 'opex'
    CONSTRAINT ti_categorias_natureza_padrao_check CHECK (natureza_padrao IN ('opex', 'capex')),
  ordem            integer NOT NULL,
  ativo            boolean NOT NULL DEFAULT true,
  created_by       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ti_categorias IS 'Categorias de gasto de TI. Expansíveis: quem tem canManageGastosTI cria novas a qualquer momento. Sem DELETE — desativar (ativo = false) mantém o histórico e os gráficos.';
COMMENT ON COLUMN public.ti_categorias.descricao IS 'O que entra na categoria — aparece como dica no formulário da despesa.';
COMMENT ON COLUMN public.ti_categorias.natureza_padrao IS 'Natureza sugerida (opex/capex) ao cadastrar uma despesa nesta categoria.';
COMMENT ON COLUMN public.ti_categorias.ordem IS 'Posição na lista. Define a cor nos gráficos: as 8 primeiras têm cor própria, da 9ª em diante entram em "Outros". Sem UNIQUE de propósito (ti_reordenar_categorias reescreve todas numa só instrução); empate desempata pelo nome no frontend.';
COMMENT ON COLUMN public.ti_categorias.created_by IS 'NULL nas categorias da carga inicial (criadas pela migration, sem sessão).';

-- Nome único sem diferenciar maiúsculas: evita "IA" e "ia" como duas categorias.
CREATE UNIQUE INDEX IF NOT EXISTS ti_categorias_nome_uidx ON public.ti_categorias (lower(nome));
CREATE INDEX IF NOT EXISTS ti_categorias_ordem_idx ON public.ti_categorias (ordem);

CREATE OR REPLACE FUNCTION public.ti_categorias_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ti_categorias_updated_at ON public.ti_categorias;
CREATE TRIGGER trigger_ti_categorias_updated_at
  BEFORE UPDATE ON public.ti_categorias
  FOR EACH ROW EXECUTE FUNCTION public.ti_categorias_set_updated_at();

ALTER TABLE public.ti_categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ti_categorias_select ON public.ti_categorias;
CREATE POLICY ti_categorias_select ON public.ti_categorias
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewGastosTI')
    OR public.current_user_has_permission('canManageGastosTI')
  );

DROP POLICY IF EXISTS ti_categorias_insert ON public.ti_categorias;
CREATE POLICY ti_categorias_insert ON public.ti_categorias
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageGastosTI'));

DROP POLICY IF EXISTS ti_categorias_update ON public.ti_categorias;
CREATE POLICY ti_categorias_update ON public.ti_categorias
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageGastosTI'))
  WITH CHECK (public.current_user_has_permission('canManageGastosTI'));

-- Sem policy de DELETE de propósito: categoria é desativada, nunca apagada.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. CARGA INICIAL — 8 categorias, Inteligência Artificial em 1º (D5)
--
-- Antes do trigger de auditoria (seção 4): a carga da migration não é uma
-- decisão de usuário e não precisa de 8 linhas de "insert" na trilha.
-- Idempotente por nome (sem diferenciar maiúsculas).
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.ti_categorias (nome, descricao, natureza_padrao, ordem)
SELECT v.nome, v.descricao, v.natureza_padrao, v.ordem
FROM (VALUES
  ('Inteligência Artificial', 'Assinaturas e APIs de IA: ChatGPT, Claude, Copilot, Gemini, consumo por token, plataformas de IA. Ferramenta de IA vai aqui mesmo sendo assinatura SaaS.', 'opex', 1),
  ('SaaS e Assinaturas', 'Software por assinatura que não é IA: M365, Google Workspace, ERP, antivírus.', 'opex', 2),
  ('Cloud e Hospedagem', 'AWS, Azure, GCP, VPS, domínios, hospedagem, e-mail transacional.', 'opex', 3),
  ('Licenças de Software', 'Licença perpétua ou de longo prazo comprada de uma vez.', 'capex', 4),
  ('Hardware e Equipamentos', 'Computadores, servidores, periféricos, rede, peças.', 'capex', 5),
  ('Telecom e Conectividade', 'Links de internet, telefonia, chips, VPN.', 'opex', 6),
  ('Serviços e Suporte', 'Consultoria, desenvolvimento terceirizado, manutenção, suporte técnico.', 'opex', 7),
  ('Diversos', 'O que não se encaixa nas demais.', 'opex', 8)
) AS v(nome, descricao, natureza_padrao, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ti_categorias c WHERE lower(c.nome) = lower(v.nome)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. AUDITORIA DE CATEGORIAS
-- ═══════════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_ti_categorias_auditoria ON public.ti_categorias;
CREATE TRIGGER trg_ti_categorias_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON public.ti_categorias
  FOR EACH ROW EXECUTE FUNCTION public.ti_auditoria_trigger();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. REORDENAR — grava a ordem inteira numa só instrução
--
-- A tela manda a lista completa de ids na ordem nova; trocar posição com dois
-- UPDATEs soltos deixaria a ordem pela metade se o segundo falhasse.
-- SECURITY INVOKER: a policy de UPDATE continua valendo; o teste explícito só
-- troca o "0 linhas atualizadas" silencioso por um erro claro.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ti_reordenar_categorias(p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_has_permission('canManageGastosTI') THEN
    RAISE EXCEPTION 'Sem permissão para reordenar categorias de Gastos de TI.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.ti_categorias c
     SET ordem = x.posicao
    FROM unnest(p_ids) WITH ORDINALITY AS x(id, posicao)
   WHERE c.id = x.id
     AND c.ordem IS DISTINCT FROM x.posicao;
END;
$$;

COMMENT ON FUNCTION public.ti_reordenar_categorias(uuid[]) IS 'Define ti_categorias.ordem = posição (1..n) de cada id no array, numa só instrução. Exige canManageGastosTI.';

REVOKE ALL ON FUNCTION public.ti_reordenar_categorias(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ti_reordenar_categorias(uuid[]) TO authenticated;

COMMIT;
