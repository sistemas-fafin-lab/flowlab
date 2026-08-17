/**
 * Valor efetivo da cotação: o total final negociado quando já definido,
 * senão o estimado. `??` (não `||`) porque um total final de R$0,00 é um
 * valor legítimo (ex.: item doado, desconto integral) e não deve cair para
 * o estimado.
 */
export const getQuotationAmount = (quotation: { finalTotalAmount?: number; estimatedTotalAmount: number }): number =>
  quotation.finalTotalAmount ?? quotation.estimatedTotalAmount;
