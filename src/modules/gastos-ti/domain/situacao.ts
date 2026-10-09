// Ocorrências de uma competência = previsão calculada (recorrência) cruzada com
// os lançamentos gravados (RN04, RN07, RN15, RN17). `hoje` sempre como argumento.

import { vencimentoNaCompetencia } from './competencia';
import { temOcorrenciaEm, valorVigente } from './recorrencia';
import type { Despesa, FormaPagamento, Lancamento, StatusLancamento } from '../types';

export type SituacaoOcorrencia = 'vencida' | 'a_vencer' | 'paga' | 'dispensada';

/** Ordem de exibição no Mês a mês: o que pede ação primeiro. */
export const ORDEM_SITUACAO: SituacaoOcorrencia[] = ['vencida', 'a_vencer', 'paga', 'dispensada'];

export interface OcorrenciaDoMes {
  /** `${despesaId}:${competencia}` — estável entre recargas, serve de chave e de seleção. */
  chave: string;
  despesa: Despesa;
  competencia: string;
  /** Da recorrência + reajustes; é contra ele que o desvio é medido (RN11). */
  previstoOriginal: number;
  vencimentoOriginal: string;
  /** Já com o ajuste do mês, quando houver lançamento (RN04 item 1). */
  valorPrevisto: number;
  vencimento: string;
  formaPagamento: FormaPagamento;
  lancamento: Lancamento | null;
  situacao: SituacaoOcorrencia;
  /** A previsão do mês foi mexida (valor, vencimento ou forma diferentes do calculado). */
  ajustada: boolean;
  /** Lançamento numa competência em que a despesa já não tem cobrança (RN17). */
  foraDaRecorrencia: boolean;
  /** Despesa variável ainda sem baixa: o valor é estimativa. */
  estimada: boolean;
}

/** RN07: paga/dispensada vêm do lançamento; sem eles, vencida se o vencimento já passou. */
export function situacaoDaOcorrencia(status: StatusLancamento | null, vencimento: string, hoje: string): SituacaoOcorrencia {
  if (status === 'pago') return 'paga';
  if (status === 'dispensado') return 'dispensada';
  return vencimento < hoje ? 'vencida' : 'a_vencer';
}

export function chaveOcorrencia(despesaId: string, competencia: string): string {
  return `${despesaId}:${competencia}`;
}

function montar(d: Despesa, competencia: string, lancamento: Lancamento | null, foraDaRecorrencia: boolean, hoje: string): OcorrenciaDoMes {
  const previstoOriginal = foraDaRecorrencia && lancamento ? lancamento.valorPrevisto : valorVigente(d, competencia);
  const vencimentoOriginal = foraDaRecorrencia && lancamento ? lancamento.vencimento : vencimentoNaCompetencia(competencia, d.diaVencimento);
  const valorPrevisto = lancamento?.valorPrevisto ?? previstoOriginal;
  const vencimento = lancamento?.vencimento ?? vencimentoOriginal;
  const formaPagamento = lancamento?.formaPagamento ?? d.formaPagamento;
  const situacao = situacaoDaOcorrencia(lancamento?.status ?? null, vencimento, hoje);
  return {
    chave: chaveOcorrencia(d.id, competencia),
    despesa: d,
    competencia,
    previstoOriginal,
    vencimentoOriginal,
    valorPrevisto,
    vencimento,
    formaPagamento,
    lancamento,
    situacao,
    ajustada:
      lancamento !== null &&
      !foraDaRecorrencia &&
      (valorPrevisto !== previstoOriginal || vencimento !== vencimentoOriginal || formaPagamento !== d.formaPagamento),
    foraDaRecorrencia,
    estimada: d.tipoValor === 'variavel' && (situacao === 'vencida' || situacao === 'a_vencer'),
  };
}

/**
 * Todas as ocorrências da competência, na ordem de ORDEM_SITUACAO, depois por
 * vencimento e descrição. Lançamento de despesa que não tem mais cobrança
 * nesta competência entra marcado como fora da recorrência — nunca some (RN17).
 */
export function montarOcorrenciasDoMes(
  despesas: readonly Despesa[],
  lancamentos: readonly Lancamento[],
  competencia: string,
  hoje: string,
): OcorrenciaDoMes[] {
  const lancamentoPorDespesa = new Map(
    lancamentos.filter((l) => l.competencia === competencia).map((l) => [l.despesaId, l]),
  );
  const ocorrencias: OcorrenciaDoMes[] = [];
  for (const d of despesas) {
    const lancamento = lancamentoPorDespesa.get(d.id) ?? null;
    if (temOcorrenciaEm(d, competencia)) ocorrencias.push(montar(d, competencia, lancamento, false, hoje));
    else if (lancamento) ocorrencias.push(montar(d, competencia, lancamento, true, hoje));
  }
  return ocorrencias.sort(
    (a, b) =>
      ORDEM_SITUACAO.indexOf(a.situacao) - ORDEM_SITUACAO.indexOf(b.situacao) ||
      a.vencimento.localeCompare(b.vencimento) ||
      a.despesa.descricao.localeCompare(b.despesa.descricao, 'pt-BR'),
  );
}

export interface TotaisDoMes {
  /** Tudo que se espera pagar no mês (dispensadas não entram). */
  previsto: number;
  pago: number;
  /** Ainda não pago: vencidas + a vencer. */
  emAberto: number;
  vencido: number;
  quantidade: Record<SituacaoOcorrencia, number>;
}

export function totaisDoMes(ocorrencias: readonly OcorrenciaDoMes[]): TotaisDoMes {
  const totais: TotaisDoMes = {
    previsto: 0,
    pago: 0,
    emAberto: 0,
    vencido: 0,
    quantidade: { vencida: 0, a_vencer: 0, paga: 0, dispensada: 0 },
  };
  for (const o of ocorrencias) {
    totais.quantidade[o.situacao] += 1;
    if (o.situacao !== 'dispensada') totais.previsto += o.valorPrevisto;
    if (o.situacao === 'paga') totais.pago += o.lancamento?.valorPago ?? 0;
    if (o.situacao === 'vencida' || o.situacao === 'a_vencer') totais.emAberto += o.valorPrevisto;
    if (o.situacao === 'vencida') totais.vencido += o.valorPrevisto;
  }
  return totais;
}
