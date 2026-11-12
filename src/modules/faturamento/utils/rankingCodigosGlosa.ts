// Aba Contas a Receber → Comparativos: ranking de códigos de glosa (Total | Acatada) e as
// requisições por trás de cada código
// (.scratch/faturamento-comparativos/issues/05-ranking-de-codigos-e-requisicoes.md).
//
// As glosas são as mesmas do funil (foto de recursos do apLIS, já classificadas e com o mês
// do funil), então os totais batem com ele. O código vem do apLIS por procedimento
// (demonstrativo → catálogo → texto livre, ver `resolverCodigoGlosa` em bdLab.ts): o valor da
// requisição é dividido entre os códigos dela pelo valor glosado de cada um, em centavos.
//
// Funções puras, compartilhadas pela rota e pela tela. Sem nome de paciente em lugar nenhum.

import type { PeriodoComparativo } from './comparativos.js';
import type { ClasseGlosaFunil } from './funilGlosa.js';
import { rotuloStatusAplis } from './recursoGlosaVisual.js';

/** Rótulo da linha das glosas cuja requisição não tem código no apLIS. */
export const SEM_CODIGO = 'Sem código';

export type ModoRanking = 'total' | 'acatada';

/** Procedimento glosado da requisição, como o apLIS resolve. */
export interface ProcedimentoGlosado {
  /** Código do procedimento (tabela do convênio). */
  procedimento: string | null;
  procedimentoDescricao: string | null;
  /** Código da glosa; vários separados por vírgula quando reimportações do demonstrativo divergem. */
  codigo: string | null;
  descricao: string | null;
  /** Valor glosado do procedimento; null quando o apLIS não sabe (pesa a média dos outros). */
  valor: number | null;
  /** Data do retorno da operadora (YYYY-MM-DD). */
  data: string | null;
}

/** Uma glosa do funil (uma requisição, uma classe) com os dados para a tabela. */
export interface GlosaParaRanking {
  idRequisicao: number;
  codRequisicao: string | null;
  numGuia: string | null;
  /** Rótulo do lote na tela: o código do lote no Supabase, ou "<lote do apLIS> · Fora de lote". */
  lote: string;
  convenio: string | null;
  statusAplis: number | null;
  classe: ClasseGlosaFunil;
  /** Valor da glosa no funil. */
  valor: number;
  procedimentos: ProcedimentoGlosado[];
}

/** Linha da tabela de requisições: uma por requisição e código. */
export interface LinhaRequisicaoCodigo {
  /** null = "Sem código". */
  codigo: string | null;
  descricao: string | null;
  idRequisicao: number;
  codRequisicao: string | null;
  numGuia: string | null;
  lote: string;
  convenio: string | null;
  /** "codigo – descrição" dos procedimentos com esse código, separados por "; ". */
  procedimento: string;
  /** Parte do valor da glosa da requisição atribuída ao código. */
  valor: number;
  statusAplis: number | null;
  status: string;
  classe: ClasseGlosaFunil;
  /** Retorno mais recente da operadora entre os procedimentos (YYYY-MM-DD). */
  data: string | null;
}

export interface LinhaRankingCodigo {
  codigo: string | null;
  descricao: string | null;
  valor: number;
  /** Requisições distintas com o código. */
  quantidade: number;
  /** % do total do modo, 1 casa. */
  percentual: number;
}

export interface RankingCodigos {
  total: number;
  linhas: LinhaRankingCodigo[];
}

export const ROTULO_CLASSE: Record<ClasseGlosaFunil, string> = {
  recuperada: 'Recuperada',
  acatada: 'Acatada',
  'em-disputa': 'Em disputa',
};

const paraCentavos = (valor: number) => Math.round(valor * 100);
const emReais = (centavos: number) => centavos / 100 + 0; // + 0 evita -0

/**
 * Divide `centavos` pelos `pesos` (maiores restos): a soma das partes é exatamente `centavos`.
 * Pesos todos zero dividem igualmente. Empate de resto vai para o primeiro.
 */
