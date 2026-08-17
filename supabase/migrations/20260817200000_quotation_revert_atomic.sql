-- Reverter uma cotação aprovada para awaiting_approval era feito no client em
-- dois statements separados: DELETE do registro de aprovação e UPDATE do
-- status. Se o UPDATE falhasse depois do DELETE (rede, RLS, constraint), a
-- cotação ficava aprovada sem registro de aprovação — a timeline e o PDF
-- passavam a divergir, exatamente a inconsistência que o DELETE existe para
-- evitar. Esta RPC junta os dois passos numa transação única: ou os dois
-- acontecem, ou nada acontece.
--
-- O DELETE é por (quotation_id, level): o nível vem do client, que sempre o
-- computa via getRequiredApprovalLevel — o mesmo valor usado como chave do
-- upsert em quotation_record_decision. Apagar só o nível revertido preserva
-- o histórico de decisões de outros níveis, espelhando o filtro que o client
-- aplica no estado local (approvals.filter(a => a.level !== requiredLevel)).
--
-- Autorização: exige apenas usuário autenticado, em paridade com o estado
-- atual do RLS de quotations/quotation_approvals (acesso amplo a usuários
-- autenticados). A checagem de quem pode reverter continua no client
-- (permissions.canRevert); endurecer o revert server-side é trabalho
-- separado, não parte deste fix.
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
  v_status TEXT;
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

  DELETE FROM quotation_approvals
   WHERE quotation_id = p_quotation_id
     AND level = p_level;

  UPDATE quotations SET status = 'awaiting_approval' WHERE id = p_quotation_id;
END;
$$;

COMMENT ON FUNCTION public.quotation_revert_from_approved(UUID, VARCHAR)
  IS 'Reverte uma cotação aprovada para awaiting_approval, apagando o registro de aprovação do nível e voltando o status na mesma transação.';
