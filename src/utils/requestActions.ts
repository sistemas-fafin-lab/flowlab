import type { Request } from '../types';

/** O que as regras precisam da solicitação. */
export type RequestForActions = Pick<Request, 'type' | 'status' | 'approverId' | 'department'>;

/** Quem está olhando a lista de Solicitações. */
export interface RequestViewer {
  userId: string | null;
  department?: string;
  /** Operacional de Compras: iniciar cotação, finalizar, ver todos os setores, aprovar SM e SC sem aprovador. */
  canApproveRequests: boolean;
}

export interface RequestActions {
  /** Aprovar/Rejeitar visíveis. */
  canDecide: boolean;
  /** A decisão seria de quem tem canApproveRequests no lugar de um aprovador que a SC não tem. */
  decidesWithoutApprover: boolean;
  canStartQuotation: boolean;
  canFinalize: boolean;
}

/**
 * Ações que o usuário tem sobre uma solicitação. A SC é decidida pelo
 * approver_id; quem tem canApproveRequests só decide quando ela não tem
 * aprovador, e só inicia cotação/finaliza depois de aprovada. A SM segue como
 * antes. A decisão de verdade é da RPC requests_decidir_sc, que aplica a mesma
 * regra; aqui só para exibir.
 */
export function requestActions(request: RequestForActions, viewer: RequestViewer): RequestActions {
  const pending = request.status === 'pending';
  const approved = request.status === 'approved';
  const { canApproveRequests } = viewer;
  if (request.type === 'SM') {
    return {
      canDecide: pending && canApproveRequests,
      decidesWithoutApprover: false,
      canStartQuotation: canApproveRequests && approved,
      canFinalize: canApproveRequests && (pending || approved),
    };
  }
  const decidesWithoutApprover = !request.approverId && canApproveRequests;
  return {
    canDecide: pending && (isApproverOf(request, viewer.userId) || decidesWithoutApprover),
    decidesWithoutApprover,
    canStartQuotation: canApproveRequests && approved,
    canFinalize: canApproveRequests && approved,
  };
}

/** O usuário é o aprovador gravado na SC. */
export function isApproverOf(request: Pick<RequestForActions, 'approverId'>, userId: string | null): boolean {
  return !!userId && request.approverId === userId;
}

/**
 * A solicitação aparece na lista: quem tem canApproveRequests vê todas; os
 * demais, as do próprio setor e as SCs em que são o aprovador.
 */
export function canSeeRequest(request: RequestForActions, viewer: RequestViewer): boolean {
  return viewer.canApproveRequests
    || request.department === viewer.department
    || isApproverOf(request, viewer.userId);
}
