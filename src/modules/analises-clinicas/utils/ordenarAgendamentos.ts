import type { AcAgendamento } from '../types';

const STATUS_PENDENTES_COLETA = new Set(['recebido', 'em_coleta', 'bloqueado']);

const prioridadeNaLista = (agendamento: AcAgendamento): number =>
  STATUS_PENDENTES_COLETA.has(agendamento.status) ? 0 : 1;

export const ordenarAgendamentosPorData = (agendamentos: AcAgendamento[]): AcAgendamento[] =>
  [...agendamentos].sort(
    (a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime(),
  );

export const ordenarAgendamentosParaLista = (agendamentos: AcAgendamento[]): AcAgendamento[] =>
  [...agendamentos].sort((a, b) => {
    const prioridade = prioridadeNaLista(a) - prioridadeNaLista(b);
    if (prioridade !== 0) return prioridade;

    return new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime();
  });
