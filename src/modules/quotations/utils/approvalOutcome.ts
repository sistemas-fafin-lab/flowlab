import { ApprovalLevel, MANAGER_APPROVAL_LEVEL, QuotationApproval, QuotationStatus } from '../types';

/**
 * Mensagem de sucesso da assinatura a partir do status devolvido pela RPC de
 * decisão — o client só reflete o desfecho, não recalcula a regra de dispensa.
 */
export function getApprovalSuccessMessage(newStatus: QuotationStatus): string {
  return newStatus === 'awaiting_approval'
    ? 'Aprovação do gestor registrada! A cotação seguiu para a aprovação por alçada.'
    : 'Cotação aprovada com sucesso!';
}

/**
 * Linhas de quotation_approvals que sobram depois de desfazer uma aprovação,
 * espelhando o DELETE de quotation_revert_from_approved: volta para a alçada →
 * sai só a linha de alçada; volta para a etapa do gestor (etapa 2 dispensada)
 * → saem a linha de alçada e a do gestor.
 */
export function approvalsAfterRevert(
  approvals: QuotationApproval[],
  alcadaLevel: ApprovalLevel,
  newStatus: QuotationStatus,
): QuotationApproval[] {
  const removesManager = newStatus === 'awaiting_manager_approval';
  return approvals.filter(a => a.level !== alcadaLevel && !(removesManager && a.level === MANAGER_APPROVAL_LEVEL));
}
