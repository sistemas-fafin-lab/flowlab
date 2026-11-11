// Conferência de cobertura do Gerador de Orçamento (ver CONTEXT.md). Puro, para testar sem DOM.
//
// Só diz se a fonte pagadora — ou um convênio dela (tabela associada) — atende o exame,
// pelos pares de `coberturaConvenios`, sem valor negociado e sem mexer em preço ou desconto.

import type { CoberturaConvenio, ItemGeradorOrcamento } from '../types';
import { chaveExame } from './carrinho';

const ordemPtBr = (a: string, b: string) => a.localeCompare(b, 'pt-BR');

/** O que se confere: a fonte pagadora e, opcionalmente, um convênio dela. Sem convênio, vale qualquer um da fonte. */
export interface EscolhaCobertura {
  fonte: string;
  convenio: string | null;
}

/** Nome da escolha nas frases da tela: "AMHP-DF" ou "AMHP-DF · BACEN". */
export function nomeDaEscolha({ fonte, convenio }: EscolhaCobertura): string {
  return convenio ? `${fonte} · ${convenio}` : fonte;
}

/** As fontes pagadoras que aparecem na lista, cada uma uma vez, em ordem alfabética. */
export function fontesDaLista(exames: readonly ItemGeradorOrcamento[]): string[] {
  return [...new Set(exames.flatMap((e) => e.coberturaConvenios.map((c) => c.fonte)))].sort(ordemPtBr);
}

/** Os convênios (tabelas associadas) de uma fonte que aparecem na lista, como cadastrados, em ordem alfabética. */
export function conveniosDaFonte(exames: readonly ItemGeradorOrcamento[], fonte: string): string[] {
  const convenios = exames.flatMap((e) => e.coberturaConvenios.filter((c) => c.fonte === fonte).map((c) => c.convenio));
  return [...new Set(convenios)].sort(ordemPtBr);
}

/** Os convênios de uma fonte que atendem um exame. */
export interface ConveniosDaFonte {
  fonte: string;
  convenios: string[];
}

/** Exame que a escolha não atende, com os convênios que o atendem, agrupados por fonte. */
export interface ExameNaoCoberto {
  exame: ItemGeradorOrcamento;
  outrosConvenios: ConveniosDaFonte[];
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

const atende = ({ fonte, convenio }: EscolhaCobertura) => (c: CoberturaConvenio) =>
  c.fonte === fonte && (convenio === null || c.convenio === convenio);

/** Pares agrupados por fonte, fontes e convênios em ordem alfabética. */
function agruparPorFonte(pares: readonly CoberturaConvenio[]): ConveniosDaFonte[] {
  const porFonte = new Map<string, Set<string>>();
  for (const { fonte, convenio } of pares) porFonte.set(fonte, (porFonte.get(fonte) ?? new Set()).add(convenio));
  return [...porFonte]
    .sort(([a], [b]) => ordemPtBr(a, b))
    .map(([fonte, convenios]) => ({ fonte, convenios: [...convenios].sort(ordemPtBr) }));
}

/**
 * Quais exames a escolha atende, na ordem em que vieram. A identidade do exame é
 * tuss + nome (chaveExame): o repetido conta uma vez, e dois nomes do mesmo TUSS são
 * dois exames. Num não coberto nenhum par casa com a escolha, então os "outros
 * convênios" são todos os que atendem o exame.
 */
export function conferirCobertura(
  exames: readonly ItemGeradorOrcamento[],
  escolha: EscolhaCobertura,
): ConferenciaCobertura {
  const cobertos: ItemGeradorOrcamento[] = [];
  const naoCobertos: ExameNaoCoberto[] = [];
  const vistos = new Set<string>();
  const atendeEscolha = atende(escolha);
  for (const exame of exames) {
    const chave = chaveExame(exame);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    if (exame.coberturaConvenios.some(atendeEscolha)) cobertos.push(exame);
    else naoCobertos.push({ exame, outrosConvenios: agruparPorFonte(exame.coberturaConvenios) });
  }
  const total = cobertos.length + naoCobertos.length;
  return { cobertos, naoCobertos, resumo: { cobertos: cobertos.length, total, todosCobertos: total > 0 && cobertos.length === total } };
}
