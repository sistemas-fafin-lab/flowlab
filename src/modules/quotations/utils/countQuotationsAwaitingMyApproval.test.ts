import { describe, expect, it } from 'vitest';
import { countQuotationsAwaitingMyApproval } from './countQuotationsAwaitingMyApproval';

// Mesmo critério de valor de getPermissions().canApprove em useQuotation.ts:
// conta, dentre linhas já filtradas por status "awaiting_approval", quantas
// têm valor <= limite efetivo de alçada do usuário.
describe('countQuotationsAwaitingMyApproval', () => {
  it('conta apenas as cotações dentro do limite de alçada', () => {
    const rows = [
      { selected_price: null, final_total_amount: null, estimated_total: 1000 },
      { selected_price: null, final_total_amount: null, estimated_total: 6000 },
      { selected_price: null, final_total_amount: null, estimated_total: 5000 },
    ];

    expect(countQuotationsAwaitingMyApproval(rows, 5000)).toBe(2);
  });

  it('retorna 0 quando não há cotações', () => {
    expect(countQuotationsAwaitingMyApproval([], 5000)).toBe(0);
  });

  it('retorna 0 quando o limite de alçada é 0 (sem alçada)', () => {
    const rows = [{ selected_price: null, final_total_amount: null, estimated_total: 0 }];
    expect(countQuotationsAwaitingMyApproval(rows, 0)).toBe(1);
  });

  it('usa a mesma regra de precedência de valor (selected_price > final_total_amount > estimated_total)', () => {
    const rows = [
      { selected_price: 100, final_total_amount: 999999, estimated_total: 999999 },
    ];
    expect(countQuotationsAwaitingMyApproval(rows, 5000)).toBe(1);
  });

  it('respeita limite Infinity (alçada máxima)', () => {
    const rows = [{ selected_price: null, final_total_amount: null, estimated_total: 999999999 }];
    expect(countQuotationsAwaitingMyApproval(rows, Infinity)).toBe(1);
  });
});
