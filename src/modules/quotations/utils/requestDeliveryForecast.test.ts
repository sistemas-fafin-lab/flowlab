import { describe, expect, it } from 'vitest';
import { computeRequestDeliveryForecast, DeliveryForecastQuotationRow } from './requestDeliveryForecast';

const makeRow = (overrides: Partial<DeliveryForecastQuotationRow> = {}): DeliveryForecastQuotationRow => ({
  request_id: 'REQ100',
  status: 'approved',
  selected_proposal_id: 'p1',
  converted_to_purchase_at: null,
  quotation_approvals: [{ status: 'approved', approved_at: '2026-10-01T12:00:00Z' }],
  quotation_proposals: [
    { id: 'p1', is_winner: true, average_delivery_days: 5, quotation_proposal_items: [] },
    { id: 'p2', is_winner: false, average_delivery_days: 1, quotation_proposal_items: [] },
  ],
  ...overrides,
});

describe('computeRequestDeliveryForecast', () => {
  it('soma o prazo da proposta vencedora à data de aprovação', () => {
    expect(computeRequestDeliveryForecast([makeRow()]).get('REQ100')).toBe('2026-10-06');
  });

  it('prefere a data de conversão em compra à data de aprovação', () => {
    const row = makeRow({ converted_to_purchase_at: '2026-10-03T12:00:00Z', status: 'converted_to_purchase' });
    expect(computeRequestDeliveryForecast([row]).get('REQ100')).toBe('2026-10-08');
  });

  it('usa o maior prazo dos itens quando a proposta não tem prazo médio', () => {
    const row = makeRow({
      quotation_proposals: [{
        id: 'p1', is_winner: false, average_delivery_days: null,
        quotation_proposal_items: [{ delivery_days: 2 }, { delivery_days: 10 }, { delivery_days: null }],
      }],
    });
    expect(computeRequestDeliveryForecast([row]).get('REQ100')).toBe('2026-10-11');
  });

  it('com várias cotações na mesma solicitação, vale a entrega mais tardia', () => {
    const rows = [
      makeRow(),
      makeRow({ quotation_proposals: [{ id: 'p1', is_winner: true, average_delivery_days: 20, quotation_proposal_items: [] }] }),
    ];
    expect(computeRequestDeliveryForecast(rows).get('REQ100')).toBe('2026-10-21');
  });

  it('ignora cotações não aprovadas, sem vencedora ou sem prazo', () => {
    const rows = [
      makeRow({ status: 'awaiting_approval' }),
      makeRow({ request_id: 'REQ101', selected_proposal_id: null, quotation_proposals: [{ id: 'p9', is_winner: false, average_delivery_days: 3, quotation_proposal_items: [] }] }),
      makeRow({ request_id: 'REQ102', quotation_approvals: [{ status: 'pending', approved_at: null }] }),
    ];
    expect(computeRequestDeliveryForecast(rows).size).toBe(0);
  });
});
