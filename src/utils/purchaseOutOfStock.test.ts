import { describe, expect, it } from 'vitest';
import { getOutOfStockItems } from './purchaseOutOfStock';
import type { RequestItem } from '../types';

const item = (overrides: Partial<RequestItem>): RequestItem => ({
  id: 'item-1',
  productId: null,
  productName: 'Produto',
  quantity: 1,
  category: 'general',
  ...overrides,
});

describe('getOutOfStockItems', () => {
  it('retorna itens sem produto cadastrado (productId null)', () => {
    const items = [item({ productId: null, productName: 'Luva M', quantity: 3 })];

    expect(getOutOfStockItems(items)).toEqual([{ productName: 'Luva M', quantity: 3 }]);
  });

  it('ignora itens com produto cadastrado no estoque', () => {
    const items = [item({ productId: 'produto-abc', productName: 'Álcool 70%', quantity: 2 })];

    expect(getOutOfStockItems(items)).toEqual([]);
  });

  it('mistura itens com e sem produto cadastrado, retornando só os sem estoque', () => {
    const items = [
      item({ id: 'a', productId: 'produto-abc', productName: 'Álcool 70%', quantity: 2 }),
      item({ id: 'b', productId: null, productName: 'Seringa 10ml', quantity: 5 }),
    ];

    expect(getOutOfStockItems(items)).toEqual([{ productName: 'Seringa 10ml', quantity: 5 }]);
  });

  it('retorna array vazio quando não há itens', () => {
    expect(getOutOfStockItems([])).toEqual([]);
  });
});
