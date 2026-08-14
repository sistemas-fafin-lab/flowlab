import { describe, expect, it } from 'vitest';
import { buildRequestImportDetails } from './RequestImportDetailsModal';
import type { Request, RequestItem } from '../../../types';

const requestItem = (overrides: Partial<RequestItem>): RequestItem => ({
  id: 'item-1',
  productId: null,
  productName: 'Produto',
  quantity: 1,
  category: 'general',
  ...overrides,
});

const request = (overrides: Partial<Request>): Request => ({
  id: 'REQ-001',
  type: 'SC',
  items: [requestItem({})],
  reason: 'Reposição de estoque',
  requestedBy: 'Maria Silva',
  requestDate: '2026-01-10',
  status: 'pending',
  priority: 'standard',
  ...overrides,
});

describe('buildRequestImportDetails', () => {
  it('inclui todos os itens da solicitação, não só os 3 primeiros', () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      requestItem({ id: `item-${i}`, productName: `Produto ${i}`, quantity: i + 1 })
    );

    const details = buildRequestImportDetails(request({ items }));

    expect(details.items).toHaveLength(5);
  });

  it('expõe solicitante, data e prioridade como campos', () => {
    const details = buildRequestImportDetails(
      request({ requestedBy: 'João Souza', requestDate: '2026-02-05', priority: 'urgent' })
    );

    expect(details.fields).toEqual(
      expect.arrayContaining([
        { label: 'Solicitante', value: 'João Souza' },
        { label: 'Prioridade', value: 'Urgente' },
      ])
    );
  });

  it('expõe a justificativa completa (reason)', () => {
    const details = buildRequestImportDetails(request({ reason: 'Motivo bem detalhado e completo' }));

    expect(details.justification).toEqual({
      label: 'Justificativa',
      value: 'Motivo bem detalhado e completo',
    });
  });

  it('inclui o tipo (SC/SM) e o status como badges', () => {
    const details = buildRequestImportDetails(request({ type: 'SM', status: 'approved' }));

    expect(details.badges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'SM' }),
        expect.objectContaining({ label: 'Aprovada' }),
      ])
    );
  });
});
