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

/** Faixas do desconto, da maior para a menor; atinge a faixa quem bate um dos dois limites. */
const FAIXAS = [
  { percentual: 15, minElegiveis: 10, minValor: 1000 },
  { percentual: 10, minElegiveis: 5, minValor: 300 },
] as const;

type Faixa = (typeof FAIXAS)[number];

/** Exames elegíveis distintos (a quantidade não conta) e a soma deles (preço × quantidade). */
function somarElegiveis(itens: readonly ItemOrcamento[]) {
  const elegiveis = itens.filter((i) => i.elegivelDesconto);
  return {
    qtdElegiveis: elegiveis.length,
    valorElegiveis: elegiveis.reduce((acc, i) => acc + i.preco * i.quantidade, 0),
  };
}

const atingiu = (faixa: Faixa, qtdElegiveis: number, valorElegiveis: number) =>
  qtdElegiveis >= faixa.minElegiveis || valorElegiveis >= faixa.minValor;

/**
 * 15% sobre os elegíveis com 10+ elegíveis distintos ou R$1.000+ em elegíveis; senão
 * 10% com 5+ ou R$300+; senão 0. As faixas não se somam, e os não elegíveis nunca
 * recebem desconto nem contam para as faixas.
 */
export function calcularOrcamento(itens: readonly ItemOrcamento[]): ResultadoOrcamento {
  const { qtdElegiveis, valorElegiveis } = somarElegiveis(itens);

  const percentualAplicado: 0 | 10 | 15 =
    FAIXAS.find((f) => atingiu(f, qtdElegiveis, valorElegiveis))?.percentual ?? 0;

  const valorTotal = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
  const valorComDesconto = valorTotal - valorElegiveis * (percentualAplicado / 100);

  return { valorTotal, valorComDesconto, percentualAplicado, qtdElegiveis };
}

/** O que falta para a próxima faixa do desconto: basta um dos dois. */
export interface ProximaFaixa {
  percentual: 10 | 15;
  /** Exames elegíveis distintos que faltam (outra unidade do mesmo exame não conta). */
  faltamElegiveis: number;
  /** Valor em exames elegíveis que falta, em reais. */
  faltaValor: number;
  /** Quanto do caminho até a faixa já foi feito, de 0 a 1, pelo limite mais perto. */
  progresso: number;
}

/** A próxima faixa ainda não atingida, ou null quando o carrinho já está na de 15%. */
export function proximaFaixa(itens: readonly ItemOrcamento[]): ProximaFaixa | null {
  const { qtdElegiveis, valorElegiveis } = somarElegiveis(itens);
  const faixa = [...FAIXAS].reverse().find((f) => !atingiu(f, qtdElegiveis, valorElegiveis));
  if (!faixa) return null;
  return {
    percentual: faixa.percentual,
    faltamElegiveis: faixa.minElegiveis - qtdElegiveis,
    faltaValor: Math.round((faixa.minValor - valorElegiveis) * 100) / 100,
    progresso: Math.max(qtdElegiveis / faixa.minElegiveis, valorElegiveis / faixa.minValor),
  };
}

const itensDoCarrinho = (carrinho: readonly ItemCarrinho[]): ItemOrcamento[] =>
  carrinho.map((c) => ({
    preco: c.item.preco,
    quantidade: c.quantidade,
    elegivelDesconto: c.item.elegivelDescontoParticular,
  }));

/** Orçamento do carrinho, com a elegibilidade vinda da lista de preços. */
export function orcamentoDoCarrinho(carrinho: readonly ItemCarrinho[]): ResultadoOrcamento {
  return calcularOrcamento(itensDoCarrinho(carrinho));
}

/** Próxima faixa do desconto para o carrinho; null quando já está na de 15%. */
export function proximaFaixaDoCarrinho(carrinho: readonly ItemCarrinho[]): ProximaFaixa | null {
  return proximaFaixa(itensDoCarrinho(carrinho));
}
