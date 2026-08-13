import type { AcAgendamento } from '../types';

export const ordenarAgendamentosPorData = (agendamentos: AcAgendamento[]): AcAgendamento[] =>
  [...agendamentos].sort(
    (a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime(),
  );