function ratear(centavos: number, pesos: number[]): number[] {
  const soma = pesos.reduce((a, b) => a + b, 0);
  const efetivos = soma > 0 ? pesos : pesos.map(() => 1);
  const total = soma > 0 ? soma : pesos.length;
  const brutos = efetivos.map((p) => (centavos * p) / total);
  const partes = brutos.map(Math.floor);
  let sobra = centavos - partes.reduce((a, b) => a + b, 0);
  const ordem = brutos
    .map((b, i) => ({ i, resto: b - Math.floor(b) }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (let k = 0; sobra > 0; k = (k + 1) % ordem.length, sobra -= 1) partes[ordem[k].i] += 1;
  return partes;
}

const rotuloProcedimento = (p: ProcedimentoGlosado) =>
  [p.procedimento, p.procedimentoDescricao].filter(Boolean).join(' – ');

/** Uma linha por requisição e código; a soma dos valores de uma requisição é o valor dela no funil. */
export function requisicoesPorCodigo(glosas: GlosaParaRanking[]): LinhaRequisicaoCodigo[] {
  const linhas: LinhaRequisicaoCodigo[] = [];
  for (const g of glosas) {
    const base = {
      idRequisicao: g.idRequisicao,
      codRequisicao: g.codRequisicao,
      numGuia: g.numGuia,
      lote: g.lote,
      convenio: g.convenio,
      statusAplis: g.statusAplis,
      status: rotuloStatusAplis(g.statusAplis),
      classe: g.classe,
    };

    // Peso de cada código = Σ valor glosado dos procedimentos dele (dividido entre os códigos
    // juntos de um mesmo procedimento). Procedimento sem valor pesa a média dos que têm valor
    // (sem nenhum valor, todos pesam igual). Procedimento sem código pesa para "Sem código" (chave null).
    const conhecidos = g.procedimentos.filter((p) => p.valor !== null).map((p) => paraCentavos(p.valor as number));
    const pesoSemValor = conhecidos.length > 0 ? conhecidos.reduce((a, b) => a + b, 0) / conhecidos.length : 0;
    const porCodigo = new Map<string | null, { descricao: string | null; peso: number; procs: ProcedimentoGlosado[] }>();
    for (const p of g.procedimentos) {
      const lidos = (p.codigo ?? '').split(',').map((c) => c.trim()).filter(Boolean);
      const codigos: (string | null)[] = lidos.length > 0 ? lidos : [null];
      for (const codigo of codigos) {
        let item = porCodigo.get(codigo);
        if (!item) {
          item = { descricao: null, peso: 0, procs: [] };
          porCodigo.set(codigo, item);
        }
        if (codigo !== null) item.descricao ??= p.descricao;
        item.peso += (p.valor === null ? pesoSemValor : paraCentavos(p.valor)) / codigos.length;
        item.procs.push(p);
      }
    }

    const centavos = paraCentavos(g.valor);
    if (porCodigo.size === 0) {
      linhas.push({ ...base, codigo: null, descricao: null, procedimento: '', valor: emReais(centavos), data: null });
      continue;
    }
    const itens = [...porCodigo.entries()];
    const partes = ratear(centavos, itens.map(([, item]) => item.peso));
    itens.forEach(([codigo, item], i) => {
      const procedimentos = [...new Set(item.procs.map(rotuloProcedimento).filter(Boolean))];
      const data = item.procs.reduce<string | null>((max, p) => (p.data && (!max || p.data > max) ? p.data : max), null);
      linhas.push({
        ...base,
        codigo,
        descricao: item.descricao,
        procedimento: procedimentos.join('; '),
        valor: emReais(partes[i]),
        data,
      });
    });
  }
  return linhas;
}

/** As linhas que entram no modo: Total = todas as classes do funil; Acatada = só a acatada. */
export function linhasDoModo(linhas: LinhaRequisicaoCodigo[], modo: ModoRanking): LinhaRequisicaoCodigo[] {
  return modo === 'acatada' ? linhas.filter((l) => l.classe === 'acatada') : linhas;
}

/** Ranking por valor (depois quantidade e código); "Sem código" sempre por último. */
export function rankingCodigos(linhas: LinhaRequisicaoCodigo[], modo: ModoRanking): RankingCodigos {
  const porCodigo = new Map<string | null, { descricao: string | null; centavos: number; requisicoes: Set<number> }>();
  let total = 0;
  for (const l of linhasDoModo(linhas, modo)) {
    let item = porCodigo.get(l.codigo);
    if (!item) {
      item = { descricao: null, centavos: 0, requisicoes: new Set() };
      porCodigo.set(l.codigo, item);
    }
    item.descricao ??= l.descricao;
    const centavos = paraCentavos(l.valor);
    item.centavos += centavos;
    item.requisicoes.add(l.idRequisicao);
    total += centavos;
  }

  const ranking = [...porCodigo.entries()]
    .map(([codigo, item]): LinhaRankingCodigo => ({
      codigo,
      descricao: item.descricao,
      valor: emReais(item.centavos),
      quantidade: item.requisicoes.size,
      percentual: total === 0 ? 0 : Math.round((item.centavos / total) * 1000) / 10,
    }))
    .sort((a, b) => {
      if ((a.codigo === null) !== (b.codigo === null)) return a.codigo === null ? 1 : -1;
      return b.valor - a.valor
        || b.quantidade - a.quantidade
        || (a.codigo ?? '').localeCompare(b.codigo ?? '', 'pt-BR', { numeric: true });
    });
  return { total: emReais(total), linhas: ranking };
}

export interface RankingCodigosMes {
  mes: string;
  ranking: Record<ModoRanking, RankingCodigos>;
  /** Todas as linhas do mês (modo Total); a tela filtra pelo código e pelo modo. */
  requisicoes: LinhaRequisicaoCodigo[];
}

/** Ranking de cada período (referência, M-1, M-2), com o mês de cada glosa já dado pela regra do funil. */
export function montarRankingCodigosPorMes(
  periodos: PeriodoComparativo[],
  glosas: { mes: string; glosa: GlosaParaRanking }[],
): RankingCodigosMes[] {
  return periodos.map((p) => {
    const requisicoes = requisicoesPorCodigo(glosas.filter((g) => g.mes === p.mes).map((g) => g.glosa));
    return {
      mes: p.mes,
      ranking: { total: rankingCodigos(requisicoes, 'total'), acatada: rankingCodigos(requisicoes, 'acatada') },
      requisicoes,
    };
  });
}

const CABECALHO_CSV = [
  'Requisição', 'Guia', 'Lote', 'Convênio', 'Procedimento', 'Código', 'Valor glosado', 'Status', 'Classe no funil', 'Data',
];

function campoCsv(texto: string): string {
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** "1234,50": sem separador de milhar, para a planilha ler como número. */
const valorCsv = (valor: number) => valor.toFixed(2).replace('.', ',');
const dataCsv = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

/** CSV para planilha em pt-BR: `;`, vírgula decimal, UTF-8 com BOM. Sem nome de paciente. */
export function csvRequisicoesDoCodigo(linhas: LinhaRequisicaoCodigo[]): string {
  const corpo = linhas.map((l) => [
    l.codRequisicao ?? String(l.idRequisicao),
    l.numGuia ?? '',
    l.lote,
    l.convenio ?? '',
    l.procedimento,
    l.codigo ?? SEM_CODIGO,
    valorCsv(l.valor),
    l.status,
    ROTULO_CLASSE[l.classe],
    dataCsv(l.data),
  ]);
  return `\uFEFF${[CABECALHO_CSV, ...corpo].map((linha) => linha.map(campoCsv).join(';')).join('\r\n')}`;
}
