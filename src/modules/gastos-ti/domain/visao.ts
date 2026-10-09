// Visões do dashboard (RF24, RF26). A base de tudo é a COBRANÇA: o mês a que a
// cobrança se refere (a mesma do Mês a mês). As outras duas visões não
// recalculam nada — remapeiam as ocorrências para outro mês e devolvem
// ocorrências "virtuais" que as funções de `finops.ts` somam como sempre.

import { competenciaDaData, somarMeses } from './competencia';
import { MARGEM_VISOES, competenciasEntre, custoRecorrenteMensal, ocorrenciasNoPeriodo } from './finops';
import { MESES_DO_CICLO, equivalenteMensal, situacaoDespesa, valorVigente, type SituacaoDespesa } from './recorrencia';
import type { OcorrenciaDoMes } from './situacao';
import type { Despesa, Lancamento } from '../types';

export type VisaoGasto = 'cobranca' | 'caixa' | 'diluida';

/**
 * Caixa: a cobrança paga entra no mês em que foi paga; a não paga, no mês do
 * vencimento (é quando o dinheiro deve sair). Dispensada não tem valor e fica
 * onde está.
 */
export function competenciaDeCaixa(o: OcorrenciaDoMes): string {
  if (o.situacao === 'dispensada') return o.competencia;
  if (o.situacao === 'paga' && o.lancamento?.pagoEm) return competenciaDaData(o.lancamento.pagoEm) as string;
  return competenciaDaData(o.vencimento) as string;
}

/**
 * Diluída: a cobrança de um ciclo de N meses vira N fatias iguais, uma por mês
 * do ciclo, a partir da competência (anual paga em janeiro = 1/12 em cada mês
 * do ano). Mensal e única ficam inteiras; lançamento fora da recorrência também
 * (não tem ciclo a que pertencer).
 */
export function diluirOcorrencia(o: OcorrenciaDoMes): OcorrenciaDoMes[] {
  const n = MESES_DO_CICLO[o.despesa.recorrencia];
  if (n <= 1 || o.foraDaRecorrencia) return [o];
  const lancamento = o.lancamento
    ? { ...o.lancamento, valorPrevisto: o.lancamento.valorPrevisto / n, valorPago: o.lancamento.valorPago === null ? null : o.lancamento.valorPago / n }
    : null;
  return Array.from({ length: n }, (_, k) => ({
    ...o,
    chave: `${o.chave}#${k + 1}`,
    competencia: somarMeses(o.competencia, k),
    previstoOriginal: o.previstoOriginal / n,
    valorPrevisto: o.valorPrevisto / n,
    lancamento,
  }));
}

/**
 * Ocorrências dos `meses` na visão escolhida. Caixa e diluída geram as
 * cobranças com a margem de `MARGEM_VISOES` em volta e ficam só com as que
 * caem nos meses pedidos.
 */
export function ocorrenciasNaVisao(
  visao: VisaoGasto,
  despesas: readonly Despesa[],
  lancamentos: readonly Lancamento[],
  meses: readonly string[],
  hoje: string,
): OcorrenciaDoMes[] {
  if (meses.length === 0) return [];
  if (visao === 'cobranca') return ocorrenciasNoPeriodo(despesas, lancamentos, meses, hoje);
  const alvo = new Set(meses);
  const base = comMargem(despesas, lancamentos, meses, hoje);
  const remapeadas = visao === 'caixa' ? base.map((o) => ({ ...o, competencia: competenciaDeCaixa(o) })) : base.flatMap(diluirOcorrencia);
  return remapeadas.filter((o) => alvo.has(o.competencia));
}

/**
 * As cobranças REAIS (inteiras, no mês a que se referem) por trás dos meses na
 * visão — para o detalhamento e a exportação, que listam cobranças, não fatias.
 * Caixa: as pagas (ou a vencer) nesses meses. Cobrança e diluída: as dos meses.
 */
export function cobrancasNaVisao(
  visao: VisaoGasto,
  despesas: readonly Despesa[],
  lancamentos: readonly Lancamento[],
  meses: readonly string[],
  hoje: string,
): OcorrenciaDoMes[] {
  if (meses.length === 0) return [];
  if (visao !== 'caixa') return ocorrenciasNoPeriodo(despesas, lancamentos, meses, hoje);
  const alvo = new Set(meses);
  return comMargem(despesas, lancamentos, meses, hoje).filter((o) => alvo.has(competenciaDeCaixa(o)));
}

const comMargem = (despesas: readonly Despesa[], lancamentos: readonly Lancamento[], meses: readonly string[], hoje: string) =>
  ocorrenciasNoPeriodo(
    despesas,
    lancamentos,
    competenciasEntre(somarMeses(meses[0], -MARGEM_VISOES.antes), somarMeses(meses[meses.length - 1], MARGEM_VISOES.depois)),
    hoje,
  );

// ─── Drill-down (RF26) ────────────────────────────────────────────────────────

export interface DespesaDoResumo {
  despesa: Despesa;
  /** Equivalente mensal (recorrente) ou valor da cobrança (única). */
  valor: number;
  mensal: boolean;
  situacao: SituacaoDespesa;
}

export interface ResumoItem {
  /** Pago por mês nos 12 meses até o atual (base cobrança). */
  serie: number[];
  totalDozeMeses: number;
  recorrenteMensal: number;
  /** Ativas primeiro, depois futuras e encerradas; dentro de cada grupo, a mais cara primeiro. */
  despesas: DespesaDoResumo[];
}

const ORDEM_SITUACAO: Record<SituacaoDespesa, number> = { ativa: 0, futura: 1, encerrada: 2 };

/** Resumo do item clicado no drill-down, sobre as despesas já filtradas por ele. */
export function resumoDoItem(despesas: readonly Despesa[], lancamentos: readonly Lancamento[], hoje: string): ResumoItem {
  const atual = competenciaDaData(hoje) as string;
  const meses = competenciasEntre(somarMeses(atual, -11), atual);
  const indice = new Map(meses.map((m, i) => [m, i]));
  const serie = meses.map(() => 0);
  for (const o of ocorrenciasNoPeriodo(despesas, lancamentos, meses, hoje)) {
    const i = indice.get(o.competencia);
    if (i !== undefined && o.situacao === 'paga') serie[i] += o.lancamento?.valorPago ?? 0;
  }
  const lista = despesas
    .map((d): DespesaDoResumo => {
      const mensal = equivalenteMensal(d, atual);
      return {
        despesa: d,
        valor: mensal ?? valorVigente(d, d.competenciaInicio),
        mensal: mensal !== null,
        situacao: situacaoDespesa(d, atual),
      };
    })
    .sort((a, b) => ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao] || b.valor - a.valor || a.despesa.descricao.localeCompare(b.despesa.descricao, 'pt-BR'));
  return {
    serie,
    totalDozeMeses: serie.reduce((s, v) => s + v, 0),
    recorrenteMensal: custoRecorrenteMensal(despesas, lancamentos, hoje),
    despesas: lista,
  };
}
