// Busca "contém" com ILIKE literal (.scratch/contas-receber-busca-like).
//
// Duas camadas de escape, cada uma para um leitor diferente:
//   1. padraoContem — para o motor de LIKE do Postgres (escape padrão `\`):
//      `%` e `_` digitados pelo operador viram literais.
//   2. valorCitadoPostgrest — para o parser de valor citado do PostgREST,
//      dentro de `.or()`: ele consome a barra de toda sequência `\x` antes de
//      repassar ao Postgres, então as barras da camada 1 precisam ser dobradas.
// Fora do `.or()` (ex.: `.ilike(coluna, padrao)`), o valor não é citado e a
// camada 1 basta.

/** `%termo%` com `\`, `%` e `_` escapados para o LIKE. */
export function padraoContem(termo: string): string {
  return `%${termo.replace(/[\\%_]/g, '\\$&')}%`;
}

/** Valor citado de uma condição do `.or()` do PostgREST. As aspas protegem
 *  vírgula e parênteses do termo, que separariam as condições. */
export function valorCitadoPostgrest(valor: string): string {
  return `"${valor.replace(/[\\"]/g, '\\$&')}"`;
}
