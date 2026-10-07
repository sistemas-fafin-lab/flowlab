import { Quotation } from '../types';
import { isManagerApprovalStage } from '../workflow/stateMachine';

/**
 * Cotações da tela "Minhas aprovações de cotação": na etapa do gestor e com
 * o usuário logado como gestor do pedido. Admin não vê as dos outros aqui —
 * aprova no lugar do gestor pela lista completa.
 */
export const filterQuotationsAwaitingMyManagerApproval = <
  T extends Pick<Quotation, 'status' | 'requesterManagerId'>,
>(
  quotations: T[],
  userId: string | undefined,
): T[] => {
  if (!userId) return [];
  return quotations.filter(
    (q) => isManagerApprovalStage(q.status) && q.requesterManagerId === userId,
  );
};
