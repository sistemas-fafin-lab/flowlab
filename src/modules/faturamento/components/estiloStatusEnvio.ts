import type { StatusAgendamento } from '../types';

// Cor e nome de cada status do Calendário de envios: na grade, nos painéis e no
// detalhe do agendamento.

export const ESTILO_STATUS: Record<StatusAgendamento, { nome: string; chip: string; pilula: string; amostra: string }> = {
  pendente: {
    nome: 'Pendente',
    chip: 'bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
    pilula: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    amostra: 'bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
  },
  enviado: {
    nome: 'Enviado',
    chip: 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/60',
    pilula: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    amostra: 'bg-green-100 border border-green-200 dark:bg-green-900/30 dark:border-green-800/60',
  },
  atrasado: {
    nome: 'Atrasado',
    chip: 'bg-yellow-100 text-yellow-900 border border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-700',
    pilula: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-200',
    amostra: 'bg-yellow-100 border border-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-700',
  },
  fora_do_prazo: {
    nome: 'Fora do prazo do convênio',
    chip: 'bg-red-100 text-red-800 border border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
    pilula: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    amostra: 'bg-red-100 border border-red-300 dark:bg-red-900/30 dark:border-red-800',
  },
};
