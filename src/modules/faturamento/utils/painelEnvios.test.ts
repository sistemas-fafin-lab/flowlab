import { describe, expect, it } from 'vitest';
import type { AgendamentoEnvio, CalendarioEnvios, RegraEnvio } from '../types';
import { organizarCalendario } from './painelEnvios';

const regra = (id: string, convenio: string): RegraEnvio => ({
  id,
  convenio,
  membros: null,
  fontesPagadoras: [],
  conveniosAplis: [],
  janelas: [{ tipo: 'todos_os_dias' }],
  enviosSugeridosMes: null,
  observacao: null,
  ativo: true,
  alteradoPorNome: null,
  alteradoEm: '2026-10-01T00:00:00Z',
});

const agendamento = (id: string, regraId: string, dataPrevista: string, status: AgendamentoEnvio['status'] = 'pendente'): AgendamentoEnvio => ({
  id,
  regraId,
  dataPrevista,
  janelaIndice: 0,
  origem: 'sugestao',
  editado: false,
  dataEnvio: null,
  marcadoPorNome: null,
  marcadoEm: null,
  loteAplisConfirmado: null,
  status,
  foraDaJanela: false,
});

const calendario = (parcial: Partial<CalendarioEnvios>): CalendarioEnvios => ({
  hoje: '2026-10-28',
  amanha: '2026-10-29',
  mes: '2026-10',
  regras: [],
  podeEnviarQualquerDia: [],
  feriados: [],
  agendamentos: [],
  atrasados: [],
  sugestao: { mesSeguinte: '2026-11', liberada: true, mesSeguintePlanejado: true, sugeridosPendentesMesAtual: 0 },
  confirmacaoAplis: { naoPlanejados: [], aviso: null },
  ...parcial,
});

describe('organizarCalendario', () => {
  it('agrupa os agendamentos por dia previsto, em ordem alfabética do convênio', () => {
    const { porDia } = organizarCalendario(calendario({
      regras: [regra('r1', 'Unimed'), regra('r2', 'Amil'), regra('r3', 'Bradesco')],
      agendamentos: [
        agendamento('a1', 'r1', '2026-10-28'),
        agendamento('a2', 'r2', '2026-10-28'),
        agendamento('a3', 'r3', '2026-10-29'),
      ],
    }));

    expect(porDia.get('2026-10-28')?.map((i) => i.regra?.convenio)).toEqual(['Amil', 'Unimed']);
    expect(porDia.get('2026-10-29')?.map((i) => i.agendamento.id)).toEqual(['a3']);
    expect(porDia.get('2026-10-30')).toBeUndefined();
  });

  it('mantém a ordem do servidor nos atrasados, mesmo com a regra removida', () => {
    const { atrasados } = organizarCalendario(calendario({
      regras: [regra('r1', 'Unimed')],
      atrasados: [agendamento('a1', 'r1', '2026-09-30', 'fora_do_prazo'), agendamento('a2', 'sumiu', '2026-10-27', 'atrasado')],
    }));

    expect(atrasados.map((i) => i.agendamento.id)).toEqual(['a1', 'a2']);
    expect(atrasados.map((i) => i.regra?.convenio)).toEqual(['Unimed', undefined]);
  });

  it('a lista "Pode enviar qualquer dia" ignora ids sem regra', () => {
    const { qualquerDia } = organizarCalendario(calendario({
      regras: [regra('r1', 'Unimed'), regra('r2', 'Amil')],
      podeEnviarQualquerDia: ['r2', 'sumiu', 'r1'],
    }));

    expect(qualquerDia.map((r) => r.convenio)).toEqual(['Amil', 'Unimed']);
  });

  it('sem calendário carregado, tudo vazio', () => {
    const { porDia, feriados, atrasados, qualquerDia } = organizarCalendario(null);
    expect([porDia.size, feriados.size, atrasados.length, qualquerDia.length]).toEqual([0, 0, 0, 0]);
  });
});
