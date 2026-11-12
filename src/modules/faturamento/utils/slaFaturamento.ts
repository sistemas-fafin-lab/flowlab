// Aba Contas a Receber → Comparativos, bloco "SLA por convênio" (faturamento-comparativos,
// issue 06): dias médios entre os marcos de cada requisição faturada e o tempo de
// liquidação. Funções puras, compartilhadas pela rota (api/) e pela tela, como
// comparativos.ts — por isso não importam nada do navegador.
//
// Recorte: a requisição entra no mês em que foi FATURADA (fechamento do lote; sem ele,
// criação), a mesma competência do funil. Assim todas as etapas até o faturado já
// aconteceram, e a liquidação mostra quanto desse mês já foi recebido.

import type { PeriodoComparativo } from './comparativos.js';

/** Uma requisição em lote, com os marcos já lidos do apLIS. Datas 'YYYY-MM-DD' ou 'YYYY-MM-DD HH:MM'. */
export interface LinhaSlaRequisicao {
  idRequisicao: number;
  /** Fonte pagadora do lote (o "convênio" da aba, como no volume de envio). */
  fontePagadoraId: number | null;
  nome: string | null;
  /** Primeiro evento "Admissão" do histórico da requisição. */
  admissao: string | null;
  /** Data de solicitação: substitui a admissão quando o histórico não tem o evento. */
  solicitacao: string | null;
  /** Primeira tarefa tipo 34 ("Envio de autorização"). */
  envioFaturamento: string | null;
  /** Primeira tarefa tipo 37 ou 44 ("Recebido no Faturamento"). */
  recebidoFaturamento: string | null;
  fechamentoLote: string | null;
  /** Criação do lote: substitui o fechamento quando o lote não tem. */
  criacaoLote: string | null;
  /** 'YYYY-MM-DD' do recebimento (última baixa); `null` se ainda não recebida. */
  recebimento: string | null;
  /** Valor recebido até a última baixa. Zero com data = retorno glosando tudo, não pagamento. */
  valorRecebido: number | null;
}

/** De onde vem cada marco. Hoje tudo é apLIS; a bipagem do Flow (issue 08) entra aqui. */
export const FONTES_MARCOS = {
  cadastro: 'apLIS: evento "Admissão" do histórico; sem ele, data de solicitação',
  envio: 'apLIS: primeira tarefa tipo 34 ("Envio de autorização")',
  recebido: 'apLIS: primeira tarefa tipo 37 ou 44 ("Recebido no Faturamento")',
  faturado: 'apLIS: fechamento do lote; sem ele, criação do lote',
  liquidado: 'apLIS: data de recebimento da requisição (última baixa), só com valor recebido',
} as const;

export interface EtapaSla {
  /** Dias, 1 casa; `null` sem nenhum intervalo válido. */
  mediaDias: number | null;
  medianaDias: number | null;
  /** Requisições que entraram na média. */
  qtd: number;
  /** Intervalos negativos (fora de ordem), fora da média. */
  descartados: number;
}

export interface LiquidacaoSla extends EtapaSla {
  /** Requisições com data e valor recebido maior que zero (glosa total recebida a zero não conta). */
  qtdRecebidas: number;
  /** recebidas ÷ requisições do grupo, em %, 1 casa; `null` num grupo vazio. */
  percentualRecebido: number | null;
}

export interface SlaGrupo {
  qtdRequisicoes: number;
  cadastroEnvio: EtapaSla;
  envioRecebido: EtapaSla;
  recebidoFaturado: EtapaSla;
  liquidacao: LiquidacaoSla;
  /** Quantas requisições usaram o marco substituto. */
  fallbacks: { cadastroPelaSolicitacao: number; faturadoPelaCriacao: number };
}

export interface SlaConvenio extends SlaGrupo {
  fontePagadoraId: number | null;
  nome: string | null;
}

export interface SlaMes {
  mes: string;
  /** Todas as requisições do mês juntas (não é média das médias dos convênios). */
  total: SlaGrupo;
  /** Maior número de requisições primeiro. */
  convenios: SlaConvenio[];
}

type Marco = (l: LinhaSlaRequisicao) => string | null;

const MS_DIA = 86_400_000;

