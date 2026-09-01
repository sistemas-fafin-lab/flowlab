import { getQuotationAmountFromRow } from './getQuotationAmountFromRow';

type QuotationAmountRow = Parameters<typeof getQuotationAmountFromRow>[0];

/**
 * Mesmo critério de valor de getPermissions().canApprove em useQuotation.ts:
 * dentre linhas já filtradas por status "awaiting_approval", conta quantas o
 * usuário pode aprovar dado seu limite efetivo de alçada.
 */
export const countQuotationsAwaitingMyApproval = (
  rows: QuotationAmountRow[],
  maxAmount: number,
): number => rows.filter((row) => getQuotationAmountFromRow(row) <= maxAmount).length;
