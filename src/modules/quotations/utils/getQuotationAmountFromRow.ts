// Valor real de uma linha de quotations vinda do banco (snake_case) — a
// mesma regra que a RPC quotation_record_decision aplica no SQL:
// COALESCE(selected_price, final_total_amount, estimated_total, 0).
//
// selected_price vem primeiro porque linhas legacy do fluxo antigo
// (selectQuotationWinner em useInventory.ts) gravam só esse campo; sem ele
// aqui, o client mandaria um p_max_amount diferente do que a RPC valida e a
// decisão falharia com 22023 sem culpa do usuário.
//
// `??` (não `||`) porque R$0,00 é um valor legítimo — mesma semântica
// documentada em getQuotationAmount.
export const getQuotationAmountFromRow = (row: {
  selected_price?: number | null;
  final_total_amount?: number | null;
  estimated_total?: number | null;
}): number =>
  row.selected_price ?? row.final_total_amount ?? row.estimated_total ?? 0;
