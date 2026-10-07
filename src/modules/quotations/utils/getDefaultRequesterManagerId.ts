import type { Quotation } from '../types';

export interface RequesterManagerSource {
  /** `requests.requested_by_user_id` da SC vinculada (Compras). */
  requestRequestedByUserId?: string | null;
  /** `maintenance_requests.requester_id` da solicitação vinculada (Contratação). */
  maintenanceRequesterId?: string | null;
}

/**
 * Gestor do pedido sugerido no envio para aprovação: o já gravado na cotação
 * (reenvio), senão quem abriu a origem — a SC em Compras, a solicitação de
 * manutenção em Contratação. Null quando não há como saber (SC antiga ou
 * cotação sem vínculo): o comprador escolhe manualmente.
 */
export function getDefaultRequesterManagerId(
  quotation: Pick<Quotation, 'quotationType' | 'requesterManagerId'>,
  source: RequesterManagerSource,
): string | null {
  if (quotation.requesterManagerId) return quotation.requesterManagerId;
  const fromSource = quotation.quotationType === 'contratacao'
    ? source.maintenanceRequesterId
    : source.requestRequestedByUserId;
  return fromSource ?? null;
}
