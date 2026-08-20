/**
 * Único ponto do frontend que lê o ano corrente do relógio — só para decidir
 * qual ano o seletor de período mostra abertura (nenhum período é
 * pré-selecionado; a consulta só roda quando a pessoa clica um mês, P4).
 */
export function anoAtual(): number {
  return new Date().getFullYear();
}
