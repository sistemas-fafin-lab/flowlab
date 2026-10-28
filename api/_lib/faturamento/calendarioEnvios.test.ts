import { describe, expect, it } from 'vitest';
import { classificarAgendamento, ehDiaUtil, janelaDaData, proximoDiaUtil } from './calendarioEnvios.js';

// Datas de referência (2026): 30/10 é sexta, 31/10 sábado, 02/11 segunda (Finados), 20/11 sexta (Consciência Negra).
const FERIADOS = ['2026-11-02', '2026-11-15', '2026-11-20', '2026-11-30'];

describe('ehDiaUtil', () => {
  it('segunda a sexta fora dos feriados é dia útil', () => {
    expect(ehDiaUtil('2026-10-30', FERIADOS)).toBe(true);
    expect(ehDiaUtil('2026-11-03', FERIADOS)).toBe(true);
  });

  it('sábado e domingo não são dia útil', () => {
    expect(ehDiaUtil('2026-10-31', FERIADOS)).toBe(false);
    expect(ehDiaUtil('2026-11-01', FERIADOS)).toBe(false);
  });

  it('feriado em dia de semana não é dia útil', () => {
    expect(ehDiaUtil('2026-11-02', FERIADOS)).toBe(false);
    expect(ehDiaUtil('2026-11-20', FERIADOS)).toBe(false);
  });
});

describe('proximoDiaUtil', () => {
  it('numa quinta é a sexta', () => {
    expect(proximoDiaUtil('2026-10-29', FERIADOS)).toBe('2026-10-30');
  });

  it('numa sexta é a segunda', () => {
    expect(proximoDiaUtil('2026-11-06', FERIADOS)).toBe('2026-11-09');
  });

  it('na véspera de feriado pula o feriado', () => {
    expect(proximoDiaUtil('2026-11-19', FERIADOS)).toBe('2026-11-23');
  });

  it('sexta antes de uma segunda-feira de feriado vai para a terça', () => {
    expect(proximoDiaUtil('2026-10-30', FERIADOS)).toBe('2026-11-03');
  });

  it('atravessa a virada do ano', () => {
    expect(proximoDiaUtil('2026-12-31', ['2027-01-01'])).toBe('2027-01-04');
  });
});

// Novembro/2026: 1º dia útil = 03 (02 é Finados), 5º = 09; último dia útil = 27 (30 está na lista como feriado de teste).
describe('janelaDaData', () => {
  it('dias corridos: dentro e fora da faixa', () => {
    const janelas = [{ tipo: 'dias_corridos' as const, de: 1, ate: 15 }];
    expect(janelaDaData('2026-11-15', janelas, FERIADOS)).toBe(0);
    expect(janelaDaData('2026-11-16', janelas, FERIADOS)).toBeNull();
  });

  it('dias úteis contam a partir do primeiro dia útil, pulando o feriado', () => {
    const janelas = [{ tipo: 'dias_uteis' as const, de: 1, ate: 5 }];
    expect(janelaDaData('2026-11-03', janelas, FERIADOS)).toBe(0);
    expect(janelaDaData('2026-11-09', janelas, FERIADOS)).toBe(0);
    expect(janelaDaData('2026-11-10', janelas, FERIADOS)).toBeNull();
  });

  it('com mais de uma janela devolve o índice da que contém a data (TRT)', () => {
    const janelas = [
      { tipo: 'dias_uteis' as const, de: 1, ate: 2 },
      { tipo: 'dias_uteis' as const, de: 15, ate: 16 },
    ];
    // 15º dia útil de nov/2026: 24 (03..06 = 4, 09..13 = 9, 16..19 = 13, 23 = 14, 24 = 15).
    expect(janelaDaData('2026-11-04', janelas, FERIADOS)).toBe(0);
    expect(janelaDaData('2026-11-24', janelas, FERIADOS)).toBe(1);
    expect(janelaDaData('2026-11-12', janelas, FERIADOS)).toBeNull();
  });

  it('dia fixo em dia não útil vale no próximo dia útil', () => {
    // FUSEX "dia 03 e 16": em out/2026 o dia 03 é sábado → segunda 05.
    const janelas = [{ tipo: 'dias_fixos' as const, dias: [3, 16] }];
    expect(janelaDaData('2026-10-05', janelas, FERIADOS)).toBe(0);
    expect(janelaDaData('2026-10-16', janelas, FERIADOS)).toBe(0);
    expect(janelaDaData('2026-10-03', janelas, FERIADOS)).toBeNull();
    expect(janelaDaData('2026-10-06', janelas, FERIADOS)).toBeNull();
  });

  it('último dia útil considera o feriado do fim do mês', () => {
    const janelas = [{ tipo: 'ultimo_dia_util' as const }];
    expect(janelaDaData('2026-11-27', janelas, FERIADOS)).toBe(0);
    expect(janelaDaData('2026-11-30', janelas, FERIADOS)).toBeNull();
  });

  it('todos os dias e calendário do convênio aceitam qualquer data', () => {
    expect(janelaDaData('2026-11-18', [{ tipo: 'todos_os_dias' }], FERIADOS)).toBe(0);
    expect(janelaDaData('2026-11-18', [{ tipo: 'calendario_convenio' }], FERIADOS)).toBe(0);
  });
});