const cadastro: Marco = (l) => l.admissao ?? l.solicitacao;
const faturado: Marco = (l) => l.fechamentoLote ?? l.criacaoLote;
/** Só o dia: a data de recebimento do apLIS não tem hora. */
const faturadoNoDia: Marco = (l) => faturado(l)?.slice(0, 10) ?? null;
/** Data do recebimento só quando entrou dinheiro: com valor zero é o retorno glosando tudo. */
const recebidoComValor: Marco = (l) => ((l.valorRecebido ?? 0) > 0 ? l.recebimento : null);

const umaCasa = (n: number) => Math.round(n * 10) / 10;

function instante(data: string): number {
  const [dia, hora = '00:00'] = data.split(' ');
  return Date.parse(`${dia}T${hora}:00Z`);
}

function mediaEMediana(dias: number[]): { mediaDias: number | null; medianaDias: number | null } {
  if (dias.length === 0) return { mediaDias: null, medianaDias: null };
  const ordenados = [...dias].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  const mediana = ordenados.length % 2 === 1 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
  return { mediaDias: umaCasa(dias.reduce((s, d) => s + d, 0) / dias.length), medianaDias: umaCasa(mediana) };
}

/** Dias de `de` até `ate` das requisições com os dois marcos; negativos são descartados e contados. */
function etapa(linhas: LinhaSlaRequisicao[], de: Marco, ate: Marco): EtapaSla {
  const dias: number[] = [];
  let descartados = 0;
  for (const l of linhas) {
    const inicio = de(l);
    const fim = ate(l);
    if (!inicio || !fim) continue;
    const d = (instante(fim) - instante(inicio)) / MS_DIA;
    if (d < 0) descartados += 1;
    else dias.push(d);
  }
  return { ...mediaEMediana(dias), qtd: dias.length, descartados };
}

function liquidacao(linhas: LinhaSlaRequisicao[]): LiquidacaoSla {
  const qtdRecebidas = linhas.filter((l) => recebidoComValor(l)).length;
  return {
    ...etapa(linhas, faturadoNoDia, recebidoComValor),
    qtdRecebidas,
    percentualRecebido: linhas.length > 0 ? umaCasa((qtdRecebidas / linhas.length) * 100) : null,
  };
}

function grupo(linhas: LinhaSlaRequisicao[]): SlaGrupo {
  return {
    qtdRequisicoes: linhas.length,
    cadastroEnvio: etapa(linhas, cadastro, (l) => l.envioFaturamento),
    envioRecebido: etapa(linhas, (l) => l.envioFaturamento, (l) => l.recebidoFaturamento),
    recebidoFaturado: etapa(linhas, (l) => l.recebidoFaturamento, faturado),
    liquidacao: liquidacao(linhas),
    fallbacks: {
      cadastroPelaSolicitacao: linhas.filter((l) => !l.admissao && l.solicitacao).length,
      faturadoPelaCriacao: linhas.filter((l) => !l.fechamentoLote && l.criacaoLote).length,
    },
  };
}

/**
 * SLA por convênio e total, um item por período (referência, M-1, M-2). Requisição sem
 * data de faturado ou faturada fora dos períodos é ignorada.
 */
export function montarSlaFaturamento(periodos: PeriodoComparativo[], linhas: LinhaSlaRequisicao[]): SlaMes[] {
  return periodos.map((p) => {
    const doMes = linhas.filter((l) => faturado(l)?.startsWith(p.mes));
    const porConvenio = new Map<string, LinhaSlaRequisicao[]>();
    for (const l of doMes) {
      const chave = l.fontePagadoraId === null ? `sem-id|${l.nome ?? ''}` : String(l.fontePagadoraId);
      const lista = porConvenio.get(chave);
      if (lista) lista.push(l);
      else porConvenio.set(chave, [l]);
    }
    const convenios = [...porConvenio.values()]
      .map((lista): SlaConvenio => ({ fontePagadoraId: lista[0].fontePagadoraId, nome: lista[0].nome, ...grupo(lista) }))
      .sort((a, b) => b.qtdRequisicoes - a.qtdRequisicoes || (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'));
    return { mes: p.mes, total: grupo(doMes), convenios };
  });
}
