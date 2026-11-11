// Conferência de cobertura do Gerador de Orçamento (ver CONTEXT.md). Puro, para testar sem DOM.
//
// Só diz se o convênio atende o exame (pelo nome da fonte pagadora em
// `conveniosAceitos`), sem valor negociado e sem mexer em preço ou desconto.

import type { ItemGeradorOrcamento } from '../types';
import { chaveExame } from './carrinho';

const ordemPtBr = (a: string, b: string) => a.localeCompare(b, 'pt-BR');

/** Os convênios que aparecem na lista, cada um uma vez, em ordem alfabética. */
export function conveniosDaLista(exames: readonly ItemGeradorOrcamento[]): string[] {
  return [...new Set(exames.flatMap((e) => e.conveniosAceitos))].sort(ordemPtBr);
}

/** Exame que o convênio escolhido não atende, com os outros convênios que atendem. */
export interface ExameNaoCoberto {
  exame: ItemGeradorOrcamento;
  outrosConvenios: string[];
}

export interface ResumoCobertura {
  cobertos: number;
  total: number;
  /** Falso na lista vazia; com `total` 0, a tela não mostra resumo nenhum (nem verde, nem "0 de 0"). */
  todosCobertos: boolean;
}

export interface ConferenciaCobertura {
  cobertos: ItemGeradorOrcamento[];
  naoCobertos: ExameNaoCoberto[];
  resumo: ResumoCobertura;
}

/**
 * Quais exames o `convenio` atende, na ordem em que vieram. A identidade do exame é
 * tuss + nome (chaveExame): o repetido conta uma vez, e dois nomes do mesmo TUSS são
 * dois exames.
 */
export function conferirCobertura(exames: readonly ItemGeradorOrcamento[], convenio: string): ConferenciaCobertura {
  const cobertos: ItemGeradorOrcamento[] = [];
  const naoCobertos: ExameNaoCoberto[] = [];
  const vistos = new Set<string>();
  for (const exame of exames) {
    const chave = chaveExame(exame);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    if (exame.conveniosAceitos.includes(convenio)) cobertos.push(exame);
    else naoCobertos.push({ exame, outrosConvenios: exame.conveniosAceitos.filter((c) => c !== convenio).sort(ordemPtBr) });
  }
  const total = cobertos.length + naoCobertos.length;
  return { cobertos, naoCobertos, resumo: { cobertos: cobertos.length, total, todosCobertos: total > 0 && cobertos.length === total } };
}
