import { QuotationStatus, QuotationActionType } from '../types';

// ============================================
// WORKFLOW STATE MACHINE
// ============================================

/**
 * Defines valid transitions between quotation states.
 * Each status maps to an array of statuses it can transition to.
 */
export const VALID_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  draft: ['sent_to_suppliers', 'under_review', 'cancelled'],
  sent_to_suppliers: ['waiting_responses', 'under_review', 'draft', 'cancelled'],
  waiting_responses: ['under_review', 'sent_to_suppliers', 'cancelled'],
  under_review: ['awaiting_approval', 'waiting_responses', 'rejected', 'cancelled'],
  awaiting_approval: ['approved', 'under_review', 'rejected', 'cancelled'],
  approved: ['converted_to_purchase', 'awaiting_approval', 'cancelled'],
  rejected: ['draft'], // Can restart from draft
  converted_to_purchase: [], // Terminal state
  cancelled: ['draft'], // Can restart from draft
};

/**
 * Actions that trigger status transitions
 */
export const TRANSITION_ACTIONS: Record<QuotationActionType, { from: QuotationStatus[]; to: QuotationStatus } | null> = {
  created: null, // Initial state is always draft
  updated: null, // No status change
  sent_to_suppliers: { from: ['draft'], to: 'sent_to_suppliers' },
  supplier_response: null, // May trigger waiting_responses → under_review
  proposal_selected: null, // No direct status change
  proposal_rejected: null, // No direct status change
  submitted_for_approval: { from: ['under_review'], to: 'awaiting_approval' },
  approved: { from: ['awaiting_approval'], to: 'approved' },
  rejected: { from: ['awaiting_approval', 'under_review'], to: 'rejected' },
  escalated: null, // Stays in awaiting_approval but changes approval level
  converted_to_purchase: { from: ['approved'], to: 'converted_to_purchase' },
  cancelled: { from: ['draft', 'sent_to_suppliers', 'waiting_responses', 'under_review', 'awaiting_approval', 'approved'], to: 'cancelled' },
  comment_added: null,
  item_added: null,
  item_removed: null,
  supplier_added: null,
  supplier_removed: null,
};

/**
 * Checks if a transition from one status to another is valid
 */
