// Cálculo do Orçamento com o Desconto automático por volume. Puro, para testar sem
// DOM; tela e PDFs consomem o mesmo resultado. Portado de
// Tabela-Particular/lib/alvaro-orcamento/pricing.ts, com as mesmas regras.

import type { ItemCarrinho } from '../types';

export interface ItemOrcamento {
  preco: number;
  quantidade: number;
  elegivelDesconto: boolean;
}

export interface ResultadoOrcamento {
  valorTotal: number;
  valorComDesconto: number;
  percentualAplicado: 0 | 10 | 15;
  /** Exames elegíveis distintos: a quantidade de cada um não conta. */
  qtdElegiveis: number;
}

/**
 * 15% sobre os elegíveis com 10+ elegíveis distintos ou R$1.000+ em elegíveis; senão
 * 10% com 5+ ou R$300+; senão 0. As faixas não se somam, e os não elegíveis nunca
 * recebem desconto nem contam para as faixas.
 */
export function calcularOrcamento(itens: readonly ItemOrcamento[]): ResultadoOrcamento {
  const elegiveis = itens.filter((i) => i.elegivelDesconto);
  const qtdElegiveis = elegiveis.length;
  const valorElegiveis = elegiveis.reduce((acc, i) => acc + i.preco * i.quantidade, 0);

  const percentualAplicado: 0 | 10 | 15 =
    qtdElegiveis >= 10 || valorElegiveis >= 1000 ? 15 : qtdElegiveis >= 5 || valorElegiveis >= 300 ? 10 : 0;

  const valorTotal = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
  const valorComDesconto = valorTotal - valorElegiveis * (percentualAplicado / 100);

  return { valorTotal, valorComDesconto, percentualAplicado, qtdElegiveis };
}

/** Orçamento do carrinho, com a elegibilidade vinda da lista de preços. */
export function orcamentoDoCarrinho(carrinho: readonly ItemCarrinho[]): ResultadoOrcamento {
  return calcularOrcamento(
    carrinho.map((c) => ({
      preco: c.item.preco,
      quantidade: c.quantidade,
      elegivelDesconto: c.item.elegivelDescontoParticular,
    })),
  );
}
