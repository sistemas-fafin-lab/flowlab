-- quotation_record_decision (20260817170000) validava a alçada do aprovador
-- contra p_max_amount — um parâmetro que o próprio client envia. Um chamador
-- direto da RPC (fora da UI) podia mandar p_max_amount baixo o suficiente
-- para passar pela checagem de alçada e ainda assim aprovar/rejeitar uma
-- cotação de valor real muito maior; o valor "oficial" gravado em
-- quotation_approvals.max_amount vinha do mesmo parâmetro não verificado.
--
-- Agora a função busca o valor real da cotação (final_total_amount, com
-- fallback pra estimated_total — mesma regra de useQuotation.ts) e exige que
-- p_max_amount bata exatamente com ele. Divergir não vira "usa o valor real
-- calado": vira erro, porque o hash de assinatura já foi gerado no client
-- em cima do valor que ele mandou — se não bate com o valor atual da
-- cotação, o cache do client está desatualizado (alguém mudou o valor final
-- entre a tela carregar e o clique) e a aprovação não deve prosseguir com
-- um hash que não corresponde ao que está sendo persistido.
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
  v_status         TEXT;
  v_final_total    DECIMAL(15, 2);
  v_estimated_total DECIMAL(15, 2);
  v_real_amount    DECIMAL(15, 2);
  v_can_approve    BOOLEAN;
  v_max_amount     DECIMAL(15, 2);
  v_approval       quotation_approvals;
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
  IF p_max_amount <> v_real_amount THEN
    RAISE EXCEPTION 'Valor informado (%) não corresponde ao valor atual da cotação (%). Atualize a página e tente novamente.',
      p_max_amount, v_real_amount USING ERRCODE = '22023';
  END IF;

  SELECT can_approve, max_amount INTO v_can_approve, v_max_amount
    FROM get_user_approval_limit(auth.uid())
   LIMIT 1;

  IF NOT COALESCE(v_can_approve, FALSE) THEN
    RAISE EXCEPTION 'Usuário sem permissão para aprovar/rejeitar cotações.' USING ERRCODE = '42501';
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
  IS 'Aprova ou rejeita uma cotação (upsert por quotation_id+level), validando p_max_amount contra o valor real da cotação e a alçada via get_user_approval_limit().';
