import { STLOT_LABELS, type TituloReceber, type TituloStatus } from '../types';

// Rótulo e cor do status do título — compartilhados pela lista de Títulos e
// pelo painel lateral de detalhes.

export const STATUS_ROTULOS: Record<TituloStatus, string> = {
  aberta: 'Aberta',
  parcialmente_recebida: 'Parcial',
  recebida: 'Recebida',
  liquidada: 'Liquidada',
  glosada: 'Glosada',
  cancelada: 'Cancelada',
};

// Agrupadas por significado financeiro, como o STATUS_CORES da aba Faturas:
// pendente (azul/amarelo), dinheiro entrou (verde), encerrado (cinza/vermelho).
export const STATUS_CORES: Record<TituloStatus, string> = {
  aberta: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  parcialmente_recebida: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  recebida: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  liquidada: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  glosada: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  cancelada: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300',
};

// Cores por código STLOT (ver STLOT_LABELS), no mesmo agrupamento: em andamento
// (azul/amarelo/índigo), dinheiro entrou (verde/teal), encerrado sem receita
// (cinza/vermelho). Também usadas pela aba Faturas.
export const STLOT_CORES: Record<number, string> = {
  1: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  2: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  3: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  4: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  5: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300',
  6: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  7: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  8: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  9: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  10: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  11: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  12: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
  13: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  14: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
};

const COR_NEUTRA = 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300';

export interface StatusExibido {
  rotulo: string;
  cor: string;
  /** Quando esse status passou a valer (ISO). */
  atualizadoEm: string | null;
}

/**
 * Status do título na tela: o do lote no apLIS, regravado pela sincronização
 * diária. Precedência: cancelado no FlowLab (decisão manual) > status do apLIS
 * do lote > status pelas baixas (título sem lote do apLIS ou lote nunca lido).
 * Com mais de um lote em status diferentes, cada um aparece ("Recebido / Faturado").
 */
export function statusExibido(
  titulo: Pick<TituloReceber, 'status' | 'statusAtualizadoEm' | 'lotes'>,
): StatusExibido {
  if (titulo.status === 'cancelada') {
    return { rotulo: STATUS_ROTULOS.cancelada, cor: STATUS_CORES.cancelada, atualizadoEm: titulo.statusAtualizadoEm };
  }
  const doAplis = titulo.lotes.filter((l) => l.statusAplis !== null);
  if (doAplis.length === 0) {
    return { rotulo: STATUS_ROTULOS[titulo.status], cor: STATUS_CORES[titulo.status], atualizadoEm: titulo.statusAtualizadoEm };
  }
  const codigos = [...new Set(doAplis.map((l) => l.statusAplis as number))];
  const datas = doAplis
    .map((l) => l.statusAplisAtualizadoEm)
    .filter((d): d is string => d !== null)
    .sort();
  const atualizadoEm = datas.length > 0 ? datas[datas.length - 1] : null;
  return {
    rotulo: codigos.map((c) => STLOT_LABELS[c] ?? `Status ${c}`).join(' / '),
    cor: codigos.length === 1 ? STLOT_CORES[codigos[0]] ?? COR_NEUTRA : COR_NEUTRA,
    atualizadoEm,
  };
}