export function canTransition(from: QuotationStatus, to: QuotationStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Maps each status to its logical previous (backward) step.
 * Only statuses that have a natural predecessor are included.
 */
export const BACKWARD_TRANSITIONS: Partial<Record<QuotationStatus, QuotationStatus>> = {
  sent_to_suppliers: 'draft',
  waiting_responses: 'sent_to_suppliers',
  under_review: 'waiting_responses',
  awaiting_approval: 'under_review',
  approved: 'awaiting_approval',
};

/**
 * Returns the previous status for a given status, or null if none.
 */
export function getPreviousStatus(status: QuotationStatus): QuotationStatus | null {
  return BACKWARD_TRANSITIONS[status] ?? null;
}

/**
 * Gets all valid next statuses from a given status
 */
export function getValidNextStatuses(from: QuotationStatus): QuotationStatus[] {
  return VALID_TRANSITIONS[from] ?? [];
}

/**
 * Checks if a status is terminal (no further transitions possible)
 */
export function isTerminalStatus(status: QuotationStatus): boolean {
  return VALID_TRANSITIONS[status]?.length === 0;
}

/**
 * Checks if the quotation can be edited in its current status
 */
export function canEditQuotation(status: QuotationStatus): boolean {
  return ['draft'].includes(status);
}

/**
 * Checks if items can be added/removed in current status
 */
export function canModifyItems(status: QuotationStatus): boolean {
  return ['draft', 'sent_to_suppliers', 'waiting_responses'].includes(status);
}

/**
 * Checks if suppliers can be added/removed in current status
 */
export function canModifySuppliers(status: QuotationStatus): boolean {
  return ['draft', 'sent_to_suppliers', 'waiting_responses'].includes(status);
}

/**
 * Checks if proposals can be received in current status
 */
export function canReceiveProposals(status: QuotationStatus): boolean {
  return ['draft', 'sent_to_suppliers', 'waiting_responses'].includes(status);
}

/**
 * Checks if a winner can be selected in current status
 */
export function canSelectWinner(status: QuotationStatus): boolean {
  return ['under_review', 'waiting_responses'].includes(status);
}

/**
 * Checks if the quotation can be submitted for approval
 */
export function canSubmitForApproval(status: QuotationStatus): boolean {
  return ['under_review'].includes(status);
}

/**
 * Checks if the quotation can be approved/rejected
 */
export function canApproveOrReject(status: QuotationStatus): boolean {
  return ['awaiting_approval'].includes(status);
}

/**
 * Checks if the quotation can be converted to purchase
 */
export function canConvertToPurchase(status: QuotationStatus): boolean {
  return ['approved'].includes(status);
}

/**
 * Checks if the quotation can be cancelled
 */
export function canCancel(status: QuotationStatus): boolean {
  return !['converted_to_purchase', 'cancelled'].includes(status);
}

/**
 * Gets the next automatic status based on conditions
 */
export function getAutoTransition(
  currentStatus: QuotationStatus,
  context: {
    allSuppliersResponded?: boolean;
    hasSelectedProposal?: boolean;
    allApprovalsComplete?: boolean;
  }
): QuotationStatus | null {
  switch (currentStatus) {
    case 'sent_to_suppliers':
      // Auto-transition when first supplier views the quotation
      return 'waiting_responses';
    
    case 'waiting_responses':
      // Auto-transition when all suppliers have responded
      if (context.allSuppliersResponded) {
        return 'under_review';
      }
      return null;
    
    default:
      return null;
  }
}

// ============================================
// WORKFLOW VALIDATION ERRORS
// ============================================

export type WorkflowError =
  | 'INVALID_TRANSITION'
  | 'NO_ITEMS'
  | 'NO_SUPPLIERS'
  | 'NO_PROPOSALS'
  | 'NO_SELECTED_WINNER'
  | 'PENDING_APPROVAL'
  | 'INSUFFICIENT_PERMISSION'
  | 'AMOUNT_EXCEEDS_LIMIT';

export interface WorkflowValidationResult {
  valid: boolean;
  errors: WorkflowError[];
  messages: string[];
}

/**
 * Validates if a quotation can transition to a new status
 */
export function validateTransition(
  from: QuotationStatus,
  to: QuotationStatus,
  context: {
    hasItems: boolean;
    hasSuppliers: boolean;
    hasProposals: boolean;
    hasSelectedWinner: boolean;
    hasPendingApprovals: boolean;
    userCanApprove: boolean;
    userApprovalLimit: number;
    quotationAmount: number;
  }
): WorkflowValidationResult {
  const errors: WorkflowError[] = [];
  const messages: string[] = [];

  // Check basic transition validity
  if (!canTransition(from, to)) {
    errors.push('INVALID_TRANSITION');
    messages.push(`Não é possível mudar de "${from}" para "${to}"`);
  }

  // Specific validations based on target status
  switch (to) {
    case 'sent_to_suppliers':
      if (!context.hasItems) {
        errors.push('NO_ITEMS');
        messages.push('A cotação precisa ter pelo menos um item');
      }
      if (!context.hasSuppliers) {
        errors.push('NO_SUPPLIERS');
        messages.push('A cotação precisa ter pelo menos um fornecedor convidado');
      }
      break;

    case 'under_review':
      if (!context.hasProposals) {
        errors.push('NO_PROPOSALS');
        messages.push('A cotação precisa ter pelo menos uma proposta recebida');
      }
      break;

    case 'awaiting_approval':
      if (!context.hasSelectedWinner) {
        errors.push('NO_SELECTED_WINNER');
        messages.push('É necessário selecionar uma proposta vencedora');
      }
      break;

    case 'approved':
      if (context.hasPendingApprovals) {
        errors.push('PENDING_APPROVAL');
        messages.push('Existem aprovações pendentes');
      }
      if (!context.userCanApprove) {
        errors.push('INSUFFICIENT_PERMISSION');
        messages.push('Você não tem permissão para aprovar esta cotação');
      }
      if (context.quotationAmount > context.userApprovalLimit) {
        errors.push('AMOUNT_EXCEEDS_LIMIT');
        messages.push(`O valor da cotação excede seu limite de aprovação (R$ ${context.userApprovalLimit.toLocaleString('pt-BR')})`);
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
    messages,
  };
}

// ============================================
// STATUS PROGRESS
// ============================================

export const STATUS_ORDER: QuotationStatus[] = [
  'draft',
  'sent_to_suppliers',
  'waiting_responses',
  'under_review',
  'awaiting_approval',
  'approved',
  'converted_to_purchase',
];

/**
 * Gets the progress percentage based on status
 */
export function getStatusProgress(status: QuotationStatus): number {
  if (status === 'rejected' || status === 'cancelled') {
    return 0;
  }
  
  const index = STATUS_ORDER.indexOf(status);
  if (index === -1) return 0;
  
  return Math.round((index / (STATUS_ORDER.length - 1)) * 100);
}

/**
 * Gets the step number for stepper component
 */
export function getStatusStep(status: QuotationStatus): number {
  if (status === 'rejected' || status === 'cancelled') {
    return -1;
  }
  
  return STATUS_ORDER.indexOf(status);
}
