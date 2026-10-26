// api/_lib/faturamento/indicadoresFaturamento.ts
// Indicadores de Faturamento (.scratch/faturamento-indicadores/spec.md): regra
// inteira da página, em funções puras. Não acessa banco nem relógio: recebe as
// linhas achatadas (lote × requisição × procedimento) e o período pedido.
//
// O lote entra no período pela data de criação (`fatlote.DtaCriacao`), fim
// inclusivo; os lotes cancelados já vêm filtrados pela consulta.

/** Período pedido pela tela. */
export type PeriodoIndicadores =
  | { modo: 'mes'; mes: string }
  | { modo: 'periodo'; inicio: string; fim: string };

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

const MS_DIA = 86_400_000;

// 'YYYY-MM-DD' ↔ dias desde a época, em UTC: conta de dias sem fuso nem horário de verão.
const isoParaDia = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) / MS_DIA;
const diaParaIso = (dia: number): string => new Date(dia * MS_DIA).toISOString().slice(0, 10);

/** Data 'YYYY-MM-DD' que existe no calendário (recusa 2026-02-30). */
function dataValida(valor: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(isoParaDia(valor)) && diaParaIso(isoParaDia(valor)) === valor;
}

/** Mensagem do período inválido do modo Período, ou null quando está ok. */
export function erroDoPeriodo(inicio: string, fim: string): string | null {
  if (!dataValida(inicio)) return 'Parâmetro inválido: inicio (YYYY-MM-DD).';
  if (!dataValida(fim)) return 'Parâmetro inválido: fim (YYYY-MM-DD).';
  if (fim < inicio) return 'O fim do período deve ser igual ou posterior ao início.';
  return null;
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

/** Uma barra de ranking: as duas métricas, para o tooltip mostrar a outra. */
export interface ItemRankingIndicadores {
  nome: string;
  valor: number;
  quantidade: number;
}

/** O mesmo ranking nas duas ordens: o botão R$/Qtd da tela só escolhe uma. */
export interface RankingIndicadores {
  porValor: ItemRankingIndicadores[];
  porQuantidade: ItemRankingIndicadores[];
}

export interface ResumoIndicadores {
  cards: {
    totalFaturado: CardIndicador;
    requisicoes: CardIndicador;
    exames: CardIndicador;
  };
  rankings: {
    /** Fonte pagadora do lote; quantidade = exames faturados. */
    convenios: RankingIndicadores;
    /** Código do procedimento; nome = código e a descrição mais usada dele. */
    exames: RankingIndicadores;
    /** Local de Origem da requisição; quantidade = requisições distintas. */
    clinicas: RankingIndicadores;
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

const TOPO_RANKING = 10;

// Empate: a outra métrica, depois o nome — ordem estável entre consultas.
const porValorDesc = (a: ItemRankingIndicadores, b: ItemRankingIndicadores) =>
  b.valor - a.valor || b.quantidade - a.quantidade || a.nome.localeCompare(b.nome);
const porQuantidadeDesc = (a: ItemRankingIndicadores, b: ItemRankingIndicadores) =>
  b.quantidade - a.quantidade || b.valor - a.valor || a.nome.localeCompare(b.nome);

/** Soma o valor por grupo; a quantidade é a soma da cobrada ('quantidadeCobrada')
 *  ou o número de requisições distintas ('requisicoes'). Top 10 em cada ordem. */
function ranquear(
  linhas: LinhaFaturada[],
  grupo: (l: LinhaFaturada) => { chave: string; nome: string },
  contar: 'quantidadeCobrada' | 'requisicoes' = 'quantidadeCobrada',
): RankingIndicadores {
  const itens = new Map<string, ItemRankingIndicadores & { requisicoes: Set<number> }>();
  for (const l of linhas) {
    const { chave, nome } = grupo(l);
    const item = itens.get(chave) ?? { nome, valor: 0, quantidade: 0, requisicoes: new Set<number>() };
    item.valor += l.valorLiquido;
    item.quantidade += l.quantidade;
    item.requisicoes.add(l.idRequisicao);
    itens.set(chave, item);
  }
  const todos = [...itens.values()].map(({ nome, valor, quantidade, requisicoes }) => ({
    nome,
    valor: centavos(valor),
    quantidade: contar === 'quantidadeCobrada' ? quantidade : requisicoes.size,
  }));
  return {
    porValor: [...todos].sort(porValorDesc).slice(0, TOPO_RANKING),
    porQuantidade: [...todos].sort(porQuantidadeDesc).slice(0, TOPO_RANKING),
  };
}

const porFontePagadora = (l: LinhaFaturada) => ({
  chave: String(l.fontePagadoraId),
  nome: l.fontePagadoraNome
    ?? (l.fontePagadoraId === null ? 'Sem fonte pagadora' : `Fonte pagadora ${l.fontePagadoraId}`),
});

const porLocalOrigem = (l: LinhaFaturada) => ({
  chave: String(l.localOrigemId),
  nome: l.localOrigemNome
    ?? (l.localOrigemId === null ? 'Sem clínica' : `Local de origem ${l.localOrigemId}`),
});

/** Agrupa pelo código: a descrição muda de tabela para tabela (de convênio para
 *  convênio). O nome leva a descrição mais frequente do código, ponderada pela
 *  quantidade; no empate, a primeira em ordem alfabética. */
function porCodigoDoExame(linhas: LinhaFaturada[]): (l: LinhaFaturada) => { chave: string; nome: string } {
  const pesos = new Map<string, Map<string, number>>();
  for (const l of linhas) {
    if (l.codigo === null || l.descricao === null) continue;
    const doCodigo = pesos.get(l.codigo) ?? new Map<string, number>();
    doCodigo.set(l.descricao, (doCodigo.get(l.descricao) ?? 0) + l.quantidade);
    pesos.set(l.codigo, doCodigo);
  }
  const descricoes = new Map<string, string>();
  for (const [codigo, doCodigo] of pesos) {
    const [[maisUsada]] = [...doCodigo].sort(([da, pa], [db, pb]) => pb - pa || da.localeCompare(db));
    descricoes.set(codigo, maisUsada);
  }
  return (l) => {
    if (l.codigo === null) return { chave: '', nome: 'Sem código' };
    const descricao = descricoes.get(l.codigo);
    return { chave: l.codigo, nome: descricao ? `${l.codigo} - ${descricao}` : l.codigo };
  };
}

/** Cards da janela atual, comparados com a anterior, e os rankings da atual. */
export function resumirIndicadores(linhas: LinhaFaturada[], janelas: JanelasIndicadores): ResumoIndicadores {
  // 'YYYY-MM-DD' compara como texto.
  const dentro = (j: JanelaIndicadores) => (l: LinhaFaturada) => l.dataLote >= j.inicio && l.dataLote <= j.fim;
  const linhasAtual = linhas.filter(dentro(janelas.atual));
  const atual = somar(linhasAtual);
  const anterior = somar(linhas.filter(dentro(janelas.anterior)));
  return {
    cards: {
      totalFaturado: card(atual.totalFaturado, anterior.totalFaturado),
      requisicoes: card(atual.requisicoes, anterior.requisicoes),
      exames: card(atual.exames, anterior.exames),
    },
    rankings: {
      convenios: ranquear(linhasAtual, porFontePagadora),
      exames: ranquear(linhasAtual, porCodigoDoExame(linhasAtual)),
      clinicas: ranquear(linhasAtual, porLocalOrigem, 'requisicoes'),
    },
  };
}

/** Janela atual e a anterior: no modo Mês, o mês anterior; no modo Período,
 *  o intervalo imediatamente anterior, com o mesmo número de dias. */
export function janelasDoPeriodo(periodo: PeriodoIndicadores): JanelasIndicadores {
  if (periodo.modo === 'periodo') {
    const inicio = isoParaDia(periodo.inicio);
    const dias = isoParaDia(periodo.fim) - inicio + 1;
    return {
      atual: { inicio: periodo.inicio, fim: periodo.fim },
      anterior: { inicio: diaParaIso(inicio - dias), fim: diaParaIso(inicio - 1) },
    };
  }
  const [ano, mes] = periodo.mes.split('-').map(Number);
  return {
    atual: janelaDoMes(ano, mes),
    anterior: mes === 1 ? janelaDoMes(ano - 1, 12) : janelaDoMes(ano, mes - 1),
  };
}
