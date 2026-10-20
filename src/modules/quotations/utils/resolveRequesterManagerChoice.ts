import type { Quotation, RequesterManager } from '../types';

export interface RequesterManagerSource {
  /** `requests.approved_by_user_id` da SC vinculada (Compras): quem aprovou a SC. */
  requestApprovedByUserId?: string | null;
  /** `requests.decided_without_approver`: a SC foi aprovada por admin no lugar, sem aprovador. */
  requestDecidedWithoutApprover?: boolean;
  /** `maintenance_requests.requester_id` da solicitação vinculada (Contratação). */
  maintenanceRequesterId?: string | null;
}

export interface RequesterManagerChoice {
  /** Gestor definido pela origem — não pode ser trocado. Null quando o comprador escolhe. */
  lockedManagerId: string | null;
  /** Pré-preenchimento do campo. */
  suggestedId: string | null;
  /** Quem pode ser escolhido: só o travado, ou os ativos menos o comprador e quem está agindo. */
  eligibleUsers: RequesterManager[];
}

/**
 * Regra do "Gestor do pedido" (espelhada no trigger
 * quotation_enforce_requester_manager): a origem é o gestor, sem troca — em
 * Compras quem aprovou a SC (exceto admin aprovando no lugar, sem aprovador),
 * em Contratação quem abriu a solicitação de manutenção —, desde que esteja
 * ativa e não seja o comprador nem quem está enviando (seria autoaprovação).
 * Fora isso o comprador escolhe entre os ativos, nunca a si mesmo nem quem
 * criou a cotação.
 */
export function resolveRequesterManagerChoice({
  quotation,
  source,
  activeUsers,
  currentUserId,
}: {
  quotation: Pick<Quotation, 'quotationType' | 'requesterManagerId' | 'createdBy'>;
  source: RequesterManagerSource;
  activeUsers: RequesterManager[];
  currentUserId: string | null;
}): RequesterManagerChoice {
  const excluded = new Set([quotation.createdBy, currentUserId].filter(Boolean));
  const eligible = activeUsers.filter((u) => !excluded.has(u.id));

  const originId = quotation.quotationType === 'contratacao'
    ? source.maintenanceRequesterId
    : source.requestDecidedWithoutApprover ? null : source.requestApprovedByUserId;
  const locked = originId ? eligible.find((u) => u.id === originId) : undefined;

  if (locked) {
    return { lockedManagerId: locked.id, suggestedId: locked.id, eligibleUsers: [locked] };
  }

  const keepsCurrent = eligible.some((u) => u.id === quotation.requesterManagerId);
  return {
    lockedManagerId: null,
    suggestedId: keepsCurrent ? quotation.requesterManagerId ?? null : null,
    eligibleUsers: eligible,
  };
}
