import { describe, expect, it } from 'vitest';
import type { AcAgendamento } from '../types';
import { ordenarAgendamentosParaLista, ordenarAgendamentosPorData } from '../utils/ordenarAgendamentos';

const agendamento = (
  id: string,
  dataHora: string,
  status: AcAgendamento['status'] = 'recebido',
): AcAgendamento => ({ id, data_hora: dataHora, status }) as AcAgendamento;

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

describe('ordenarAgendamentosParaLista', () => {
  it('prioriza os não coletados e ordena cada grupo pelos mais recentes', () => {
    const agendamentos = [
      agendamento('coletado-recente', '2026-08-20T09:00:00.000Z', 'coletado'),
      agendamento('pendente-antigo', '2026-08-10T09:00:00.000Z', 'recebido'),
      agendamento('bloqueado', '2026-08-12T09:00:00.000Z', 'bloqueado'),
      agendamento('pendente-recente', '2026-08-15T09:00:00.000Z', 'em_coleta'),
      agendamento('cancelado', '2026-08-18T09:00:00.000Z', 'cancelado'),
    ];

    expect(ordenarAgendamentosParaLista(agendamentos).map((item) => item.id)).toEqual([
      'pendente-recente',
      'bloqueado',
      'pendente-antigo',
      'coletado-recente',
      'cancelado',
    ]);
  });

  it('não altera a lista original', () => {
    const agendamentos = [
      agendamento('coletado', '2026-08-20T09:00:00.000Z', 'coletado'),
      agendamento('pendente', '2026-08-13T09:00:00.000Z'),
    ];

    ordenarAgendamentosParaLista(agendamentos);

    expect(agendamentos.map((item) => item.id)).toEqual(['coletado', 'pendente']);
  });
});
