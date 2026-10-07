import { describe, expect, it } from 'vitest';
import {
  TRANSITION_ACTIONS,
  canApproveOrReject,
  canSelectWinner,
  canSubmitForApproval,
  canTransition,
  getPreviousStatus,
  getValidNextStatuses,
  getStatusStep,
  isManagerApprovalStage,
  isTerminalStatus,
} from './stateMachine';
import { QuotationStatus, QuotationStatusLabels } from '../types';

// Derivada dos rótulos (Record<QuotationStatus, …>) para que um status novo
// entre automaticamente nas asserções de predicados abaixo.
const ALL_STATUSES = Object.keys(QuotationStatusLabels) as QuotationStatus[];

/** Statuses para os quais um predicado devolve `true`, na ordem de ALL_STATUSES. */
const statusesWhere = (predicate: (status: QuotationStatus) => boolean) => ALL_STATUSES.filter(predicate);

describe('canTransition', () => {
  it.each<[QuotationStatus, QuotationStatus]>([
    ['draft', 'sent_to_suppliers'],
    ['under_review', 'awaiting_manager_approval'],
    ['awaiting_manager_approval', 'awaiting_approval'],
    ['awaiting_manager_approval', 'under_review'],
    ['awaiting_manager_approval', 'cancelled'],
    ['awaiting_approval', 'approved'],
    ['awaiting_approval', 'under_review'],
    ['awaiting_approval', 'rejected'],
    ['approved', 'converted_to_purchase'],
    ['approved', 'awaiting_approval'],
    ['rejected', 'draft'],
    ['cancelled', 'draft'],
  ])('permite %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each<[QuotationStatus, QuotationStatus]>([
    ['draft', 'approved'],
    ['under_review', 'approved'],
    ['under_review', 'awaiting_approval'],
    ['awaiting_manager_approval', 'approved'],
    ['awaiting_manager_approval', 'rejected'],
    ['awaiting_approval', 'converted_to_purchase'],
    ['approved', 'rejected'],
    ['rejected', 'approved'],
    ['converted_to_purchase', 'draft'],
    ['converted_to_purchase', 'cancelled'],
  ])('bloqueia %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('na etapa do gestor, só se segue para a alçada, volta para análise ou cancela', () => {
    expect(getValidNextStatuses('awaiting_manager_approval')).toEqual(['awaiting_approval', 'under_review', 'cancelled']);
  });

  it('na etapa de alçada, só se aprova, rejeita, cancela ou volta para análise', () => {
    expect(getValidNextStatuses('awaiting_approval')).toEqual(['approved', 'under_review', 'rejected', 'cancelled']);
  });

  it('trava a tabela completa de transições válidas', () => {
    expect(Object.fromEntries(ALL_STATUSES.map((status) => [status, getValidNextStatuses(status)]))).toEqual({
      draft: ['sent_to_suppliers', 'under_review', 'cancelled'],
      sent_to_suppliers: ['waiting_responses', 'under_review', 'draft', 'cancelled'],
      waiting_responses: ['under_review', 'sent_to_suppliers', 'cancelled'],
      under_review: ['awaiting_manager_approval', 'waiting_responses', 'rejected', 'cancelled'],
      awaiting_manager_approval: ['awaiting_approval', 'under_review', 'cancelled'],
      awaiting_approval: ['approved', 'under_review', 'rejected', 'cancelled'],
      approved: ['converted_to_purchase', 'awaiting_approval', 'cancelled'],
      rejected: ['draft'],
      converted_to_purchase: [],
      cancelled: ['draft'],
    });
  });
});

