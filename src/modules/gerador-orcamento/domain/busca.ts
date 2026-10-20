// Busca de exames do Gerador de Orçamento. Puro, para testar sem DOM.

import { filtrarOpcoes } from '../../../components/selectBusca';
import type { ItemGeradorOrcamento } from '../types';

/**
 * O preço nos jeitos que o atendente digita: 1467 vira "1.467,00", "1467,00" e
 * "1467.00", cada um também colado ao "R$" ("R$1.467,00").
 */
function termosDoPreco(preco: number): string {
  const comVirgula = preco.toFixed(2).replace('.', ',');
  const comMilhar = preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formas = [...new Set([comMilhar, comVirgula, preco.toFixed(2)])];
  return [...formas, ...formas.map((f) => `r$${f}`)].join(' ');
}

/**
 * Os exames que casam com a busca, na ordem original. Mesma regra dos dropdowns
 * (filtrarOpcoes, src/components/selectBusca.ts): sem acento nem maiúsculas, e cada
 * palavra digitada precisa aparecer no nome, no código TUSS ou no preço — "hemo 4030"
 * acha "Hemograma · 40304361" e "R$ 38" acha o exame de R$ 38,00.
 */
export function filtrarExames(exames: readonly ItemGeradorOrcamento[], busca: string): ItemGeradorOrcamento[] {
  const opcoes = exames.map((exame) => ({
    label: exame.nome,
    keywords: `${exame.tuss} ${termosDoPreco(exame.preco)}`,
    exame,
  }));
  return filtrarOpcoes(opcoes, busca).map((o) => o.exame);
}
