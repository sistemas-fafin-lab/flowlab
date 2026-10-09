// Orçamento anual por categoria (RF23, RN13): orçado × realizado, consumo do
// ano e alertas. Base do realizado: competência, como o resto do dashboard.

import { formatCurrency } from '../../../utils/paymentUtils';
import type { Alerta } from './alertas';
import { competenciaDaData, partesCompetencia } from './competencia';
import type { Despesa, Lancamento, Orcamento } from '../types';

/** A partir de 90% consumido, atenção; acima de 100%, estourado. */
export const LIMITE_ATENCAO = 90;

export type StatusConsumo = 'sem_orcamento' | 'ok' | 'atencao' | 'estourado';

export function statusConsumo(percentual: number | null): StatusConsumo {
  if (percentual === null) return 'sem_orcamento';
  if (percentual > 100) return 'estourado';
  if (percentual >= LIMITE_ATENCAO) return 'atencao';
  return 'ok';
}

const doAno = (orcamentos: readonly Orcamento[], ano: number, categorias: ReadonlySet<string> | null) =>
  orcamentos.filter((o) => o.ano === ano && (!categorias || categorias.has(o.categoriaId)));

/**
 * Orçamento mensal de cada mês (RN13: anual ÷ 12), alinhado com `meses`.
 * null quando o ano daquele mês não tem orçamento nenhum (a linha do gráfico
 * fica em branco, em vez de cair para zero e parecer "orçamento zero").
 */
export function orcadoPorMes(orcamentos: readonly Orcamento[], meses: readonly string[], categorias: ReadonlySet<string> | null = null): (number | null)[] {
  return meses.map((m) => {
    const doMes = doAno(orcamentos, partesCompetencia(m).ano, categorias);
    return doMes.length === 0 ? null : doMes.reduce((s, o) => s + o.valorAnual, 0) / 12;
  });
}

/** Soma dos orçamentos mensais do período; null se nenhum mês do período tem orçamento. */
export function orcadoNoPeriodo(orcamentos: readonly Orcamento[], meses: readonly string[], categorias: ReadonlySet<string> | null = null): number | null {
  const porMes = orcadoPorMes(orcamentos, meses, categorias);
  return porMes.every((v) => v === null) ? null : porMes.reduce<number>((s, v) => s + (v ?? 0), 0);
}

/** Valor pago por categoria nas competências do ano (lançamentos pagos, ligados à despesa). */
export function realizadoPorCategoria(lancamentos: readonly Lancamento[], despesas: readonly Despesa[], ano: number): Map<string, number> {
  const categoriaDa = new Map(despesas.map((d) => [d.id, d.categoriaId]));
  const somas = new Map<string, number>();
  for (const l of lancamentos) {
    if (l.status !== 'pago' || l.valorPago === null || partesCompetencia(l.competencia).ano !== ano) continue;
    const categoria = categoriaDa.get(l.despesaId);
    if (categoria) somas.set(categoria, (somas.get(categoria) ?? 0) + l.valorPago);
  }
  return somas;
}

export interface ConsumoCategoria {
  categoriaId: string;
  nome: string;
  orcado: number | null;
  realizado: number;
  percentual: number | null;
  status: StatusConsumo;
}

/**
 * Orçado × realizado por categoria no ano. Primeiro as que têm orçamento, da
 * mais consumida para a menos; no fim, as que gastaram sem orçamento.
 */
export function orcadoRealizadoPorCategoria(
  orcamentos: readonly Orcamento[],
  realizado: ReadonlyMap<string, number>,
  ano: number,
  nomeCategoria: (id: string) => string,
): ConsumoCategoria[] {
  const comOrcamento = doAno(orcamentos, ano, null).map((o): ConsumoCategoria => {
    const gasto = realizado.get(o.categoriaId) ?? 0;
    const percentual = o.valorAnual > 0 ? (gasto / o.valorAnual) * 100 : gasto > 0 ? Infinity : 0;
    return { categoriaId: o.categoriaId, nome: nomeCategoria(o.categoriaId), orcado: o.valorAnual, realizado: gasto, percentual, status: statusConsumo(percentual) };
  });
  const orcadas = new Set(comOrcamento.map((c) => c.categoriaId));
  const semOrcamento = [...realizado.entries()]
    .filter(([id, valor]) => !orcadas.has(id) && valor > 0)
    .map(([id, valor]): ConsumoCategoria => ({ categoriaId: id, nome: nomeCategoria(id), orcado: null, realizado: valor, percentual: null, status: 'sem_orcamento' }))
    .sort((a, b) => b.realizado - a.realizado);
  return [...comOrcamento.sort((a, b) => (b.percentual ?? 0) - (a.percentual ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR')), ...semOrcamento];
}

export interface ConsumoAno {
  orcado: number | null;
  realizado: number;
  percentual: number | null;
  /** % do ano já decorrido (o "ritmo" esperado de consumo): 100 para ano passado, 0 para ano futuro. */
  ritmo: number;
  status: StatusConsumo;
}

/** Consumo do orçamento no ano: realizado até agora ÷ orçamento do ano inteiro. */
export function consumoDoAno(
  orcamentos: readonly Orcamento[],
  realizado: ReadonlyMap<string, number>,
  ano: number,
  hoje: string,
  categorias: ReadonlySet<string> | null = null,
): ConsumoAno {
  const doAnoFiltrado = doAno(orcamentos, ano, categorias);
  const orcado = doAnoFiltrado.length === 0 ? null : doAnoFiltrado.reduce((s, o) => s + o.valorAnual, 0);
  const gasto = [...realizado.entries()].filter(([id]) => !categorias || categorias.has(id)).reduce((s, [, v]) => s + v, 0);
  const { ano: anoAtual, mes } = partesCompetencia(competenciaDaData(hoje) as string);
  const ritmo = ano < anoAtual ? 100 : ano > anoAtual ? 0 : (mes / 12) * 100;
  const percentual = orcado === null ? null : orcado > 0 ? (gasto / orcado) * 100 : gasto > 0 ? Infinity : 0;
  return { orcado, realizado: gasto, percentual, ritmo, status: statusConsumo(percentual) };
}

/** Alerta de categoria com orçamento a partir de 90% (média) ou estourado (alta). */
export function alertasDeOrcamento(consumos: readonly ConsumoCategoria[], ano: number): Alerta[] {
  return consumos
    .filter((c) => c.status === 'atencao' || c.status === 'estourado')
    .map((c) => {
      const pct = c.percentual === Infinity ? 'sem orçamento previsto' : `${(c.percentual ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`;
      return {
        chave: `orcamento:${ano}:${c.categoriaId}`,
        tipo: 'orcamento' as const,
        severidade: c.status === 'estourado' ? ('alta' as const) : ('media' as const),
        despesaId: '',
        titulo: c.status === 'estourado' ? `${c.nome} estourou o orçamento de ${ano}` : `${c.nome} já consumiu ${pct} do orçamento de ${ano}`,
        detalhe: `Pago ${formatCurrency(c.realizado)} de ${formatCurrency(c.orcado ?? 0)} orçados (${pct})`,
        data: `${ano}-12-31`,
      };
    });
}
