-- ═══════════════════════════════════════════════════════════════════════════════
-- RH — Departamentos (aprovador de SC e responsáveis)
-- Migration: 20261020215000_rh_departamentos.sql
-- (.scratch/solicitacoes-aprovacao-gestor/issues/06-departamentos-no-rh.md)
--
-- Tem de rodar antes de 20261020220000_sc_aprovador_pelo_departamento.sql, que
-- lê departamentos.aprovador_sc_id e colaboradores.departamento_id.
--
-- O RH passa a cadastrar departamentos (planos, sem hierarquia):
--   • departamentos: nome (único, sem diferenciar maiúsculas), ativo e
--     aprovador_sc_id (colaborador que aprova as SCs de quem está nele; pode
--     ser de outro departamento).
--   • colaboradores.departamento_id: um departamento por pessoa, nullable (o
--     colaborador nasce de um user_profile sem departamento conhecido; "sem
--     departamento" vira pendência na aba).
--   • departamento_responsaveis: N:N, independente de onde a pessoa está.
--
-- Permissão nova canManageDepartamentos (cargo RH e Administrador): escreve em
-- departamentos e departamento_responsaveis e define
-- colaboradores.departamento_id. Leitura de departamentos e responsáveis é
-- aberta a qualquer autenticado.
--
-- Holerites da equipe: colaborador_e_subordinado_do_usuario_atual passa a ler
-- departamento_responsaveis em vez de gestor_id (as três policies ficam).
--
-- A carga inicial (departamentos a partir do texto de colaboradores.departamento)
-- fica numa migration à parte, depois do mapeamento aprovado. gestor_id e o
-- texto do departamento só saem depois de conferida a carga.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. TABELAS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.departamentos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             text NOT NULL CHECK (btrim(nome) <> ''),
  ativo            boolean NOT NULL DEFAULT true,
  aprovador_sc_id  uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.departamentos IS 'Departamentos do laboratório, cadastrados pelo RH. Planos (sem departamento pai). Não há exclusão: desativa-se.';
COMMENT ON COLUMN public.departamentos.aprovador_sc_id IS 'Colaborador que aprova as Solicitações de Compra de quem está no departamento (requests_resolver_aprovador). Pode ser de outro departamento.';

CREATE UNIQUE INDEX IF NOT EXISTS departamentos_nome_uidx
  ON public.departamentos (lower(btrim(nome)));

DROP TRIGGER IF EXISTS trigger_departamentos_updated_at ON public.departamentos;
CREATE TRIGGER trigger_departamentos_updated_at
  BEFORE UPDATE ON public.departamentos
  FOR EACH ROW EXECUTE FUNCTION public.colaboradores_set_updated_at();

ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS departamento_id uuid REFERENCES public.departamentos(id);

COMMENT ON COLUMN public.colaboradores.departamento_id IS 'Departamento do colaborador (um por pessoa). NULL = sem departamento, pendência na aba Departamentos do RH.';

CREATE INDEX IF NOT EXISTS colaboradores_departamento_id_idx ON public.colaboradores(departamento_id);

CREATE TABLE IF NOT EXISTS public.departamento_responsaveis (
  departamento_id  uuid NOT NULL REFERENCES public.departamentos(id) ON DELETE CASCADE,
  colaborador_id   uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (departamento_id, colaborador_id)
);

COMMENT ON TABLE public.departamento_responsaveis IS 'Quem responde por cada departamento (N:N, independente do departamento da pessoa). Com canViewHoleritesEquipe, vê os holerites de quem está nele.';

CREATE INDEX IF NOT EXISTS departamento_responsaveis_colaborador_idx
  ON public.departamento_responsaveis(colaborador_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. REGRAS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Desativar é bloqueado enquanto houver colaborador ativo no departamento.
CREATE OR REPLACE FUNCTION public.departamentos_validar_desativacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ativos integer;
BEGIN
  IF OLD.ativo AND NOT NEW.ativo THEN
    SELECT count(*) INTO v_ativos
      FROM public.colaboradores
     WHERE departamento_id = NEW.id AND status = 'ativo';
    IF v_ativos > 0 THEN
      RAISE EXCEPTION 'Não é possível desativar o departamento: % colaborador(es) ativo(s) ainda está(ão) nele.', v_ativos
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_departamentos_validar_desativacao ON public.departamentos;
CREATE TRIGGER trigger_departamentos_validar_desativacao
  BEFORE UPDATE OF ativo ON public.departamentos
  FOR EACH ROW EXECUTE FUNCTION public.departamentos_validar_desativacao();

-- A policy de UPDATE de colaboradores é por canViewColaboradores (cadastro);
-- o departamento pede também canManageDepartamentos. Não entra num departamento
-- inativo. Sem DEFINER, para ler o current_user de quem chama: sync, migrations
-- e service_role passam.
CREATE OR REPLACE FUNCTION public.colaboradores_validar_departamento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.departamento_id IS NOT DISTINCT FROM OLD.departamento_id THEN
    RETURN NEW;
  END IF;
  IF NEW.departamento_id IS NULL AND TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF current_user IN ('authenticated', 'anon')
     AND NOT public.current_user_has_permission('canManageDepartamentos') THEN
    RAISE EXCEPTION 'Sem permissão para alterar o departamento do colaborador (Gerenciar Departamentos).'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.departamento_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.departamentos WHERE id = NEW.departamento_id AND ativo) THEN
    RAISE EXCEPTION 'Departamento inativo: reative-o antes de colocar alguém nele.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_colaboradores_validar_departamento ON public.colaboradores;
CREATE TRIGGER trigger_colaboradores_validar_departamento
  BEFORE INSERT OR UPDATE OF departamento_id ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.colaboradores_validar_departamento();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. RLS — leitura aberta a autenticado; escrita com canManageDepartamentos.
-- Sem DELETE em departamentos (desativa-se).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS departamentos_select ON public.departamentos;
CREATE POLICY departamentos_select ON public.departamentos
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS departamentos_insert ON public.departamentos;
CREATE POLICY departamentos_insert ON public.departamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageDepartamentos'));

DROP POLICY IF EXISTS departamentos_update ON public.departamentos;
CREATE POLICY departamentos_update ON public.departamentos
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageDepartamentos'))
  WITH CHECK (public.current_user_has_permission('canManageDepartamentos'));

ALTER TABLE public.departamento_responsaveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS departamento_responsaveis_select ON public.departamento_responsaveis;
CREATE POLICY departamento_responsaveis_select ON public.departamento_responsaveis
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS departamento_responsaveis_insert ON public.departamento_responsaveis;
CREATE POLICY departamento_responsaveis_insert ON public.departamento_responsaveis
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageDepartamentos'));

DROP POLICY IF EXISTS departamento_responsaveis_delete ON public.departamento_responsaveis;
CREATE POLICY departamento_responsaveis_delete ON public.departamento_responsaveis
  FOR DELETE TO authenticated
  USING (public.current_user_has_permission('canManageDepartamentos'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. PERMISSÃO canManageDepartamentos — cargo RH e Administrador (pelo id fixo
-- e pelo nome: ele tem todas as chaves do catálogo, src/utils/permissions.test.ts).
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canManageDepartamentos"]'::jsonb,
       updated_at = now()
 WHERE (cr.name = 'RH'
        OR cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canManageDepartamentos';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. HOLERITES DA EQUIPE — pelos responsáveis do departamento, não mais pelo
-- gestor direto. O nome da função fica (as três policies de 20260918140000
-- apontam para ela); a permissão canViewHoleritesEquipe continua exigida nelas.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.colaborador_e_subordinado_do_usuario_atual(p_colaborador_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.colaboradores alvo
      JOIN public.departamento_responsaveis r ON r.departamento_id = alvo.departamento_id
      JOIN public.colaboradores eu ON eu.id = r.colaborador_id
     WHERE alvo.id = p_colaborador_id
       AND eu.user_profile_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.colaborador_e_subordinado_do_usuario_atual(uuid) IS 'SECURITY DEFINER — evita recursão de RLS em colaboradores. True se p_colaborador_id está num departamento pelo qual o colaborador do usuário logado é responsável (departamento_responsaveis). Desde 20261020215000; antes era o gestor direto (gestor_id).';

COMMIT;
