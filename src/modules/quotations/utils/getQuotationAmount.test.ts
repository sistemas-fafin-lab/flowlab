import { describe, expect, it } from 'vitest';
import { getQuotationAmount } from './getQuotationAmount';

describe('getQuotationAmount', () => {
  it('usa o total final quando definido', () => {
    expect(getQuotationAmount({ finalTotalAmount: 123.45, estimatedTotalAmount: 500 })).toBe(123.45);
  });

  it('cai para o estimado quando não há total final', () => {
    expect(getQuotationAmount({ finalTotalAmount: undefined, estimatedTotalAmount: 500 })).toBe(500);
  });

  it('trata total final de R$0,00 como valor legítimo (não cai para o estimado)', () => {
    expect(getQuotationAmount({ finalTotalAmount: 0, estimatedTotalAmount: 500 })).toBe(0);
  });

  it('retorna o estimado quando ele também é zero', () => {
    expect(getQuotationAmount({ finalTotalAmount: undefined, estimatedTotalAmount: 0 })).toBe(0);
  });
});