describe('TRANSITION_ACTIONS', () => {
  it('submeter leva de "em análise" para a etapa do gestor', () => {
    expect(TRANSITION_ACTIONS.submitted_for_manager_approval).toEqual({ from: ['under_review'], to: 'awaiting_manager_approval' });
  });

  it('a submissão direta para a alçada não existe mais (só no histórico legado)', () => {
    expect(TRANSITION_ACTIONS.submitted_for_approval).toBeNull();
  });

  it('o gestor aprova levando para a etapa de alçada', () => {
    expect(TRANSITION_ACTIONS.manager_approved).toEqual({ from: ['awaiting_manager_approval'], to: 'awaiting_approval' });
  });

  it('o gestor rejeita devolvendo para "em análise"', () => {
    expect(TRANSITION_ACTIONS.manager_rejected).toEqual({ from: ['awaiting_manager_approval'], to: 'under_review' });
  });

  it('aprovar só sai de "aguardando aprovação"', () => {
    expect(TRANSITION_ACTIONS.approved).toEqual({ from: ['awaiting_approval'], to: 'approved' });
  });

  it('rejeitar sai de "aguardando aprovação" ou de "em análise"', () => {
    expect(TRANSITION_ACTIONS.rejected).toEqual({ from: ['awaiting_approval', 'under_review'], to: 'rejected' });
  });

  it('converter em pedido só sai de "aprovada"', () => {
    expect(TRANSITION_ACTIONS.converted_to_purchase).toEqual({ from: ['approved'], to: 'converted_to_purchase' });
  });

  it('cancelar sai de qualquer status não terminal, exceto rejeitada e cancelada', () => {
    expect(TRANSITION_ACTIONS.cancelled).toEqual({
      from: ['draft', 'sent_to_suppliers', 'waiting_responses', 'under_review', 'awaiting_manager_approval', 'awaiting_approval', 'approved'],
      to: 'cancelled',
    });
  });

  it('toda transição por ação é também uma transição válida', () => {
    Object.values(TRANSITION_ACTIONS).forEach((action) => {
      action?.from.forEach((from) => expect(canTransition(from, action.to)).toBe(true));
    });
  });
});

describe('getPreviousStatus', () => {
  it.each<[QuotationStatus, QuotationStatus]>([
    ['sent_to_suppliers', 'draft'],
    ['waiting_responses', 'sent_to_suppliers'],
    ['under_review', 'waiting_responses'],
    ['awaiting_manager_approval', 'under_review'],
    ['awaiting_approval', 'under_review'],
    ['approved', 'awaiting_approval'],
  ])('reverter %s volta para %s', (status, previous) => {
    expect(getPreviousStatus(status)).toBe(previous);
  });

  it.each<QuotationStatus>(['draft', 'rejected', 'converted_to_purchase', 'cancelled'])(
    '%s não tem status anterior',
    (status) => {
      expect(getPreviousStatus(status)).toBeNull();
    },
  );
});

describe('isTerminalStatus', () => {
  it('só "convertida em pedido" é terminal', () => {
    expect(statusesWhere(isTerminalStatus)).toEqual(['converted_to_purchase']);
  });
});

describe('predicados de permissão por status', () => {
  it('só se submete para aprovação a partir de "em análise"', () => {
    expect(statusesWhere(canSubmitForApproval)).toEqual(['under_review']);
  });

  it('aprova-se ou rejeita-se nas duas etapas de aprovação', () => {
    expect(statusesWhere(canApproveOrReject)).toEqual(['awaiting_manager_approval', 'awaiting_approval']);
  });

  it('a vencedora pode ser trocada aguardando respostas, em análise e nas duas etapas de aprovação', () => {
    expect(statusesWhere(canSelectWinner)).toEqual([
      'waiting_responses',
      'under_review',
      'awaiting_manager_approval',
      'awaiting_approval',
    ]);
  });

  it('só "aprovação do gestor" é a etapa do gestor', () => {
    expect(statusesWhere(isManagerApprovalStage)).toEqual(['awaiting_manager_approval']);
  });
});

describe('getStatusStep', () => {
  it('a etapa do gestor fica entre "em análise" e "aguardando aprovação" no stepper', () => {
    expect(getStatusStep('awaiting_manager_approval')).toBe(getStatusStep('under_review') + 1);
    expect(getStatusStep('awaiting_approval')).toBe(getStatusStep('awaiting_manager_approval') + 1);
  });
});
