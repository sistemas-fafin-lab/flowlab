import type { RequestItem } from '../types';

export interface OutOfStockAlertItem {
  productName: string;
  quantity: number;
}

/**
 * Itens de uma solicitação sem produto cadastrado no estoque (fluxo de "produto
 * não cadastrado" em RequestManagement.tsx), sinal usado para o alerta por email
 * de produtos sem estoque em solicitações de compra.
 */
export function getOutOfStockItems(items: RequestItem[]): OutOfStockAlertItem[] {
  return items
    .filter((item) => item.productId === null)
    .map(({ productName, quantity }) => ({ productName, quantity }));
}
