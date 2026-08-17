-- Fecha duas lacunas em quotation_record_decision (20260817160000):
--
-- 1) Autorização: a função só exigia auth.uid() IS NOT NULL. Qualquer usuário
--    autenticado podia chamar a RPC direto (ex. devtools) com p_approver_id
--    de outra pessoa, aprovar acima da própria alçada, ou aprovar sem nunca
--    ter permissão de aprovador — toda a checagem vivia só em getPermissions()
--    no client. Passa a reusar get_user_approval_limit() (já existente, usada
--    pelo próprio getPermissions como fonte de verdade) para validar
--    server-side: aprovador é quem diz ser, tem can_approve=true, e — para
--    aprovação — o valor está dentro da alçada efetiva dele.
--
-- 2) Duplicidade: sem unique key em (quotation_id, level), um revert seguido
--    de nova decisão insere uma segunda linha para o mesmo nível em vez de
--    substituir a primeira. A timeline (ApprovalTimeline) e o PDF liam essas
--    linhas de formas diferentes (primeira vs. última), então passavam a
--    divergir sobre quem aprovou. Convertido em UPSERT: uma linha por
--    (quotation_id, level), sempre a decisão mais recente.
DELETE FROM quotation_approvals qa
WHERE qa.id NOT IN (
  SELECT DISTINCT ON (quotation_id, level) id
  FROM quotation_approvals
  ORDER BY quotation_id, level, created_at DESC, id DESC
);

ALTER TABLE quotation_approvals
  ADD CONSTRAINT quotation_approvals_quotation_level_unique UNIQUE (quotation_id, level);

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
  v_status      TEXT;
  v_can_approve BOOLEAN;
  v_max_amount  DECIMAL(15, 2);
  v_approval    quotation_approvals;
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

  SELECT can_approve, max_amount INTO v_can_approve, v_max_amount
    FROM get_user_approval_limit(auth.uid())
   LIMIT 1;

  IF NOT COALESCE(v_can_approve, FALSE) THEN
    RAISE EXCEPTION 'Usuário sem permissão para aprovar/rejeitar cotações.' USING ERRCODE = '42501';
  END IF;

  IF p_decision = 'approved' AND p_max_amount > COALESCE(v_max_amount, 0) THEN
    RAISE EXCEPTION 'Valor % excede a alçada de aprovação do usuário (%).', p_max_amount, v_max_amount
      USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status FROM quotations WHERE id = p_quotation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada.';
  END IF;
  IF v_status <> 'awaiting_approval' THEN
    RAISE EXCEPTION 'Cotação não está aguardando aprovação (status atual: %).', v_status;
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
  IS 'Aprova ou rejeita uma cotação e grava (upsert por quotation_id+level) o registro de aprovação num único statement atômico, validando alçada via get_user_approval_limit().';
