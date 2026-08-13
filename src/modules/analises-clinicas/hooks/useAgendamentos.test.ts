import { describe, expect, it } from 'vitest';
import type { AcAgendamento } from '../types';
import { ordenarAgendamentosPorData } from '../utils/ordenarAgendamentos';

const agendamento = (id: string, dataHora: string): AcAgendamento =>
  ({ id, data_hora: dataHora }) as AcAgendamento;

describe('ordenarAgendamentosPorData', () => {
  it('coloca os agendamentos com data mais próxima primeiro', () => {
    const agendamentos = [
      agendamento('distante', '2026-08-20T09:00:00.000Z'),
      agendamento('proximo', '2026-08-13T09:00:00.000Z'),
      agendamento('intermediario', '2026-08-16T09:00:00.000Z'),
    ];

    expect(ordenarAgendamentosPorData(agendamentos).map((agendamento) => agendamento.id)).toEqual([
      'proximo',
      'intermediario',
      'distante',
    ]);
  });

  it('não altera a lista original', () => {
    const agendamentos = [
      agendamento('distante', '2026-08-20T09:00:00.000Z'),
      agendamento('proximo', '2026-08-13T09:00:00.000Z'),
    ];

    ordenarAgendamentosPorData(agendamentos);

    expect(agendamentos.map((agendamento) => agendamento.id)).toEqual(['distante', 'proximo']);
  });
});
