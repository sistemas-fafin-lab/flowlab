-- ═══════════════════════════════════════════════════════════════════════════════
-- Solicitações de Compra — decisão pelo aprovador
-- Migration: 20261020230000_sc_decisao_pelo_aprovador.sql
-- (.scratch/solicitacoes-aprovacao-gestor/issues/02-decisao-da-sc-pelo-gestor.md)
--
-- Depende de 20261020220000_sc_aprovador_pelo_departamento.sql (approver_id,
-- approved_by_user_id e a proteção deles contra o client).
--
--   • requests_decidir_sc(id, decisão, comentário): RPC atômica que aprova ou
--     rejeita a SC. Decide o approver_id; quem tem canApproveRequests só
--     decide quando a SC não tem aprovador (registrado em
--     decided_without_approver). Rejeição exige comentário. Mesma regra de
--     requestActions (src/utils/requestActions.ts), que só exibe.
--   • A SC só é aprovada/rejeitada por essa RPC: a policy de UPDATE de
--     requests é aberta (USING true), e sem a trava o client aprovaria com um
--     UPDATE direto. Pelo client, a SC nasce 'pending' e sem decisão, só muda
--     de status de 'approved' para 'completed' (finalizar), e nenhuma
--     solicitação troca de tipo.
--   • Cotação não nasce de SC pendente nem rejeitada.
--
-- A SM não muda: continua aprovada/finalizada por UPDATE direto.
-- O SELECT de requests já é aberto a qualquer autenticado (nameless_dawn), então
-- o aprovador lê as SCs dele sem policy nova; o recorte por setor é da tela.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'approver_id'
  ) THEN
    RAISE EXCEPTION 'Aplique antes 20261020220000_sc_aprovador_pelo_departamento.sql.';
  END IF;
END $$;

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS decided_without_approver BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rejected_by_user_id UUID
    REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_comment TEXT;

COMMENT ON COLUMN public.requests.decided_without_approver IS 'A SC foi aprovada/rejeitada por quem tem canApproveRequests, no lugar de um aprovador que ela não tinha (approver_id NULL).';
COMMENT ON COLUMN public.requests.rejected_by_user_id IS 'Usuário que rejeitou a SC (requests_decidir_sc).';
COMMENT ON COLUMN public.requests.rejection_comment IS 'Motivo da rejeição da SC, obrigatório na decisão.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Decisão.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.requests_decidir_sc(
  p_request_id TEXT,
  p_decisao    TEXT,
  p_comentario TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           UUID := auth.uid();
  v_comentario    TEXT := NULLIF(btrim(p_comentario), '');
  v_type          TEXT;
  v_status        TEXT;
  v_approver_id   UUID;
  v_sem_aprovador BOOLEAN;
  v_nome          TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  IF p_decisao IS NULL OR p_decisao NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decisão inválida: %.', p_decisao USING ERRCODE = '22023';
  END IF;

  IF p_decisao = 'rejected' AND v_comentario IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da rejeição.' USING ERRCODE = '22023';
  END IF;

  SELECT type, status, approver_id INTO v_type, v_status, v_approver_id
    FROM requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada.';
  END IF;
  IF v_type <> 'SC' THEN
    RAISE EXCEPTION 'Só Solicitações de Compra são decididas por aqui.';
  END IF;

  v_sem_aprovador := v_approver_id IS NULL;
  IF NOT (v_approver_id IS NOT DISTINCT FROM v_uid
          OR (v_sem_aprovador AND public.current_user_has_permission('canApproveRequests'))) THEN
    IF v_sem_aprovador THEN
      RAISE EXCEPTION 'Esta SC está sem aprovador no RH; só quem aprova solicitações pode decidi-la.' USING ERRCODE = '42501';
    END IF;
    RAISE EXCEPTION 'Esta SC é decidida pelo aprovador do departamento de quem pediu.' USING ERRCODE = '42501';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'A solicitação não está pendente (status atual: %).', v_status;
  END IF;

  SELECT name INTO v_nome FROM user_profiles WHERE id = v_uid;

  IF p_decisao = 'approved' THEN
    UPDATE requests
       SET status                   = 'approved',
           approved_by              = v_nome,
           approval_date            = (now() AT TIME ZONE 'America/Sao_Paulo')::date,
           approved_by_user_id      = v_uid,
           decided_without_approver = v_sem_aprovador
     WHERE id = p_request_id;
  ELSE
    UPDATE requests
       SET status                   = 'rejected',
           rejected_by_user_id      = v_uid,
           rejection_comment        = v_comentario,
           decided_without_approver = v_sem_aprovador
     WHERE id = p_request_id;
  END IF;

  RETURN v_sem_aprovador;
