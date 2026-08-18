import { describe, expect, it } from 'vitest';
import { getQuotationAmountFromRow } from './getQuotationAmountFromRow';

// Regra do "valor real" de uma linha de quotations — a mesma que a RPC
// quotation_record_decision aplica no SQL:
// COALESCE(selected_price, final_total_amount, estimated_total, 0).
// `??` (não `||`) porque R$0,00 é um valor legítimo e não pode cair para o
// próximo campo — semântica alinhada com getQuotationAmount.
describe('getQuotationAmountFromRow', () => {
  it('usa selected_price quando definido (linha legacy com preço negociado)', () => {
    expect(
      getQuotationAmountFromRow({ selected_price: 123.45, final_total_amount: 500, estimated_total: 1000 })
    ).toBe(123.45);
  });

  it('cai para final_total_amount quando não há selected_price', () => {
    expect(
      getQuotationAmountFromRow({ selected_price: null, final_total_amount: 500, estimated_total: 1000 })
    ).toBe(500);
  });

  it('cai para estimated_total quando não há preço final', () => {
    expect(
      getQuotationAmountFromRow({ selected_price: null, final_total_amount: null, estimated_total: 1000 })
    ).toBe(1000);
  });

  it('retorna 0 quando os três campos estão vazios', () => {
    expect(
      getQuotationAmountFromRow({ selected_price: null, final_total_amount: null, estimated_total: null })
    ).toBe(0);
  });

  it('trata selected_price de R$0,00 como valor legítimo (não cai para o final)', () => {
    expect(
      getQuotationAmountFromRow({ selected_price: 0, final_total_amount: 500, estimated_total: 1000 })
    ).toBe(0);
  });
});
