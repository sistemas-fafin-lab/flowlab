-- Fecha os achados do code-review sobre o valor validado na decisão de
-- aprovação e sobre o revert:
--
-- 1) "Mesma regra de useQuotation.ts" (header da 20260817180000) era falsa:
--    o client preferia selected_price (useQuotation.ts:223) e o SQL ignorava
--    o campo. Linhas legacy do fluxo antigo (selectQuotationWinner em
--    useInventory.ts) gravam só selected_price, com final_total_amount NULL
--    — o client mandava o preço negociado como p_max_amount, a RPC validava
--    contra COALESCE(NULL, estimated_total, 0) e a decisão falhava com 22023
--    sem culpa do usuário. A regra do valor real passa a
--    COALESCE(selected_price, final_total_amount, estimated_total, 0) nos
--    dois lados (o client agora espelha a mesma expressão em
--    getQuotationAmountFromRow).
--
-- 2) quotation_revert_from_approved (20260817200000) apagava por
--    (quotation_id, p_level) sem verificar o registro que apagava: se o
--    nível divergiu (o valor da cotação mudou depois da aprovação e o
--    client calculou outro requiredApprovalLevel), o DELETE não encontrava
--    nada e o revert seguia em frente, deixando a aprovação stale para
--    trás — exatamente a divergência que o fix existe para impedir. A RPC
--    passa a exigir que exista uma aprovação (status approved) no nível
--    informado; do contrário, levanta erro em vez de silenciar.
--
-- De quebra, as duas funções ganham REVOKE FROM PUBLIC + GRANT TO
-- authenticated (padrão estabelecido na 20260817160000, linhas 67-68):
-- não há motivo para EXECUTE público numa função SECURITY DEFINER.
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
  v_selected_price   DECIMAL(15, 2);
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

  -- Autorização ANTES de qualquer leitura da cotação: sem isso, a mensagem
  -- de erro da checagem de valor serviria de oráculo do valor real para
  -- quem não tem alçada.
  SELECT can_approve, max_amount INTO v_can_approve, v_max_amount
    FROM get_user_approval_limit(auth.uid())
   LIMIT 1;

  IF NOT COALESCE(v_can_approve, FALSE) THEN
    RAISE EXCEPTION 'Usuário sem permissão para aprovar/rejeitar cotações.' USING ERRCODE = '42501';
  END IF;

  SELECT status, selected_price, final_total_amount, estimated_total
    INTO v_status, v_selected_price, v_final_total, v_estimated_total
    FROM quotations WHERE id = p_quotation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada.';
  END IF;
  IF v_status <> 'awaiting_approval' THEN
    RAISE EXCEPTION 'Cotação não está aguardando aprovação (status atual: %).', v_status;
  END IF;

  v_real_amount := COALESCE(v_selected_price, v_final_total, v_estimated_total, 0);
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

COMMENT ON FUNCTION public.quotation_record_decision(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR)
  IS 'Aprova ou rejeita uma cotação (upsert por quotation_id+level), autorizando por alçada antes de qualquer leitura e validando p_max_amount com IS DISTINCT FROM contra o valor real COALESCE(selected_price, final_total_amount, estimated_total, 0).';

CREATE OR REPLACE FUNCTION public.quotation_revert_from_approved(
  p_quotation_id UUID,
  p_level        VARCHAR(20)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status          TEXT;
  v_approval_exists BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
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
  -- cotação: se o nível divergiu (valor mudou depois da aprovação e o
  -- client calculou outro requiredApprovalLevel), não há registro
  -- "approved" no nível informado e o DELETE não encontraria nada — o
  -- revert prosseguiria deixando a aprovação stale para trás, a divergência
  -- que este fix existe para impedir. Registros de outro nível (ex.:
  -- histórico de uma rejeição anterior) são história legítima e permanecem,
  -- espelhando o filtro que o client aplica no estado local.
  SELECT EXISTS (
    SELECT 1
      FROM quotation_approvals
     WHERE quotation_id = p_quotation_id
       AND level = p_level
       AND status = 'approved'
  ) INTO v_approval_exists;

  IF NOT v_approval_exists THEN
    RAISE EXCEPTION 'Nenhuma aprovação registrada no nível % para esta cotação. Atualize a página e tente novamente.', p_level;
  END IF;

  DELETE FROM quotation_approvals
   WHERE quotation_id = p_quotation_id
     AND level = p_level;

  UPDATE quotations SET status = 'awaiting_approval' WHERE id = p_quotation_id;
END;
$$;

COMMENT ON FUNCTION public.quotation_revert_from_approved(UUID, VARCHAR)
  IS 'Reverte uma cotação aprovada para awaiting_approval, apagando o registro de aprovação do nível (verificado antes do DELETE) e voltando o status na mesma transação.';

REVOKE ALL ON FUNCTION public.quotation_record_decision(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quotation_record_decision(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR) TO authenticated;

REVOKE ALL ON FUNCTION public.quotation_revert_from_approved(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quotation_revert_from_approved(UUID, VARCHAR) TO authenticated;