END;
$$;

COMMENT ON FUNCTION public.requests_decidir_sc(TEXT, TEXT, TEXT) IS 'Aprova (approved) ou rejeita (rejected, comentário obrigatório) uma SC pendente. Decide o approver_id; com approver_id NULL, quem tem canApproveRequests. Devolve TRUE quando a decisão foi no lugar do aprovador (sem aprovador no RH). Espelho: requestActions no client.';

REVOKE ALL ON FUNCTION public.requests_decidir_sc(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.requests_decidir_sc(TEXT, TEXT, TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- A decisão da SC é só da RPC. Função sem DEFINER de propósito, para ler o
-- current_user de quem chama (mesmo padrão de requests_proteger_aprovador).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.requests_proteger_decisao_sc()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'SC' THEN
      NEW.status                   := 'pending';
      NEW.approved_by              := NULL;
      NEW.approval_date            := NULL;
      NEW.approved_by_user_id      := NULL;
      NEW.decided_without_approver := FALSE;
      NEW.rejected_by_user_id      := NULL;
      NEW.rejection_comment        := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.decided_without_approver IS DISTINCT FROM OLD.decided_without_approver
     OR NEW.rejected_by_user_id IS DISTINCT FROM OLD.rejected_by_user_id
     OR NEW.rejection_comment IS DISTINCT FROM OLD.rejection_comment THEN
    RAISE EXCEPTION 'A decisão da solicitação é registrada pelo sistema e não pode ser alterada.'
      USING ERRCODE = '42501';
  END IF;

  -- Trocar o tipo contornaria a regra (SM pendente virando SC aprovada, sem
  -- aprovador resolvido); a tela nunca troca.
  IF NEW.type IS DISTINCT FROM OLD.type THEN
    RAISE EXCEPTION 'O tipo da solicitação não pode ser alterado.' USING ERRCODE = '42501';
  END IF;

  -- Da SC, o client só finaliza a aprovada; aprovar e rejeitar são da RPC.
  IF OLD.type = 'SC' AND NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'approved' AND NEW.status = 'completed') THEN
    RAISE EXCEPTION 'A decisão da SC % é do aprovador, pela tela de Solicitações.', OLD.id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_requests_proteger_decisao_sc ON public.requests;
CREATE TRIGGER trigger_requests_proteger_decisao_sc
  BEFORE INSERT OR UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.requests_proteger_decisao_sc();

COMMENT ON FUNCTION public.requests_proteger_decisao_sc() IS 'Vindo do client (authenticated/anon): SC nasce pending e sem decisão; nenhuma solicitação troca de tipo; a SC só muda de status de approved para completed (aprovar/rejeitar é de requests_decidir_sc); colunas da decisão não mudam. SECURITY DEFINER, service_role e migrations passam.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Cotação não nasce de SC pendente nem rejeitada.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.quotations_exigir_sc_aprovada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.request_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM requests WHERE id = NEW.request_id AND type = 'SC' AND status IN ('pending', 'rejected')
  ) THEN
    RAISE EXCEPTION 'A SC % não está aprovada; a cotação só pode ser iniciada depois da aprovação.', NEW.request_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_quotations_exigir_sc_aprovada ON public.quotations;
CREATE TRIGGER trigger_quotations_exigir_sc_aprovada
  BEFORE INSERT ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.quotations_exigir_sc_aprovada();

COMMENT ON FUNCTION public.quotations_exigir_sc_aprovada() IS 'Barra criar cotação a partir de SC pending ou rejected.';

COMMIT;
