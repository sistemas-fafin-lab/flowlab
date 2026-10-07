-- ═══════════════════════════════════════════════════════════════════════════════
-- Cotações — dispensa da etapa de alçada pela alçada do gestor e reversão
-- Migration: 20261007150000_quotation_manager_stage_waiver.sql
--
-- Quando o gestor do pedido (ou o admin que decide no lugar dele) também tem
-- alçada para o valor real da cotação, a aprovação dele já conclui a cotação:
-- quotation_record_manager_decision grava, além da linha 'manager', a linha de
-- alçada em nome dele (mesma assinatura e mesmo instante), marcada com
-- stage_waived, e muda o status direto para 'approved'.
--
-- Desfazer a aprovação (quotation_revert_from_approved) passa a ter dois
-- destinos: com aprovação real de alçada, apaga só a linha de alçada e volta
-- para 'awaiting_approval' (como antes); com a etapa de alçada dispensada,
-- apaga as duas linhas e volta para 'awaiting_manager_approval'.
--
-- As duas RPCs mudam o tipo de retorno, então são recriadas (DROP + CREATE).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.quotation_approvals
  ADD COLUMN IF NOT EXISTS stage_waived BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.quotation_approvals.stage_waived
  IS 'Linha de alçada gravada pela aprovação do gestor do pedido com alçada suficiente (etapa 2 dispensada): mesmo aprovador, assinatura e instante da linha manager.';

-- ─── RPC: decisão da etapa do gestor (com dispensa da etapa 2) ──────────────
-- Corpo igual ao de 20261007130000, com:
--   • p_level: nível de alçada da linha gravada na dispensa — a mesma chave
--     que o client usa na decisão e na reversão por alçada. O client o deriva
--     (getRequiredApprovalLevel) do mesmo p_max_amount conferido abaixo; as
--     faixas de nível vivem só no client, então aqui ele não é recalculado;
--   • na aprovação, a alçada do aprovador é consultada contra o valor real;
--   • retorno ganha a linha de alçada gravada na dispensa (NULL sem dispensa).
DROP FUNCTION IF EXISTS public.quotation_record_manager_decision(UUID, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR);

