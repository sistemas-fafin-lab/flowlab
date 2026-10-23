// Rótulos e cores da tela Glosas e Recursos, comuns à lista de lotes de
// recurso e ao card "Detalhes do recurso".

import type { SeloAtrasoLote, StatusLoteRecurso } from '../types';

export const STATUS_LOTE_CORES: Record<StatusLoteRecurso, string> = {
  Criado: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  Enviado: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  Finalizado: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  Cancelado: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

export const SELOS_ATRASO: Record<Exclude<SeloAtrasoLote, 'sem-regra'>, { label: string; cor: string }> = {
  'no-prazo': { label: 'No prazo', cor: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  'vence-hoje': { label: 'Vence hoje', cor: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
  atrasado: { label: 'Atrasado', cor: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
};

/** Eventos de faturamento (`eventofatur`) que aparecem na foto de glosas e recursos. */
const STATUS_APLIS_LABEL: Record<number, string> = {
  5: 'Recebido',
  6: 'Glosado sem recurso',
  7: '1º recurso',
  8: 'Glosa definitiva – acatada diretoria',
  15: 'Recurso não acatado',
  16: '2º recurso',
  17: 'Recurso de glosa pago',
  18: 'Recebido a menor – acatado',
  33: 'Em tratativas com convênio',
  34: 'Glosa recebida',
};

export function rotuloStatusAplis(codigo: number | null): string {
  if (codigo === null) return '—';
  return STATUS_APLIS_LABEL[codigo] ?? `Evento ${codigo}`;
}
