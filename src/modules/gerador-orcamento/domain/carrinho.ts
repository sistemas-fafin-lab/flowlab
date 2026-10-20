// Carrinho do Gerador de Orçamento. Puro, para testar sem DOM.
//
// A identidade de um exame é tuss + nome, não só o TUSS: a lista de preços pode
// trazer mais de um item por TUSS (ver ItemGeradorOrcamento).

import type { ItemCarrinho, ItemGeradorOrcamento } from '../types';

/** Chave estável de um exame da lista de preços (tuss + nome). */
export const chaveExame = (item: Pick<ItemGeradorOrcamento, 'tuss' | 'nome'>): string => `${item.tuss}::${item.nome}`;

/** Põe o exame no fim do carrinho com quantidade 1; se ele já está lá, nada muda. */
export function adicionarAoCarrinho(carrinho: readonly ItemCarrinho[], item: ItemGeradorOrcamento): ItemCarrinho[] {
  const chave = chaveExame(item);
  if (carrinho.some((c) => chaveExame(c.item) === chave)) return [...carrinho];
  return [...carrinho, { item, quantidade: 1 }];
}

/**
 * Troca a quantidade do exame de `chave`. Inteiro, no mínimo 1; um valor que não é
 * número (o campo apagado no meio da digitação) mantém a quantidade atual.
 */
export function alterarQuantidade(carrinho: readonly ItemCarrinho[], chave: string, quantidade: number): ItemCarrinho[] {
  if (!Number.isFinite(quantidade)) return [...carrinho];
  const nova = Math.max(1, Math.floor(quantidade));
  return carrinho.map((c) => (chaveExame(c.item) === chave ? { ...c, quantidade: nova } : c));
}

/** Tira do carrinho o exame de `chave`. */
export function removerDoCarrinho(carrinho: readonly ItemCarrinho[], chave: string): ItemCarrinho[] {
  return carrinho.filter((c) => chaveExame(c.item) !== chave);
}