// Novembro/2026 com os FERIADOS acima: 1º dia útil = 03, 5º = 09; último dia útil = 27.
describe('classificarAgendamento', () => {
  const AMIL = { janelas: [{ tipo: 'dias_corridos' as const, de: 1, ate: 15 }] };

  it('pendente enquanto a data prevista não passou', () => {
    const agendamento = { dataPrevista: '2026-11-10', dataEnvio: null };
    expect(classificarAgendamento(agendamento, AMIL, FERIADOS, '2026-11-09')).toEqual({ status: 'pendente', foraDaJanela: false });
    expect(classificarAgendamento(agendamento, AMIL, FERIADOS, '2026-11-10')).toEqual({ status: 'pendente', foraDaJanela: false });
  });

  it('atrasado quando a data prevista passou sem envio, ainda dentro da janela', () => {
    const agendamento = { dataPrevista: '2026-11-10', dataEnvio: null };
    expect(classificarAgendamento(agendamento, AMIL, FERIADOS, '2026-11-11').status).toBe('atrasado');
    expect(classificarAgendamento(agendamento, AMIL, FERIADOS, '2026-11-15').status).toBe('atrasado');
  });

  it('enviado vence atrasado e fora do prazo', () => {
    const agendamento = { dataPrevista: '2026-11-10', dataEnvio: '2026-11-12' };
    expect(classificarAgendamento(agendamento, AMIL, FERIADOS, '2026-11-11').status).toBe('enviado');
    expect(classificarAgendamento(agendamento, AMIL, FERIADOS, '2026-12-01').status).toBe('enviado');
  });

  it('fora do prazo quando hoje passou do último dia da janela', () => {
    const agendamento = { dataPrevista: '2026-11-10', dataEnvio: null };
    expect(classificarAgendamento(agendamento, AMIL, FERIADOS, '2026-11-16').status).toBe('fora_do_prazo');
  });

  it('o prazo é o fim da janela daquele agendamento (TRT: 1º–2º e 15º–16º dia útil)', () => {
    const TRT = {
      janelas: [
        { tipo: 'dias_uteis' as const, de: 1, ate: 2 },
        { tipo: 'dias_uteis' as const, de: 15, ate: 16 },
      ],
    };
    // 2º dia útil = 04; 16º = 25.
    const primeira = { dataPrevista: '2026-11-03', dataEnvio: null };
    expect(classificarAgendamento(primeira, TRT, FERIADOS, '2026-11-04').status).toBe('atrasado');
    expect(classificarAgendamento(primeira, TRT, FERIADOS, '2026-11-05').status).toBe('fora_do_prazo');
    const segunda = { dataPrevista: '2026-11-24', dataEnvio: null };
    expect(classificarAgendamento(segunda, TRT, FERIADOS, '2026-11-25').status).toBe('atrasado');
    expect(classificarAgendamento(segunda, TRT, FERIADOS, '2026-11-26').status).toBe('fora_do_prazo');
  });

  it('dias fixos e último dia útil: o prazo é o próprio dia', () => {
    const FUSEX = { janelas: [{ tipo: 'dias_fixos' as const, dias: [3, 16] }] };
    expect(classificarAgendamento({ dataPrevista: '2026-11-03', dataEnvio: null }, FUSEX, FERIADOS, '2026-11-04').status).toBe('fora_do_prazo');
    const CBMDF = { janelas: [{ tipo: 'ultimo_dia_util' as const }] };
    expect(classificarAgendamento({ dataPrevista: '2026-11-27', dataEnvio: null }, CBMDF, FERIADOS, '2026-11-30').status).toBe('fora_do_prazo');
  });

  it('agendado fora da janela: o prazo é o fim da próxima janela; depois de todas, o próprio dia', () => {
    const TRT = {
      janelas: [
        { tipo: 'dias_uteis' as const, de: 1, ate: 2 },
        { tipo: 'dias_uteis' as const, de: 15, ate: 16 },
      ],
    };
    const noMeio = { dataPrevista: '2026-11-12', dataEnvio: null };
    expect(classificarAgendamento(noMeio, TRT, FERIADOS, '2026-11-25').status).toBe('atrasado');
    expect(classificarAgendamento(noMeio, TRT, FERIADOS, '2026-11-26').status).toBe('fora_do_prazo');
    const depois = { dataPrevista: '2026-11-18', dataEnvio: null };
    expect(classificarAgendamento(depois, AMIL, FERIADOS, '2026-11-19').status).toBe('fora_do_prazo');
  });

  it('"todos os dias" e "calendário do convênio" nunca ficam fora do prazo', () => {
    const agendamento = { dataPrevista: '2026-11-10', dataEnvio: null };
    expect(classificarAgendamento(agendamento, { janelas: [{ tipo: 'todos_os_dias' }] }, FERIADOS, '2027-01-20').status).toBe('atrasado');
    expect(classificarAgendamento(agendamento, { janelas: [{ tipo: 'calendario_convenio' }] }, FERIADOS, '2027-01-20').status).toBe('atrasado');
  });

  it('selo "fora da janela" quando a data prevista ou a de envio cai fora de todas as janelas do mês', () => {
    expect(classificarAgendamento({ dataPrevista: '2026-11-10', dataEnvio: null }, AMIL, FERIADOS, '2026-11-09').foraDaJanela).toBe(false);
    expect(classificarAgendamento({ dataPrevista: '2026-11-18', dataEnvio: null }, AMIL, FERIADOS, '2026-11-09')).toEqual({ status: 'pendente', foraDaJanela: true });
    expect(classificarAgendamento({ dataPrevista: '2026-11-10', dataEnvio: '2026-11-17' }, AMIL, FERIADOS, '2026-11-18')).toEqual({ status: 'enviado', foraDaJanela: true });
    // Enviado no mês seguinte: fora da janela do mês do agendamento, mesmo no dia 1.
    expect(classificarAgendamento({ dataPrevista: '2026-11-10', dataEnvio: '2026-12-01' }, AMIL, FERIADOS, '2026-12-01').foraDaJanela).toBe(true);
    expect(classificarAgendamento({ dataPrevista: '2026-11-10', dataEnvio: '2026-11-12' }, AMIL, FERIADOS, '2026-12-01').foraDaJanela).toBe(false);
  });

  it('"todos os dias" e "calendário do convênio" nunca levam o selo', () => {
    const agendamento = { dataPrevista: '2026-11-18', dataEnvio: '2026-12-02' };
    expect(classificarAgendamento(agendamento, { janelas: [{ tipo: 'todos_os_dias' }] }, FERIADOS, '2026-12-02').foraDaJanela).toBe(false);
    expect(classificarAgendamento(agendamento, { janelas: [{ tipo: 'calendario_convenio' }] }, FERIADOS, '2026-12-02').foraDaJanela).toBe(false);
  });
});
