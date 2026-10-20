-- ═══════════════════════════════════════════════════════════════════════════════
-- Solicitações de Compra — aprovador pelo departamento de quem pediu
-- Migration: 20261020220000_sc_aprovador_pelo_departamento.sql
-- (.scratch/solicitacoes-aprovacao-gestor/issues/01-aprovador-da-sc-pela-cadeia-do-rh.md)
--
-- Depende da issue 06 (departamentos, colaboradores.departamento_id), cuja
-- migration tem de vir antes desta.
--
-- A SC passa a ser aprovada pelo aprovador de SC do departamento de quem pediu:
--   • requests.approver_id: aprovador, gravado na criação da SC pelo trigger
--     abaixo (o valor mandado pelo client é ignorado, e o client não o altera
--     depois). NULL = sem aprovador (quem tem canApproveRequests aprova no
--     lugar).
--   • requests.approved_by_user_id: quem efetivamente aprovou (aprovador ou
--     admin no lugar). Preenchido pela decisão (issue 02); requests.approved_by
--     (texto) continua.
--
-- requests_resolver_aprovador(uuid) pega o departamentos.aprovador_sc_id do
-- colaborador vinculado a quem pediu; vale se ativo, com login vinculado,
-- usuário ativo e não o próprio solicitante. Senão NULL, sem procurar outro.
-- Mesma regra de resolveRequestApprover (src/utils/requestApprover.ts), que só
-- exibe.
--
-- Só SC: a SM continua sem aprovador. Cálculo único das SCs pending no deploy.
-- O recálculo quando o RH muda departamento/aprovador é a issue 03.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'departamentos' AND column_name = 'aprovador_sc_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'colaboradores' AND column_name = 'departamento_id'
  ) THEN
    RAISE EXCEPTION 'Aplique antes a migration dos departamentos (issue 06 de solicitacoes-aprovacao-gestor).';
  END IF;
END $$;

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS approver_id UUID
    REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by_user_id UUID
    REFERENCES public.user_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.requests.approver_id IS 'Aprovador da SC: aprovador de SC do departamento de quem pediu, resolvido na criação (requests_resolver_aprovador). NULL = sem aprovador no RH; SM sempre NULL.';
COMMENT ON COLUMN public.requests.approved_by_user_id IS 'Usuário que aprovou a SC (o aprovador, ou quem tem canApproveRequests no lugar quando não há aprovador).';

CREATE INDEX IF NOT EXISTS idx_requests_approver_pending
  ON public.requests(approver_id) WHERE status = 'pending';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Resolução.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.requests_resolver_aprovador(p_solicitante uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.user_profile_id
    FROM public.colaboradores s
    JOIN public.departamentos d ON d.id = s.departamento_id
    JOIN public.colaboradores a ON a.id = d.aprovador_sc_id
    JOIN public.user_profiles p ON p.id = a.user_profile_id
   WHERE s.user_profile_id = p_solicitante
     AND a.id <> s.id
     AND a.status = 'ativo'
     AND p.is_active = TRUE
     AND p.deleted_at IS NULL
     AND p.disabled_at IS NULL;
$$;

COMMENT ON FUNCTION public.requests_resolver_aprovador(uuid) IS 'Aprovador de uma SC: departamentos.aprovador_sc_id do colaborador vinculado a quem pediu, se ativo, com login, usuário ativo e não o próprio solicitante. NULL sem colaborador, sem departamento, sem aprovador ou aprovador inutilizável. Espelho: resolveRequestApprover no client.';

REVOKE ALL ON FUNCTION public.requests_resolver_aprovador(uuid) FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Trigger na criação: grava o aprovador das SCs; SM fica sem.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.requests_definir_aprovador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.approver_id := CASE
    WHEN NEW.type = 'SC' THEN public.requests_resolver_aprovador(NEW.requested_by_user_id)
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_requests_definir_aprovador ON public.requests;
CREATE TRIGGER trigger_requests_definir_aprovador
  BEFORE INSERT ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.requests_definir_aprovador();

COMMENT ON FUNCTION public.requests_definir_aprovador() IS 'Na criação da SC, grava requests.approver_id pelo departamento de quem pediu (requests_resolver_aprovador), ignorando o que vier do client. SM fica NULL.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- O client não muda aprovador nem quem aprovou: a policy de UPDATE de requests
-- é aberta (USING true), e sem isto qualquer um se faria approver_id. Só quem
-- roda fora dos papéis do client grava: funções SECURITY DEFINER (decisão da
-- issue 02, recálculo da issue 03 — que precisa ser DEFINER), service_role e
-- migrations. Função sem DEFINER de propósito, para ler o current_user de quem
-- chama.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.requests_proteger_aprovador()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND (NEW.approver_id IS DISTINCT FROM OLD.approver_id
          OR NEW.approved_by_user_id IS DISTINCT FROM OLD.approved_by_user_id) THEN
    RAISE EXCEPTION 'O aprovador da solicitação é definido pelo sistema e não pode ser alterado.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_requests_proteger_aprovador ON public.requests;
CREATE TRIGGER trigger_requests_proteger_aprovador
  BEFORE UPDATE OF approver_id, approved_by_user_id ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.requests_proteger_aprovador();

COMMENT ON FUNCTION public.requests_proteger_aprovador() IS 'Barra UPDATE de approver_id/approved_by_user_id vindo do client (authenticated/anon). Funções SECURITY DEFINER, service_role e migrations passam.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Cálculo único das SCs pendentes (inclusive REQ868). SCs antigas sem
-- requested_by_user_id ficam sem aprovador; SC que já tem aprovador não muda
-- (reaplicar a migration não reatribui).
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE public.requests
   SET approver_id = public.requests_resolver_aprovador(requested_by_user_id)
 WHERE type = 'SC' AND status = 'pending' AND approver_id IS NULL;

COMMIT;
