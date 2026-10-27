import type { TituloStatus } from '../types';

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