CREATE OR REPLACE FUNCTION public.quotation_record_manager_decision(
  p_quotation_id   UUID,
  p_decision       VARCHAR(20),
  p_level          VARCHAR(20),
  p_approver_id    UUID,
  p_approver_name  VARCHAR(255),
  p_approver_role  VARCHAR(50),
  p_max_amount     DECIMAL(15, 2),
  p_comment        TEXT,
  p_decided_at     TIMESTAMPTZ,
  p_signature_hash VARCHAR(64)
)
RETURNS TABLE (
  approval_id               UUID,
  approval_created_at       TIMESTAMPTZ,
  new_status                TEXT,
  decided_by_admin          BOOLEAN,
  waived_approval_id        UUID,
  waived_approval_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin         BOOLEAN;
  v_is_manager       BOOLEAN;
  v_found            BOOLEAN;
  v_manager_id       UUID;
  v_status           TEXT;
  v_final_total      DECIMAL(15, 2);
  v_estimated_total  DECIMAL(15, 2);
  v_real_amount      DECIMAL(15, 2);
  v_can_approve      BOOLEAN;
  v_limit            DECIMAL(15, 2);
  v_new_status       TEXT;
  v_approval         quotation_approvals;
  v_waived           quotation_approvals;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  IF p_approver_id <> auth.uid() THEN
    RAISE EXCEPTION 'p_approver_id não corresponde ao usuário autenticado.' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decisão inválida: %.', p_decision;
  END IF;

  IF p_level NOT IN ('level_1', 'level_2', 'level_3', 'level_4') THEN
    RAISE EXCEPTION 'Nível de alçada inválido: %.', p_level;
  END IF;

  IF p_decision = 'rejected' AND NULLIF(btrim(COALESCE(p_comment, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da rejeição.' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  SELECT requester_manager_id, status, final_total_amount, estimated_total
    INTO v_manager_id, v_status, v_final_total, v_estimated_total
    FROM quotations WHERE id = p_quotation_id FOR UPDATE;

  v_found := FOUND;
  -- IS NOT DISTINCT FROM: cotação sem gestor (NULL) nunca autoriza um
  -- não-admin — com "=" o NULL atravessaria o IF NOT (...) abaixo.
  v_is_manager := v_found AND v_manager_id IS NOT DISTINCT FROM auth.uid();

  IF NOT (v_is_manager OR v_is_admin) THEN
    RAISE EXCEPTION 'Somente o gestor do pedido (ou um admin) pode decidir esta etapa da cotação.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT v_found THEN
    RAISE EXCEPTION 'Cotação não encontrada.';
  END IF;

  IF v_status <> 'awaiting_manager_approval' THEN
    RAISE EXCEPTION 'Cotação não está aguardando aprovação do gestor (status atual: %).', v_status;
  END IF;

  -- Valor real no momento da decisão, já refletindo uma troca de vencedora
  -- feita no próprio modal — é contra ele que a alçada é checada abaixo.
  v_real_amount := COALESCE(v_final_total, v_estimated_total, 0);
  IF p_max_amount IS DISTINCT FROM v_real_amount THEN
    RAISE EXCEPTION 'Valor informado (%) não corresponde ao valor atual da cotação (%). Atualize a página e tente novamente.',
      p_max_amount, v_real_amount USING ERRCODE = '22023';
  END IF;

  INSERT INTO quotation_approvals (
    quotation_id, level, approver_id, approver_name, approver_role,
    status, max_amount, comment, approved_at, rejected_at, signature_hash
  ) VALUES (
    p_quotation_id, 'manager', p_approver_id, p_approver_name, p_approver_role,
    p_decision, p_max_amount, p_comment,
    CASE WHEN p_decision = 'approved' THEN p_decided_at END,
    CASE WHEN p_decision = 'rejected' THEN p_decided_at END,
    CASE WHEN p_decision = 'approved' THEN p_signature_hash END
  )
  ON CONFLICT (quotation_id, level) DO UPDATE SET
    approver_id    = EXCLUDED.approver_id,
    approver_name  = EXCLUDED.approver_name,
    approver_role  = EXCLUDED.approver_role,
    status         = EXCLUDED.status,
    max_amount     = EXCLUDED.max_amount,
    comment        = EXCLUDED.comment,
    approved_at    = EXCLUDED.approved_at,
    rejected_at    = EXCLUDED.rejected_at,
    signature_hash = EXCLUDED.signature_hash
  RETURNING * INTO v_approval;

  IF p_decision = 'rejected' THEN
    v_new_status := 'under_review';
  ELSE
    SELECT can_approve, max_amount INTO v_can_approve, v_limit
      FROM get_user_approval_limit(auth.uid())
     LIMIT 1;

    IF COALESCE(v_can_approve, FALSE) AND v_real_amount <= COALESCE(v_limit, 0) THEN
      -- Etapa 2 dispensada: a aprovação do gestor vale também pela alçada.
      INSERT INTO quotation_approvals (
        quotation_id, level, approver_id, approver_name, approver_role,
        status, max_amount, comment, approved_at, rejected_at, signature_hash,
        stage_waived
      ) VALUES (
        p_quotation_id, p_level, p_approver_id, p_approver_name, p_approver_role,
        'approved', p_max_amount, p_comment, p_decided_at, NULL, p_signature_hash,
        TRUE
      )
      ON CONFLICT (quotation_id, level) DO UPDATE SET
        approver_id    = EXCLUDED.approver_id,
        approver_name  = EXCLUDED.approver_name,
        approver_role  = EXCLUDED.approver_role,
        status         = EXCLUDED.status,
        max_amount     = EXCLUDED.max_amount,
        comment        = EXCLUDED.comment,
        approved_at    = EXCLUDED.approved_at,
        rejected_at    = EXCLUDED.rejected_at,
        signature_hash = EXCLUDED.signature_hash,
        stage_waived   = EXCLUDED.stage_waived
      RETURNING * INTO v_waived;

      v_new_status := 'approved';
    ELSE
      v_new_status := 'awaiting_approval';
    END IF;
  END IF;

  UPDATE quotations SET status = v_new_status WHERE id = p_quotation_id;

  RETURN QUERY SELECT v_approval.id, v_approval.created_at, v_new_status, NOT v_is_manager,
    v_waived.id, v_waived.created_at;
END;
$$;

COMMENT ON FUNCTION public.quotation_record_manager_decision(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR)
  IS 'Etapa do gestor do pedido: rejeita com comentário obrigatório (→ under_review) ou aprova — se a alçada do aprovador cobre o valor real, grava também a linha de alçada p_level (stage_waived, mesma assinatura e instante) e vai para approved; senão vai para awaiting_approval. Só o requester_manager_id da cotação ou um admin; valida p_max_amount contra COALESCE(final_total_amount, estimated_total, 0). decided_by_admin = admin decidindo no lugar do gestor.';

REVOKE ALL ON FUNCTION public.quotation_record_manager_decision(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quotation_record_manager_decision(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR) TO authenticated;

-- ─── RPC: reversão de uma cotação aprovada ──────────────────────────────────
-- Corpo igual ao de 20260818100000, com os dois destinos e devolvendo o
-- status novo para o client refletir.
DROP FUNCTION IF EXISTS public.quotation_revert_from_approved(UUID, VARCHAR);

CREATE OR REPLACE FUNCTION public.quotation_revert_from_approved(
  p_quotation_id UUID,
  p_level        VARCHAR(20)
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status       TEXT;
  v_stage_waived BOOLEAN;
  v_new_status   TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  -- Só níveis de alçada: a linha 'manager' nunca é "a" aprovação revertida.
  IF p_level NOT IN ('level_1', 'level_2', 'level_3', 'level_4') THEN
    RAISE EXCEPTION 'Nível de alçada inválido: %.', p_level;
  END IF;

  SELECT status
    INTO v_status
    FROM quotations WHERE id = p_quotation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada.';
  END IF;
  IF v_status <> 'approved' THEN
    RAISE EXCEPTION 'Cotação não está aprovada (status atual: %).', v_status;
  END IF;

  -- A linha que será apagada precisa existir e ser a decisão que aprovou a
  -- cotação (ver 20260818100000): sem ela, o revert deixaria a aprovação
  -- stale para trás.
  SELECT stage_waived
    INTO v_stage_waived
    FROM quotation_approvals
   WHERE quotation_id = p_quotation_id
     AND level = p_level
     AND status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma aprovação registrada no nível % para esta cotação. Atualize a página e tente novamente.', p_level;
  END IF;

  IF v_stage_waived THEN
    -- Ninguém aprovou a etapa 2 de fato: a aprovação do gestor que a
    -- dispensou sai junto, e a cotação volta para a etapa do gestor.
    DELETE FROM quotation_approvals
     WHERE quotation_id = p_quotation_id
       AND level IN (p_level, 'manager');
    v_new_status := 'awaiting_manager_approval';
  ELSE
    -- Aprovação real de alçada: o "de acordo" do gestor continua valendo.
    DELETE FROM quotation_approvals
     WHERE quotation_id = p_quotation_id
       AND level = p_level;
    v_new_status := 'awaiting_approval';
  END IF;

  UPDATE quotations SET status = v_new_status WHERE id = p_quotation_id;

  RETURN v_new_status;
END;
$$;

COMMENT ON FUNCTION public.quotation_revert_from_approved(UUID, VARCHAR)
  IS 'Reverte uma cotação aprovada: com aprovação real de alçada, apaga só a linha do nível e volta para awaiting_approval; com a etapa de alçada dispensada (stage_waived), apaga a linha do nível e a do gestor e volta para awaiting_manager_approval. Devolve o status novo.';

REVOKE ALL ON FUNCTION public.quotation_revert_from_approved(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quotation_revert_from_approved(UUID, VARCHAR) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM
-- ═══════════════════════════════════════════════════════════════════════════════
