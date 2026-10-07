-- ═══════════════════════════════════════════════════════════════════════════════
-- Cotações — etapa de aprovação do gestor do pedido (caminho principal)
-- Migration: 20261007130000_quotation_manager_approval_stage.sql
--
-- Enviar para aprovação passa a levar a cotação para o status novo
-- 'awaiting_manager_approval' ("Aprovação do gestor"): o gestor do pedido
-- (quotations.requester_manager_id) — ou um admin no lugar dele — dá o
-- "de acordo" antes da aprovação por alçada. 'awaiting_approval' passa a
-- significar só a etapa de alçada, então o card da Home, o resumo das 17h e
-- quotation_record_decision continuam sem mudança de filtro.
--
--   • quotations.status é TEXT sem CHECK (removido em 20260219120000), então o
--     status novo não precisa de constraint — só do rótulo em
--     get_quotation_status_label.
--   • quotation_approvals.level ganha 'manager': uma linha por etapa,
--     mantendo a unicidade (quotation_id, level).
--   • quotation_record_decision recusa p_level = 'manager' (só a RPC abaixo
--     grava a linha do gestor).
--   • quotation_record_manager_decision: RPC atômica da etapa do gestor.
--     Neste passo a aprovação SEMPRE segue para 'awaiting_approval' (a
--     dispensa da etapa 2 por alçada do gestor vem depois).
--
-- Transição no deploy: cotações já em 'awaiting_approval' continuam na etapa
-- de alçada, sem linha 'manager' — nada é migrado.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.quotation_approvals
  DROP CONSTRAINT IF EXISTS quotation_approvals_level_check;

ALTER TABLE public.quotation_approvals
  ADD CONSTRAINT quotation_approvals_level_check
  CHECK (level IN ('manager', 'level_1', 'level_2', 'level_3', 'level_4'));

