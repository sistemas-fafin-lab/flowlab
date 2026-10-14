// Apresentação da conferência das baixas com o apLIS
// (.scratch/faturamento-conferencia-baixas-aplis): seções por tipo com os
// totais e o CSV exportado pelo modal. A classificação em si é do servidor
// (api/_lib/faturamento/conferenciaAplis.ts); aqui só se agrupa e formata.
// Também o selo da linha e o recorte do filtro "Divergente do apLIS" da aba Títulos.

import type { DivergenciaAplis, TipoDivergenciaAplis } from '../types';
import { formatCurrency, formatData } from './formato';

/** Ordem de exibição: o dinheiro que entrou e não foi lançado primeiro. */
const TIPOS: TipoDivergenciaAplis[] = ['so-no-aplis', 'aplis-maior', 'sistema-maior', 'lote-ausente'];

export const ROTULO_TIPO: Record<TipoDivergenciaAplis, string> = {
  'so-no-aplis': 'Recebido só no apLIS',
  'aplis-maior': 'Recebido a mais no apLIS',
  'sistema-maior': 'Recebido a mais no sistema',
  'lote-ausente': 'Lote ausente no apLIS',
};

/** Cor do tipo — mesma no modal e no selo da lista de Títulos. */
export const COR_TIPO: Record<TipoDivergenciaAplis, string> = {
  'so-no-aplis': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
  'aplis-maior': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  'sistema-maior': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
  'lote-ausente': 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
};

/** O que a linha abre: o "Lançar baixa" (falta lançar) ou o "Editar título"
 *  (corrigir o que já foi lançado). */
export type AcaoTituloConferencia = 'baixa' | 'editar';

export interface SecaoConferencia {
  tipo: TipoDivergenciaAplis;
  rotulo: string;
  titulos: DivergenciaAplis[];
  /** Soma das diferenças (apLIS − sistema); null em `lote-ausente`, que não tem valor. */
  totalDiferenca: number | null;
}

const centavos = (valor: number): number => Math.round(valor * 100);

/** Recebido no apLIS − recebido no sistema, ou null sem valor do apLIS.
 *  Em centavos: em float, 101.1 − 100.1 dá 0,99999… */
export function diferencaAplis(d: DivergenciaAplis): number | null {
  if (d.recebidoAplis === null) return null;
  return (centavos(d.recebidoAplis) - centavos(d.recebidoSistema)) / 100;
}

export function secoesConferencia(titulos: DivergenciaAplis[]): SecaoConferencia[] {
  return TIPOS.map((tipo) => {
    const doTipo = titulos.filter((t) => t.tipo === tipo);
    const total = tipo === 'lote-ausente'
      ? null
      : doTipo.reduce((soma, t) => soma + centavos(diferencaAplis(t) ?? 0), 0) / 100;
    return { tipo, rotulo: ROTULO_TIPO[tipo], titulos: doTipo, totalDiferenca: total };
  }).filter((secao) => secao.titulos.length > 0);
}

/** Status no apLIS de um lote; null = o lote não existe no MySQL. */
export const statusLoteAplis = (statusAplis: string | null): string => statusAplis ?? 'não encontrado';

/** "6329 (Recebido), 4905 (não encontrado)". */
export function lotesComStatus(d: DivergenciaAplis): string {
  return d.lotes.map((l) => `${l.aplisId} (${statusLoteAplis(l.statusAplis)})`).join(', ');
}

const valorCsv = (valor: number | null): string =>
  valor === null
    ? ''
    : valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dataCsv = (iso: string | null): string => (iso ? formatData(iso) : '');

function campoCsv(texto: string): string {
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const CABECALHO = [
  'Tipo', 'Título', 'Operadora', 'Status', 'Emissão', 'Lotes', 'Recebido no sistema', 'Glosado',
  'Recebido no apLIS', 'Diferença', 'Primeiro recebimento no apLIS', 'Último recebimento no apLIS',
];

/** CSV para planilha em pt-BR: `;`, vírgula decimal, UTF-8 com BOM (sem o BOM
 *  o Excel abre os acentos quebrados). */
export function csvConferencia(titulos: DivergenciaAplis[]): string {
  const linhas = titulos.map((d) => [
    ROTULO_TIPO[d.tipo],
    d.numeroNota ?? '',
    d.operadora,
    d.status,
    dataCsv(d.dataEmissao),
    lotesComStatus(d),
    valorCsv(d.recebidoSistema),
    valorCsv(d.glosadoSistema),
    valorCsv(d.recebidoAplis),
    valorCsv(diferencaAplis(d)),
    dataCsv(d.primeiroRecebimentoAplis),
    dataCsv(d.ultimoRecebimentoAplis),
  ]);
  return `\uFEFF${[CABECALHO, ...linhas].map((linha) => linha.map(campoCsv).join(';')).join('\r\n')}`;
}

export interface SeloDivergencia {
  texto: string;
  /** Tooltip: os valores dos dois lados. */
  detalhe: string;
}

/** "22/09" de um YYYY-MM-DD. */
const diaMes = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Selo do título divergente na lista de Títulos. */
export function seloDivergencia(d: DivergenciaAplis): SeloDivergencia {
  const sistema = `Recebido no sistema: ${formatCurrency(d.recebidoSistema)}`;
  if (d.tipo === 'lote-ausente' || d.recebidoAplis === null) {
    return { texto: 'lote ausente no apLIS', detalhe: `${sistema} · Lotes: ${lotesComStatus(d)}` };
  }
  const detalhe = `${sistema} · Recebido no apLIS: ${formatCurrency(d.recebidoAplis)}`;
  if (d.tipo === 'sistema-maior') {
    return { texto: d.recebidoAplis > 0 ? 'recebido a mais no sistema' : 'recebido só no sistema', detalhe };
  }
  const quando = d.ultimoRecebimentoAplis ? ` em ${diaMes(d.ultimoRecebimentoAplis)}` : '';
  return { texto: `apLIS: recebido ${formatCurrency(d.recebidoAplis)}${quando}`, detalhe };
}

/** Ids dos divergentes emitidos no período da lista (`desde`..`ate`, YYYY-MM-DD).
 *  O filtro "Divergente do apLIS" manda os ids num `in.(...)` na URL do
 *  PostgREST: recortar pelo período antes mantém a URL curta. O período da
 *  lista é sobre a emissão, o mesmo campo daqui. */
export function idsDivergentesNoPeriodo(titulos: DivergenciaAplis[], desde: string, ate: string): string[] {
  return titulos
    .filter((t) => !t.dataEmissao || (t.dataEmissao >= desde && t.dataEmissao <= ate))
    .map((t) => t.idNota);
}
