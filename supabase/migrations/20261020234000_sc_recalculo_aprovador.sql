-- ═══════════════════════════════════════════════════════════════════════════════
-- Solicitações de Compra — recálculo do aprovador quando o RH muda o departamento
-- Migration: 20261020234000_sc_recalculo_aprovador.sql
-- (.scratch/solicitacoes-aprovacao-gestor/issues/03-rh-marca-aprovador-e-recalculo.md)
--
-- Depende de 20261020220000_sc_aprovador_pelo_departamento.sql (approver_id,
-- requests_resolver_aprovador) e, por ela, da migration dos departamentos
-- (issue 06).
--
-- Quando o RH coloca alguém num departamento (colaboradores.departamento_id) ou
-- define o aprovador de um departamento (departamentos.aprovador_sc_id), as SCs
-- pending SEM aprovador de quem é afetado passam pela mesma resolução da
-- criação. SC que já tem aprovador não muda, nem quando o aprovador do
-- departamento é trocado ou removido (fora de escopo: reatribuir).
--
-- Os triggers são SECURITY DEFINER: quem muda o departamento é o RH
-- (authenticated), e requests_proteger_aprovador barra authenticated de mexer
-- em approver_id. O e-mail ao novo aprovador é a issue 04.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.requests_resolver_aprovador(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Aplique antes 20261020220000_sc_aprovador_pelo_departamento.sql.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Colaborador entrou num departamento (ou mudou de departamento): as SCs dele.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.requests_recalcular_aprovador_colaborador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aprovador uuid;
BEGIN
  IF NEW.user_profile_id IS NULL OR NEW.departamento_id IS NULL
     OR (TG_OP = 'UPDATE' AND NEW.departamento_id IS NOT DISTINCT FROM OLD.departamento_id) THEN
    RETURN NULL;
  END IF;

  v_aprovador := public.requests_resolver_aprovador(NEW.user_profile_id);
  IF v_aprovador IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.requests
     SET approver_id = v_aprovador
   WHERE requested_by_user_id = NEW.user_profile_id
     AND type = 'SC'
     AND status = 'pending'
     AND approver_id IS NULL;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.requests_recalcular_aprovador_colaborador() IS 'Ao colocar o colaborador num departamento, grava o aprovador (requests_resolver_aprovador) nas SCs pending dele que estão sem aprovador. SCs com aprovador não mudam.';

REVOKE ALL ON FUNCTION public.requests_recalcular_aprovador_colaborador() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_requests_recalcular_aprovador_colaborador ON public.colaboradores;
CREATE TRIGGER trigger_requests_recalcular_aprovador_colaborador
  AFTER INSERT OR UPDATE OF departamento_id ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.requests_recalcular_aprovador_colaborador();

-- ═══════════════════════════════════════════════════════════════════════════════
-- Departamento ganhou (ou trocou de) aprovador: as SCs de todos os membros.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.requests_recalcular_aprovador_departamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.aprovador_sc_id IS NULL
     OR NEW.aprovador_sc_id IS NOT DISTINCT FROM OLD.aprovador_sc_id THEN
    RETURN NULL;
  END IF;

  UPDATE public.requests r
     SET approver_id = membros.aprovador
    FROM (
      SELECT c.user_profile_id AS solicitante,
             public.requests_resolver_aprovador(c.user_profile_id) AS aprovador
        FROM public.colaboradores c
       WHERE c.departamento_id = NEW.id
         AND c.user_profile_id IS NOT NULL
    ) membros
   WHERE r.requested_by_user_id = membros.solicitante
     AND membros.aprovador IS NOT NULL
     AND r.type = 'SC'
     AND r.status = 'pending'
     AND r.approver_id IS NULL;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.requests_recalcular_aprovador_departamento() IS 'Ao definir o aprovador de SC do departamento, grava o aprovador (requests_resolver_aprovador) nas SCs pending dos membros que estão sem aprovador. SCs com aprovador não mudam.';

REVOKE ALL ON FUNCTION public.requests_recalcular_aprovador_departamento() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_requests_recalcular_aprovador_departamento ON public.departamentos;
CREATE TRIGGER trigger_requests_recalcular_aprovador_departamento
  AFTER UPDATE OF aprovador_sc_id ON public.departamentos
  FOR EACH ROW EXECUTE FUNCTION public.requests_recalcular_aprovador_departamento();

COMMIT;
