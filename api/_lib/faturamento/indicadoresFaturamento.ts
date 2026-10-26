// api/_lib/faturamento/indicadoresFaturamento.ts
// Indicadores de Faturamento (.scratch/faturamento-indicadores/spec.md): regra
// inteira da página, em funções puras. Não acessa banco nem relógio: recebe as
// linhas achatadas (lote × requisição × procedimento) e o período pedido.
//
// O lote entra no período pela data de criação (`fatlote.DtaCriacao`), fim
// inclusivo; os lotes cancelados já vêm filtrados pela consulta.

/** Período pedido pela tela. */
export type PeriodoIndicadores = { modo: 'mes'; mes: string };

/** Janela de datas 'YYYY-MM-DD', as duas pontas inclusivas. */
export interface JanelaIndicadores {
  inicio: string;
  fim: string;
}

export interface JanelasIndicadores {
  atual: JanelaIndicadores;
  anterior: JanelaIndicadores;
}

/** Mês 'YYYY-MM' válido. */
export function mesValido(valor: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(valor);
}

function janelaDoMes(ano: number, mes: number): JanelaIndicadores {
  // Dia 0 do mês seguinte = último dia deste; em UTC, sem fuso do processo.
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const prefixo = `${ano}-${String(mes).padStart(2, '0')}`;
  return { inicio: `${prefixo}-01`, fim: `${prefixo}-${String(ultimoDia).padStart(2, '0')}` };
}

/** Um procedimento cobrado numa requisição de um lote — a linha da consulta. */
export interface LinhaFaturada {
  idLote: number;
  /** `fatlote.DtaCriacao`, 'YYYY-MM-DD'. */
  dataLote: string;
  idRequisicao: number;
  codigo: string | null;
  descricao: string | null;
  quantidade: number;
  valorLiquido: number;
  fontePagadoraId: number | null;
  fontePagadoraNome: string | null;
  localOrigemId: number | null;
  localOrigemNome: string | null;
}

export interface CardIndicador {
  atual: number;
  anterior: number;
  /** % sobre o anterior, uma casa; null quando o anterior é zero. */
  variacao: number | null;
}

export interface ResumoIndicadores {
  cards: {
    totalFaturado: CardIndicador;
    requisicoes: CardIndicador;
    exames: CardIndicador;
  };
}

interface Somas {
  totalFaturado: number;
  requisicoes: number;
  exames: number;
}

function centavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function somar(linhas: LinhaFaturada[]): Somas {
  let total = 0;
  let exames = 0;
  const requisicoes = new Set<number>();
  for (const l of linhas) {
    total += l.valorLiquido;
    exames += l.quantidade;
    requisicoes.add(l.idRequisicao);
  }
  return { totalFaturado: centavos(total), requisicoes: requisicoes.size, exames };
}

function card(atual: number, anterior: number): CardIndicador {
  return {
    atual,
    anterior,
    variacao: anterior === 0 ? null : Math.round(((atual - anterior) / anterior) * 1000) / 10,
  };
}

/** Cards da janela atual, comparados com a anterior. */
export function resumirIndicadores(linhas: LinhaFaturada[], janelas: JanelasIndicadores): ResumoIndicadores {
  // 'YYYY-MM-DD' compara como texto.
  const dentro = (j: JanelaIndicadores) => (l: LinhaFaturada) => l.dataLote >= j.inicio && l.dataLote <= j.fim;
  const atual = somar(linhas.filter(dentro(janelas.atual)));
  const anterior = somar(linhas.filter(dentro(janelas.anterior)));
  return {
    cards: {
      totalFaturado: card(atual.totalFaturado, anterior.totalFaturado),
      requisicoes: card(atual.requisicoes, anterior.requisicoes),
      exames: card(atual.exames, anterior.exames),
    },
  };
}

/** Janela atual e a anterior: no modo Mês, o mês anterior. */
export function janelasDoPeriodo(periodo: PeriodoIndicadores): JanelasIndicadores {
  const [ano, mes] = periodo.mes.split('-').map(Number);
  return {
    atual: janelaDoMes(ano, mes),
    anterior: mes === 1 ? janelaDoMes(ano - 1, 12) : janelaDoMes(ano, mes - 1),
  };
}
