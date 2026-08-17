-- Reordena os checks de quotation_record_decision (20260817180000) e fecha
-- dois furos da validação de valor:
--
-- 1) Ordem de autorização: a versão anterior lia o status e o valor da
--    cotação ANTES de checar can_approve. Um chamador direto da RPC sem
--    alçada conseguia sondar o valor real da cotação lendo a mensagem de
--    erro "Valor informado (X) não corresponde ao valor atual (Y)" — o
--    próprio vazamento que a autorização existe para impedir. Agora a
--    checagem de alçada vem antes de qualquer leitura da cotação: quem não
--    pode aprovar/rejeitar só vê o erro de permissão, nunca o valor.
--
-- 2) Bypass de NULL: p_max_amount <> v_real_amount é NULL quando qualquer
--    um dos lados é NULL, e uma comparação NULL não levanta erro — um
--    chamador mandando p_max_amount NULL pulava a validação e gravava
--    max_amount NULL. Troca por IS DISTINCT FROM, que trata NULL como um
--    valor concreto (e um valor real NULL na cotação — estimated_total e
--    final_total_amount ambos vazios — passa a ser recusado em vez de
--    aceitar um p_max_amount qualquer).
--
-- A igualdade continua EXATA (sem tolerância de centavos): o hash de
-- assinatura é gerado no client sobre o valor que ele manda, então o valor
-- precisa bater bit a bit com o que será persistido. Drift de float do JS
-- não é um problema na prática porque o número atravessa o JSON como texto
-- decimal (ex. 99.99) e o Postgres o interpreta de volta como DECIMAL exato.
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
  v_status          TEXT;
  v_final_total     DECIMAL(15, 2);
  v_estimated_total DECIMAL(15, 2);
  v_real_amount     DECIMAL(15, 2);
  v_can_approve     BOOLEAN;
  v_max_amount      DECIMAL(15, 2);
  v_approval        quotation_approvals;
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

COMMENT ON FUNCTION public.quotation_record_decision(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR)
  IS 'Aprova ou rejeita uma cotação (upsert por quotation_id+level), autorizando por alçada antes de qualquer leitura da cotação e validando p_max_amount com IS DISTINCT FROM contra o valor real.';
