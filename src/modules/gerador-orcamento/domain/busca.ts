// Busca de exames do Gerador de Orçamento. Puro, para testar sem DOM.

import { filtrarOpcoes } from '../../../components/selectBusca';
import type { ItemGeradorOrcamento } from '../types';

/**
 * Os exames que casam com a busca, na ordem original. Mesma regra dos dropdowns
 * (filtrarOpcoes, src/components/selectBusca.ts): sem acento nem maiúsculas, e cada
 * palavra digitada precisa aparecer no nome ou no código TUSS — "hemo 4030" acha
 * "Hemograma · 40304361".
 */
export function filtrarExames(exames: readonly ItemGeradorOrcamento[], busca: string): ItemGeradorOrcamento[] {
  const opcoes = exames.map((exame) => ({ label: exame.nome, keywords: exame.tuss, exame }));
  return filtrarOpcoes(opcoes, busca).map((o) => o.exame);
}
