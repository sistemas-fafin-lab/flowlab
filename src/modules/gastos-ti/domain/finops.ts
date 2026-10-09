// Indicadores do dashboard FinOps (RF17–RF22, RN05, RN06). Tudo puro, com
// `hoje` como argumento (RN14). Base: COMPETÊNCIA — o mês a que a cobrança se
// refere, a mesma do Mês a mês, para os números das duas abas baterem. As
// visões caixa e diluída (issue 16, `visao.ts`) remapeiam as ocorrências e
// reaproveitam tudo daqui.

import { chaveTexto } from './listaDespesas';
import { competenciaDaData, mesesEntre, partesCompetencia, somarMeses } from './competencia';
import { MESES_DO_CICLO, situacaoDespesa, valorVigente } from './recorrencia';
import { montarOcorrenciasDoMes, type OcorrenciaDoMes } from './situacao';
import type { Despesa, FormaPagamento, Lancamento, NaturezaGasto } from '../types';

// ─── Período ──────────────────────────────────────────────────────────────────

export type PresetPeriodo = 'mes' | 'trimestre' | 'ano' | '12meses' | 'personalizado';

/** Intervalo de competências ('YYYY-MM-01'), inclusive nas duas pontas. */
export interface PeriodoFinops {
  desde: string;
  ate: string;
}

export function periodoDoPreset(preset: PresetPeriodo, hoje: string, personalizado?: PeriodoFinops): PeriodoFinops {
  const atual = competenciaDaData(hoje) as string;
  const { ano, mes } = partesCompetencia(atual);
  switch (preset) {
    case 'mes':
      return { desde: atual, ate: atual };
    case 'trimestre': {
      const inicio = somarMeses(`${ano}-01-01`, Math.floor((mes - 1) / 3) * 3);
      return { desde: inicio, ate: somarMeses(inicio, 2) };
    }
    case 'ano':
      return { desde: `${ano}-01-01`, ate: `${ano}-12-01` };
    case '12meses':
      return { desde: somarMeses(atual, -11), ate: atual };
    case 'personalizado':
      if (personalizado && personalizado.desde <= personalizado.ate) return personalizado;
      return { desde: somarMeses(atual, -11), ate: atual };
  }
}

export function competenciasEntre(desde: string, ate: string): string[] {
  const total = mesesEntre(desde, ate);
  return total < 0 ? [] : Array.from({ length: total + 1 }, (_, i) => somarMeses(desde, i));
}

/** O período de mesmo tamanho imediatamente anterior (base da variação). */
export function periodoAnterior(p: PeriodoFinops): PeriodoFinops {
  const tamanho = mesesEntre(p.desde, p.ate) + 1;
  return { desde: somarMeses(p.desde, -tamanho), ate: somarMeses(p.desde, -1) };
}

/**
 * Janela do gráfico de evolução: 12 meses até o fim do período e, quando o
 * período termina no mês atual, mais 3 meses de projeção. Um período de um
 * mês só viraria um gráfico de uma barra.
 */
export function janelaEvolucao(p: PeriodoFinops, hoje: string): string[] {
  const atual = competenciaDaData(hoje) as string;
  const fim = p.ate === atual ? somarMeses(atual, 3) : p.ate;
  return competenciasEntre(somarMeses(p.ate, -11), fim);
}

/**
 * Quantas competências além do recorte as visões caixa e diluída precisam
 * (issue 16): uma anual cobrada 11 meses antes ainda tem fatia diluída no mês,
 * e uma cobrança paga com atraso (ou adiantada) cai no caixa de outro mês.
 */
export const MARGEM_VISOES = { antes: 11, depois: 3 } as const;

/**
 * Intervalo de lançamentos que o dashboard precisa carregar de uma vez: período
 * anterior, evolução e "a pagar", mais a margem das visões — assim trocar de
 * visão recalcula sem buscar de novo.
 */
