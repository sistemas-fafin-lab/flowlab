import { describe, expect, it } from 'vitest';
import { filterQuotationsAwaitingMyManagerApproval } from './filterQuotationsAwaitingMyManagerApproval';
import { QuotationStatus } from '../types';

const row = (id: string, status: string, requesterManagerId?: string) =>
  ({ id, status: status as QuotationStatus, requesterManagerId });

describe('filterQuotationsAwaitingMyManagerApproval', () => {
  it('mantém só as cotações na etapa do gestor em que o usuário é o gestor do pedido', () => {
    const quotations = [
      row('minha', 'awaiting_manager_approval', 'eu'),
      row('de-outro-gestor', 'awaiting_manager_approval', 'outro'),
      row('na-alcada', 'awaiting_approval', 'eu'),
      row('em-analise', 'under_review', 'eu'),
      row('sem-gestor', 'awaiting_manager_approval'),
    ];

    expect(filterQuotationsAwaitingMyManagerApproval(quotations, 'eu').map((q) => q.id)).toEqual(['minha']);
  });

  it('sem usuário logado, não devolve nada (nem as cotações sem gestor)', () => {
    const quotations = [row('sem-gestor', 'awaiting_manager_approval')];
    expect(filterQuotationsAwaitingMyManagerApproval(quotations, undefined)).toEqual([]);
  });

  it('lista vazia quando não há pendências', () => {
    expect(filterQuotationsAwaitingMyManagerApproval([], 'eu')).toEqual([]);
  });
});
