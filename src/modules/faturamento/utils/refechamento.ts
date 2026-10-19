// Regras puras da aplicação do refechamento do lote no título
// (.scratch/faturamento-pendencias-e-refechamento/spec.md). A RPC
// fat_aplicar_refechamentos repete a mesma regra no servidor.

import { competenciaDaEmissao } from './atualizarAplis';

/** Competência do título depois que a emissão muda de `emissaoAntiga` para
 *  `emissaoNova`: acompanha só quando era o mês da emissão antiga. Uma
 *  competência escolhida diferente da emissão é ajuste do operador e fica. */
export function competenciaAposRefechamento(
  competencia: string,
  emissaoAntiga: string,
  emissaoNova: string,
): string {
  return competencia === competenciaDaEmissao(emissaoAntiga) ? competenciaDaEmissao(emissaoNova) : competencia;
}
