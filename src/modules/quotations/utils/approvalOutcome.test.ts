import { describe, expect, it } from 'vitest';
import { approvalsAfterRevert, getApprovalSuccessMessage } from './approvalOutcome';
import { QuotationApproval } from '../types';

const approval = (level: QuotationApproval['level'], overrides: Partial<QuotationApproval> = {}): QuotationApproval => ({
  id: `id-${level}`,
  quotationId: 'q1',
  level,
  status: 'approved',
  amount: 1000,
  createdAt: '2026-10-07T12:00:00.000Z',
  ...overrides,
});

describe('getApprovalSuccessMessage', () => {
  it('aprovação que concluiu a cotação (alçada, ou gestor com alçada)', () => {
    expect(getApprovalSuccessMessage('approved')).toBe('Cotação aprovada com sucesso!');
  });

  it('aprovação do gestor que seguiu para a alçada', () => {
    expect(getApprovalSuccessMessage('awaiting_approval')).toBe(
      'Aprovação do gestor registrada! A cotação seguiu para a aprovação por alçada.',
    );
  });
});

describe('approvalsAfterRevert', () => {
  const manager = approval('manager');
  const alcada = approval('level_2');
  const earlierRejection = approval('level_1', { status: 'rejected' });

  it('voltando para a alçada, apaga só a linha de alçada e mantém a do gestor', () => {
    expect(approvalsAfterRevert([manager, alcada], 'level_2', 'awaiting_approval')).toEqual([manager]);
  });

  it('voltando para a etapa do gestor (alçada dispensada), apaga as duas linhas', () => {
    expect(approvalsAfterRevert([manager, alcada], 'level_2', 'awaiting_manager_approval')).toEqual([]);
  });

  it('linhas de outros níveis de alçada continuam no histórico', () => {
    expect(approvalsAfterRevert([earlierRejection, manager, alcada], 'level_2', 'awaiting_manager_approval')).toEqual([
      earlierRejection,
    ]);
  });
});
