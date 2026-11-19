// Domínio do Relatório mensal de EPI (CONTEXT.md, seção Estoque e Qualidade;
// .scratch/epi-relatorio-mensal/spec.md). Regras puras, sem banco e sem tela.

import type { CamposEpi, CopiaIdentificacaoEpi } from '../../../utils/epi.js';

/** O que o domínio precisa de um produto: o id e os campos de EPI do cadastro. */
export type ProdutoComIdentificacaoEpi = { id: string } & CamposEpi;

/**
 * Na finalização de uma solicitação de materiais, cada item cujo produto é EPI recebe a
 * cópia da Identificação do EPI vigente, para que uma troca de CA posterior não altere a
 * entrega. Itens sem produto cadastrado e de produtos que não são EPI ficam intactos.
 */
export function copiarIdentificacaoEpi<T extends { productId: string | null }>(
  itens: T[],
  produtos: ProdutoComIdentificacaoEpi[],
): (T & { identificacaoEpi?: CopiaIdentificacaoEpi })[] {
  const porId = new Map(produtos.map((p) => [p.id, p]));
  return itens.map((item) => {
    const produto = item.productId ? porId.get(item.productId) : undefined;
    if (!produto?.isEpi) return item;
    return {
      ...item,
      identificacaoEpi: {
        tipo: produto.epiTipo || null,
        numero: produto.epiNumero.trim() || null,
        validade: produto.epiValidade || null,
      },
    };
  });
}
