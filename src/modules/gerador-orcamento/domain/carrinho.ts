// Carrinho do Gerador de Orçamento. Puro, para testar sem DOM.
//
// A identidade de um exame é tuss + nome, não só o TUSS: a lista de preços pode
// trazer mais de um item por TUSS (ver ItemGeradorOrcamento). Serve aos dois modos
// do Gerador: o particular e o Tabela Colaborador.

import type { ExameDoCarrinho, ItemCarrinho } from '../types';

/** Chave estável de um exame da lista de preços (tuss + nome). */
export const chaveExame = (item: ExameDoCarrinho): string => `${item.tuss}::${item.nome}`;

/** Põe o exame no fim do carrinho com quantidade 1; se ele já está lá, nada muda. */
export function adicionarAoCarrinho<T extends ExameDoCarrinho>(carrinho: readonly ItemCarrinho<T>[], item: T): ItemCarrinho<T>[] {
  const chave = chaveExame(item);
  if (carrinho.some((c) => chaveExame(c.item) === chave)) return [...carrinho];
  return [...carrinho, { item, quantidade: 1 }];
}

/**
 * Troca a quantidade do exame de `chave`. Inteiro, no mínimo 1; um valor que não é
 * número (o campo apagado no meio da digitação) mantém a quantidade atual.
 */
export function alterarQuantidade<T extends ExameDoCarrinho>(
  carrinho: readonly ItemCarrinho<T>[],
  chave: string,
  quantidade: number,
): ItemCarrinho<T>[] {
  if (!Number.isFinite(quantidade)) return [...carrinho];
  const nova = Math.max(1, Math.floor(quantidade));
  return carrinho.map((c) => (chaveExame(c.item) === chave ? { ...c, quantidade: nova } : c));
}

/** Tira do carrinho o exame de `chave`. */
export function removerDoCarrinho<T extends ExameDoCarrinho>(carrinho: readonly ItemCarrinho<T>[], chave: string): ItemCarrinho<T>[] {
  return carrinho.filter((c) => chaveExame(c.item) !== chave);
}
