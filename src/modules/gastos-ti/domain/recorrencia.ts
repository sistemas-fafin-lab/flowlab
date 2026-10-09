// Recorrência → ocorrências previstas (D6: calculadas, nunca gravadas).
// Toda função recebe `hoje`/competências como argumento (RN14).

import { competenciaDaData, mesesEntre, somarMeses, vencimentoNaCompetencia } from './competencia';
import type { Recorrencia } from '../types';

/** O que a recorrência precisa de um reajuste (o `Reajuste` completo de types.ts satisfaz). */
export interface ReajusteVigencia {
  vigenteDesde: string;
  valor: number;
  quantidade?: number | null;
}

/** Meses entre duas ocorrências (RN01). Única = 0: uma ocorrência só. */
export const MESES_DO_CICLO: Record<Recorrencia, number> = {
  unica: 0,
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

/** O mínimo de uma despesa que a recorrência precisa. */
export interface DespesaRecorrente {
  id: string;
  valorBase: number;
  recorrencia: Recorrencia;
  competenciaInicio: string;
  competenciaFim: string | null;
  diaVencimento: number;
  reajustes: readonly ReajusteVigencia[];
}

export interface OcorrenciaPrevista {
  despesaId: string;
  competencia: string;
  /** 'YYYY-MM-DD' */
  vencimento: string;
  valorPrevisto: number;
}

export type SituacaoDespesa = 'futura' | 'ativa' | 'encerrada';

/** A despesa tem ocorrência nesta competência? */
export function temOcorrenciaEm(d: DespesaRecorrente, c: string): boolean {
  const desdeInicio = mesesEntre(d.competenciaInicio, c);
  if (desdeInicio < 0) return false;
  if (d.competenciaFim && c > d.competenciaFim) return false;
  const ciclo = MESES_DO_CICLO[d.recorrencia];
  if (ciclo === 0) return desdeInicio === 0;
  return desdeInicio % ciclo === 0;
}

/**
 * Valor previsto da despesa numa competência (RN04, itens 2 e 3): o reajuste
 * mais recente com vigência até ela; sem reajuste, o valor base. O ajuste de
 * uma ocorrência específica (item 1) entra na issue 07, sobre o resultado daqui.
 */
export function valorVigente(d: DespesaRecorrente, c: string): number {
  let vigente: ReajusteVigencia | null = null;
  for (const r of d.reajustes) {
    if (r.vigenteDesde <= c && (!vigente || r.vigenteDesde > vigente.vigenteDesde)) vigente = r;
  }
  return vigente ? vigente.valor : d.valorBase;
}

/**
 * Quantidade vigente (licenças, usuários) na competência: o reajuste mais
 * recente que mudou a quantidade; sem nenhum, a quantidade do cadastro.
 */
export function quantidadeVigente(
  quantidadeBase: number | null,
  reajustes: readonly ReajusteVigencia[],
  c: string,
): number | null {
  let vigente: ReajusteVigencia | null = null;
  for (const r of reajustes) {
    if (r.quantidade && r.vigenteDesde <= c && (!vigente || r.vigenteDesde > vigente.vigenteDesde)) vigente = r;
  }
  return vigente ? (vigente.quantidade as number) : quantidadeBase;
}

/** Ocorrências com competência entre `desde` e `ate` (inclusive), em ordem. */
export function ocorrenciasNoIntervalo(d: DespesaRecorrente, desde: string, ate: string): OcorrenciaPrevista[] {
  const fim = d.competenciaFim && d.competenciaFim < ate ? d.competenciaFim : ate;
  const ciclo = MESES_DO_CICLO[d.recorrencia];
  const ocorrencias: OcorrenciaPrevista[] = [];

  const montar = (c: string): OcorrenciaPrevista => ({
    despesaId: d.id,
    competencia: c,
    vencimento: vencimentoNaCompetencia(c, d.diaVencimento),
    valorPrevisto: valorVigente(d, c),
  });

  if (ciclo === 0) {
    const c = d.competenciaInicio;
    if (c >= desde && c <= fim) ocorrencias.push(montar(c));
    return ocorrencias;
  }

  // Primeira ocorrência >= desde, sem iterar desde o início do contrato.
  const atraso = mesesEntre(d.competenciaInicio, desde);
  const pulos = atraso > 0 ? Math.ceil(atraso / ciclo) : 0;
  for (let c = somarMeses(d.competenciaInicio, pulos * ciclo); c <= fim; c = somarMeses(c, ciclo)) {
    ocorrencias.push(montar(c));
  }
  return ocorrencias;
}

/**
 * Próxima ocorrência com vencimento a partir de hoje. A janela começa no mês
 * atual (ou no início da despesa, se for futura) e cobre 13 meses — o bastante
 * para a recorrência anual.
 */
export function proximaOcorrencia(d: DespesaRecorrente, hoje: string): OcorrenciaPrevista | null {
  const atual = competenciaDaData(hoje) as string;
  const desde = d.competenciaInicio > atual ? d.competenciaInicio : atual;
  return ocorrenciasNoIntervalo(d, desde, somarMeses(desde, 12)).find((o) => o.vencimento >= hoje) ?? null;
}

/**
 * Custo mensal equivalente na competência (RN05): valor vigente ÷ meses do
 * ciclo. Despesa única não tem equivalente (não entra no custo recorrente).
 */
export function equivalenteMensal(d: DespesaRecorrente, c: string): number | null {
  const ciclo = MESES_DO_CICLO[d.recorrencia];
  if (ciclo === 0) return null;
  return valorVigente(d, c) / ciclo;
}

/** Situação pelas datas (RN08) — a despesa não tem coluna de status. */
export function situacaoDespesa(d: DespesaRecorrente, competenciaAtual: string): SituacaoDespesa {
  if (d.competenciaInicio > competenciaAtual) return 'futura';
  const ultima = MESES_DO_CICLO[d.recorrencia] === 0 ? d.competenciaInicio : d.competenciaFim;
  if (ultima && ultima < competenciaAtual) return 'encerrada';
  return 'ativa';
}