export function intervaloDeCarga(p: PeriodoFinops, hoje: string): PeriodoFinops {
  const atual = competenciaDaData(hoje) as string;
  const anterior = periodoAnterior(p);
  const candidatosInicio = [anterior.desde, somarMeses(p.ate, -11), somarMeses(atual, -11)];
  const candidatosFim = [p.ate, somarMeses(atual, 3)];
  return {
    desde: somarMeses(
      candidatosInicio.reduce((a, b) => (a < b ? a : b)),
      -MARGEM_VISOES.antes,
    ),
    ate: somarMeses(
      candidatosFim.reduce((a, b) => (a > b ? a : b)),
      MARGEM_VISOES.depois,
    ),
  };
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

export interface FiltrosFinops {
  categoriaId: string;
  fornecedor: string;
  setor: string;
  natureza: NaturezaGasto | '';
  formaPagamento: FormaPagamento | '';
}

export const FILTROS_FINOPS_VAZIOS: FiltrosFinops = { categoriaId: '', fornecedor: '', setor: '', natureza: '', formaPagamento: '' };

export function filtrarDespesasFinops(despesas: readonly Despesa[], f: FiltrosFinops): Despesa[] {
  return despesas.filter(
    (d) =>
      (!f.categoriaId || d.categoriaId === f.categoriaId) &&
      (!f.fornecedor || chaveTexto(d.fornecedorNome) === chaveTexto(f.fornecedor)) &&
      (!f.setor || d.setor === f.setor) &&
      (!f.natureza || d.natureza === f.natureza) &&
      (!f.formaPagamento || d.formaPagamento === f.formaPagamento),
  );
}

// ─── Ocorrências e totais ─────────────────────────────────────────────────────

export function ocorrenciasNoPeriodo(
  despesas: readonly Despesa[],
  lancamentos: readonly Lancamento[],
  competencias: readonly string[],
  hoje: string,
): OcorrenciaDoMes[] {
  return competencias.flatMap((c) => montarOcorrenciasDoMes(despesas, lancamentos, c, hoje));
}

export interface TotaisPeriodo {
  /** Previsto (com ajustes), sem as dispensadas. */
  previsto: number;
  /** Soma do valor pago das cobranças pagas. */
  realizado: number;
}

export function totaisDoPeriodo(ocorrencias: readonly OcorrenciaDoMes[]): TotaisPeriodo {
  return ocorrencias.reduce(
    (t, o) => ({
      previsto: o.situacao === 'dispensada' ? t.previsto : t.previsto + o.valorPrevisto,
      realizado: o.situacao === 'paga' ? t.realizado + (o.lancamento?.valorPago ?? 0) : t.realizado,
    }),
    { previsto: 0, realizado: 0 },
  );
}

/** Variação % sobre a base; null quando a base é zero (não há o que comparar). */
export function variacaoPercentual(atual: number, anterior: number): number | null {
  return anterior === 0 ? null : ((atual - anterior) / anterior) * 100;
}

// ─── Custo recorrente e anualizado (RN05, RN06) ───────────────────────────────

/**
 * Quanto a TI custa por mês hoje: equivalente mensal das despesas recorrentes
 * ativas. Variável usa a média dos 3 últimos pagamentos (até o mês atual);
 * sem pagamento ainda, o valor estimado.
 */
export function custoRecorrenteMensal(despesas: readonly Despesa[], lancamentos: readonly Lancamento[], hoje: string): number {
  const atual = competenciaDaData(hoje) as string;
  const pagosPorDespesa = new Map<string, Lancamento[]>();
  for (const l of lancamentos) {
    if (l.status !== 'pago' || l.valorPago === null || l.competencia > atual) continue;
    pagosPorDespesa.set(l.despesaId, [...(pagosPorDespesa.get(l.despesaId) ?? []), l]);
  }
  return despesas.reduce((total, d) => {
    const ciclo = MESES_DO_CICLO[d.recorrencia];
    if (ciclo === 0 || situacaoDespesa(d, atual) !== 'ativa') return total;
    let valor = valorVigente(d, atual);
    if (d.tipoValor === 'variavel') {
      const ultimos = (pagosPorDespesa.get(d.id) ?? []).sort((a, b) => b.competencia.localeCompare(a.competencia)).slice(0, 3);
      if (ultimos.length > 0) valor = ultimos.reduce((s, l) => s + (l.valorPago ?? 0), 0) / ultimos.length;
    }
    return total + valor / ciclo;
  }, 0);
}

/** Custo recorrente × 12 + despesas únicas com cobrança no ano (RN06). */
export function custoAnualizado(despesas: readonly Despesa[], recorrenteMensal: number, ano: number): number {
  const unicas = despesas
    .filter((d) => d.recorrencia === 'unica' && partesCompetencia(d.competenciaInicio).ano === ano)
    .reduce((s, d) => s + valorVigente(d, d.competenciaInicio), 0);
  return recorrenteMensal * 12 + unicas;
}

// ─── A pagar ──────────────────────────────────────────────────────────────────

export interface APagar {
  total: number;
  quantidade: number;
  vencidasTotal: number;
  vencidasQuantidade: number;
}

const somarDias = (iso: string, dias: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

/** Cobranças em aberto que vencem nos próximos `dias` (a partir de hoje) e as já vencidas sem baixa. */
export function aPagar(ocorrencias: readonly OcorrenciaDoMes[], hoje: string, dias = 30): APagar {
  const limite = somarDias(hoje, dias);
  return ocorrencias.reduce(
    (r, o) => {
      if (o.situacao === 'a_vencer' && o.vencimento <= limite) return { ...r, total: r.total + o.valorPrevisto, quantidade: r.quantidade + 1 };
      if (o.situacao === 'vencida') return { ...r, vencidasTotal: r.vencidasTotal + o.valorPrevisto, vencidasQuantidade: r.vencidasQuantidade + 1 };
      return r;
    },
    { total: 0, quantidade: 0, vencidasTotal: 0, vencidasQuantidade: 0 },
  );
}

// ─── Série mensal ─────────────────────────────────────────────────────────────

export const CHAVE_OUTROS = 'outros';

export interface PontoSerie {
  competencia: string;
  /** Mês depois do atual: mostra o previsto, não o pago. */
  projecao: boolean;
  total: number;
  /** Valor por chave de série (id da categoria, ou CHAVE_OUTROS da 9ª em diante). */
  valores: Record<string, number>;
}

/**
 * Evolução por categoria: até o mês atual, o realizado (valor pago); depois
 * dele, o previsto (projeção). `chaveDaCategoria` agrupa da 9ª categoria em
 * diante em CHAVE_OUTROS (a cor segue a categoria, nunca o ranking).
 */
export function serieMensal(
  ocorrencias: readonly OcorrenciaDoMes[],
  meses: readonly string[],
  hoje: string,
  chaveDaCategoria: (categoriaId: string) => string,
): PontoSerie[] {
  const atual = competenciaDaData(hoje) as string;
  const pontos = new Map(meses.map((c) => [c, { competencia: c, projecao: c > atual, total: 0, valores: {} as Record<string, number> }]));
  for (const o of ocorrencias) {
    const ponto = pontos.get(o.competencia);
    if (!ponto) continue;
    const valor = ponto.projecao
      ? o.situacao === 'dispensada'
        ? 0
        : o.valorPrevisto
      : o.situacao === 'paga'
        ? o.lancamento?.valorPago ?? 0
        : 0;
    if (valor === 0) continue;
    const chave = chaveDaCategoria(o.despesa.categoriaId);
    ponto.valores[chave] = (ponto.valores[chave] ?? 0) + valor;
    ponto.total += valor;
  }
  return meses.map((c) => pontos.get(c) as PontoSerie);
}

// ─── Quebras ──────────────────────────────────────────────────────────────────

export type MedidaGasto = 'realizado' | 'previsto';

/** Realizado quando há pagamento no período; senão (período futuro), o previsto. */
export function medidaDoPeriodo(totais: TotaisPeriodo): MedidaGasto {
  return totais.realizado > 0 ? 'realizado' : 'previsto';
}

const valorNaMedida = (o: OcorrenciaDoMes, medida: MedidaGasto): number => {
  if (medida === 'realizado') return o.situacao === 'paga' ? o.lancamento?.valorPago ?? 0 : 0;
  return o.situacao === 'dispensada' ? 0 : o.valorPrevisto;
};

export interface GrupoGasto {
  chave: string;
  nome: string;
  valor: number;
  /** % do total do período. */
  percentual: number;
  /** % acumulado até este grupo, na ordem do maior para o menor (concentração). */
  acumulado: number;
}

/** Soma por grupo, do maior para o menor, com % e % acumulado. Grupos zerados ficam de fora. */
export function agruparGasto(
  ocorrencias: readonly OcorrenciaDoMes[],
  grupoDe: (o: OcorrenciaDoMes) => { chave: string; nome: string },
  medida: MedidaGasto,
): GrupoGasto[] {
  const somas = new Map<string, { nome: string; valor: number }>();
  for (const o of ocorrencias) {
    const valor = valorNaMedida(o, medida);
    if (valor === 0) continue;
    const { chave, nome } = grupoDe(o);
    const atual = somas.get(chave);
    somas.set(chave, { nome: atual?.nome ?? nome, valor: (atual?.valor ?? 0) + valor });
  }
  const total = [...somas.values()].reduce((s, g) => s + g.valor, 0);
  let acumulado = 0;
  return [...somas.entries()]
    .map(([chave, g]) => ({ chave, ...g }))
    .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((g) => {
      acumulado += g.valor;
      return { ...g, percentual: total ? (g.valor / total) * 100 : 0, acumulado: total ? (acumulado / total) * 100 : 0 };
    });
}

/** Os `n` maiores e o resto somado em "Outros". */
export function topComOutros(grupos: readonly GrupoGasto[], n: number): GrupoGasto[] {
  if (grupos.length <= n) return [...grupos];
  const resto = grupos.slice(n);
  const valor = resto.reduce((s, g) => s + g.valor, 0);
  const percentual = resto.reduce((s, g) => s + g.percentual, 0);
  return [...grupos.slice(0, n), { chave: CHAVE_OUTROS, nome: `Outros (${resto.length})`, valor, percentual, acumulado: 100 }];
}

export interface Proporcoes {
  recorrente: number;
  pontual: number;
  opex: number;
  capex: number;
}

export function proporcoes(ocorrencias: readonly OcorrenciaDoMes[], medida: MedidaGasto): Proporcoes {
  return ocorrencias.reduce(
    (p, o) => {
      const valor = valorNaMedida(o, medida);
      return {
        recorrente: p.recorrente + (o.despesa.recorrencia !== 'unica' ? valor : 0),
        pontual: p.pontual + (o.despesa.recorrencia === 'unica' ? valor : 0),
        opex: p.opex + (o.despesa.natureza === 'opex' ? valor : 0),
        capex: p.capex + (o.despesa.natureza === 'capex' ? valor : 0),
      };
    },
    { recorrente: 0, pontual: 0, opex: 0, capex: 0 },
  );
}