-- quotation_record_decision (alçada) passa a recusar p_level fora de
-- level_1..level_4: com 'manager' agora aceito pelo CHECK acima, o upsert por
-- (quotation_id, level) deixaria a decisão por alçada sobrescrever a linha
-- assinada pelo gestor. Corpo idêntico ao de 20260902150000, só com essa
-- checagem a mais (CREATE OR REPLACE inteiro, não dá para alterar um trecho).
CREATE OR REPLACE FUNCTION public.quotation_record_decision(
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
RETURNS quotation_approvals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status           TEXT;
  v_final_total      DECIMAL(15, 2);
  v_estimated_total  DECIMAL(15, 2);
  v_real_amount      DECIMAL(15, 2);
  v_can_approve      BOOLEAN;
  v_max_amount       DECIMAL(15, 2);
  v_approval         quotation_approvals;
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

  -- A linha 'manager' é da etapa do gestor e só quotation_record_manager_decision
  -- a grava: sem isso, quem tem alçada sobrescreveria a assinatura do gestor.
  IF p_level NOT IN ('level_1', 'level_2', 'level_3', 'level_4') THEN
    RAISE EXCEPTION 'Nível de alçada inválido: %.', p_level;
  END IF;

  -- Autorização ANTES de qualquer leitura da cotação: sem isso, a mensagem
  -- de erro da checagem de valor serviria de oráculo do valor real para
  -- quem não tem alçada.
  SELECT can_approve, max_amount INTO v_can_approve, v_max_amount
    FROM get_user_approval_limit(auth.uid())
   LIMIT 1;

  IF NOT COALESCE(v_can_approve, FALSE) THEN
    RAISE EXCEPTION 'Usuário sem permissão para aprovar/rejeitar cotações.' USING ERRCODE = '42501';
  END IF;

  SELECT status, final_total_amount, estimated_total
    INTO v_status, v_final_total, v_estimated_total
    FROM quotations WHERE id = p_quotation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada.';
  END IF;
  IF v_status <> 'awaiting_approval' THEN
    RAISE EXCEPTION 'Cotação não está aguardando aprovação (status atual: %).', v_status;
  END IF;

  v_real_amount := COALESCE(v_final_total, v_estimated_total, 0);
  IF p_max_amount IS DISTINCT FROM v_real_amount THEN
    RAISE EXCEPTION 'Valor informado (%) não corresponde ao valor atual da cotação (%). Atualize a página e tente novamente.',
      p_max_amount, v_real_amount USING ERRCODE = '22023';
  END IF;

  IF p_decision = 'approved' AND v_real_amount > COALESCE(v_max_amount, 0) THEN
    RAISE EXCEPTION 'Valor % excede a alçada de aprovação do usuário (%).', v_real_amount, v_max_amount
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO quotation_approvals (
    quotation_id, level, approver_id, approver_name, approver_role,
    status, max_amount, comment, approved_at, rejected_at, signature_hash
  ) VALUES (
    p_quotation_id, p_level, p_approver_id, p_approver_name, p_approver_role,
    p_decision, p_max_amount, p_comment,
    CASE WHEN p_decision = 'approved' THEN p_decided_at END,
    CASE WHEN p_decision = 'rejected' THEN p_decided_at END,
    p_signature_hash
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

  UPDATE quotations SET status = p_decision WHERE id = p_quotation_id;

  RETURN v_approval;
END;
$$;

REVOKE ALL ON FUNCTION public.quotation_record_decision(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quotation_record_decision(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_quotation_status_label(status TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE status
    WHEN 'draft' THEN 'Rascunho'
    WHEN 'sent_to_suppliers' THEN 'Enviada aos Fornecedores'
    WHEN 'waiting_responses' THEN 'Aguardando Respostas'
    WHEN 'under_review' THEN 'Em Análise'
    WHEN 'awaiting_manager_approval' THEN 'Aprovação do Gestor'
    WHEN 'awaiting_approval' THEN 'Aguardando Aprovação'
    WHEN 'approved' THEN 'Aprovada'
    WHEN 'rejected' THEN 'Rejeitada'
    WHEN 'cancelled' THEN 'Cancelada'
    WHEN 'converted_to_purchase' THEN 'Convertida em Pedido'
    ELSE status
  END;
END;
$$ LANGUAGE plpgsql;

-- ─── RPC: decisão da etapa do gestor ────────────────────────────────────────
-- Mesmo padrão de quotation_record_decision: SECURITY DEFINER, uma transação
-- só, FOR UPDATE na cotação, valor do client conferido contra o valor real.
--
-- Autorização antes de qualquer informação da cotação sair daqui: a linha é
-- travada para descobrir o gestor, mas "não encontrada" e "não é o gestor"
-- devolvem o mesmo erro para quem não é admin — status e valor só são
-- checados (e só aparecem em mensagens) depois que o usuário provou ser o
-- gestor do pedido ou admin.
CREATE OR REPLACE FUNCTION public.quotation_record_manager_decision(
  p_quotation_id   UUID,
  p_decision       VARCHAR(20),
  p_approver_id    UUID,
  p_approver_name  VARCHAR(255),
  p_approver_role  VARCHAR(50),
  p_max_amount     DECIMAL(15, 2),
  p_comment        TEXT,
  p_decided_at     TIMESTAMPTZ,
  p_signature_hash VARCHAR(64)
)
RETURNS TABLE (
  approval_id         UUID,
  approval_created_at TIMESTAMPTZ,
  new_status          TEXT,
  decided_by_admin    BOOLEAN
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
  v_new_status       TEXT;
  v_approval         quotation_approvals;
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

  v_new_status := CASE WHEN p_decision = 'approved' THEN 'awaiting_approval' ELSE 'under_review' END;

  UPDATE quotations SET status = v_new_status WHERE id = p_quotation_id;

  RETURN QUERY SELECT v_approval.id, v_approval.created_at, v_new_status, NOT v_is_manager;
END;
$$;

COMMENT ON FUNCTION public.quotation_record_manager_decision(UUID, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR)
  IS 'Etapa do gestor do pedido: aprova (→ awaiting_approval) ou rejeita com comentário obrigatório (→ under_review), gravando a linha level=manager. Só o requester_manager_id da cotação ou um admin; valida p_max_amount contra COALESCE(final_total_amount, estimated_total, 0). decided_by_admin = admin decidindo no lugar do gestor.';

REVOKE ALL ON FUNCTION public.quotation_record_manager_decision(UUID, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quotation_record_manager_decision(UUID, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM
-- ═══════════════════════════════════════════════════════════════════════════════
