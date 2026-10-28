import { describe, expect, it } from 'vitest';
import {
  casarLotes,
  classificarAgendamento,
  ehDiaUtil,
  gerarSugestaoDoMes,
  janelaDaData,
  proximoDiaUtil,
  regrasDeQualquerDia,
  validarJanelas,
} from './calendarioEnvios.js';
import type { AgendamentoDoMes, AgendamentoParaCasar, JanelaEnvio, LoteEnviado } from './calendarioEnvios.js';

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

describe('regrasDeQualquerDia', () => {
  const regra = (id: string, janelas: JanelaEnvio[], ativo = true) => ({ id, janelas, ativo });

  it('lista as regras ativas de "todos os dias" e deixa de fora as desativadas e as de janela com dias', () => {
    const regras = [
      regra('bradesco', [{ tipo: 'todos_os_dias' }]),
      regra('amil', [{ tipo: 'dias_corridos', de: 1, ate: 15 }]),
      regra('plan', [{ tipo: 'calendario_convenio' }]),
      regra('sis', [{ tipo: 'todos_os_dias' }], false),
      regra('pmdf', [{ tipo: 'todos_os_dias' }]),
    ];
    expect(regrasDeQualquerDia(regras).map((r) => r.id)).toEqual(['bradesco', 'pmdf']);
  });
});

describe('validarJanelas', () => {
  it('aceita cada tipo de janela e devolve só os campos dela', () => {
    const janelas = [
      { tipo: 'dias_corridos', de: 1, ate: 15, extra: 'x' },
      { tipo: 'dias_uteis', de: 1, ate: 5 },
      { tipo: 'dias_fixos', dias: [16, 3] },
      { tipo: 'ultimo_dia_util' },
      { tipo: 'todos_os_dias' },
      { tipo: 'calendario_convenio', de: 2 },
    ];
    expect(validarJanelas(janelas)).toEqual({
      janelas: [
        { tipo: 'dias_corridos', de: 1, ate: 15 },
        { tipo: 'dias_uteis', de: 1, ate: 5 },
        { tipo: 'dias_fixos', dias: [3, 16] },
        { tipo: 'ultimo_dia_util' },
        { tipo: 'todos_os_dias' },
        { tipo: 'calendario_convenio' },
      ],
    });
  });

  it('exige ao menos uma janela', () => {
    expect(validarJanelas([])).toHaveProperty('erro');
    expect(validarJanelas(undefined)).toHaveProperty('erro');
    expect(validarJanelas({ tipo: 'todos_os_dias' })).toHaveProperty('erro');
  });

  it('recusa faixa com início depois do fim', () => {
    expect(validarJanelas([{ tipo: 'dias_corridos', de: 16, ate: 15 }])).toEqual({ erro: 'Janela 1: o início (16) passa do fim (15).' });
    expect(validarJanelas([{ tipo: 'dias_uteis', de: 3, ate: 3 }])).toEqual({ janelas: [{ tipo: 'dias_uteis', de: 3, ate: 3 }] });
  });

  it('dias corridos e dias fixos vão de 1 a 31; dias úteis, de 1 a 23', () => {
    expect(validarJanelas([{ tipo: 'dias_corridos', de: 1, ate: 31 }])).not.toHaveProperty('erro');
    expect(validarJanelas([{ tipo: 'dias_corridos', de: 0, ate: 10 }])).toHaveProperty('erro');
    expect(validarJanelas([{ tipo: 'dias_corridos', de: 1, ate: 32 }])).toHaveProperty('erro');
    expect(validarJanelas([{ tipo: 'dias_uteis', de: 1, ate: 23 }])).not.toHaveProperty('erro');
    expect(validarJanelas([{ tipo: 'dias_uteis', de: 1, ate: 24 }])).toHaveProperty('erro');
    expect(validarJanelas([{ tipo: 'dias_fixos', dias: [1, 31] }])).not.toHaveProperty('erro');
    expect(validarJanelas([{ tipo: 'dias_fixos', dias: [32] }])).toHaveProperty('erro');
  });

  it('recusa número fracionado, texto ou ausente', () => {
    expect(validarJanelas([{ tipo: 'dias_corridos', de: 1.5, ate: 10 }])).toHaveProperty('erro');
    expect(validarJanelas([{ tipo: 'dias_uteis', de: '1', ate: 5 }])).toHaveProperty('erro');
    expect(validarJanelas([{ tipo: 'dias_corridos', de: 1 }])).toHaveProperty('erro');
    expect(validarJanelas([{ tipo: 'dias_fixos', dias: [3, 'x'] }])).toHaveProperty('erro');
  });

  it('dias fixos precisam de ao menos um dia, sem repetir', () => {
    expect(validarJanelas([{ tipo: 'dias_fixos', dias: [] }])).toHaveProperty('erro');
    expect(validarJanelas([{ tipo: 'dias_fixos' }])).toHaveProperty('erro');
    expect(validarJanelas([{ tipo: 'dias_fixos', dias: [3, 16, 3] }])).toEqual({ janelas: [{ tipo: 'dias_fixos', dias: [3, 16] }] });
  });

  it('diz qual janela está errada', () => {
    const janelas = [{ tipo: 'dias_uteis', de: 1, ate: 2 }, { tipo: 'dias_uteis', de: 15, ate: 30 }];
    expect(validarJanelas(janelas)).toEqual({ erro: 'Janela 2: dias úteis vão de 1 a 23.' });
    expect(validarJanelas([{ tipo: 'semanal' }])).toEqual({ erro: 'Janela 1: tipo de janela inválido.' });
  });
});

// Novembro/2026 com os FERIADOS acima: dias úteis 03–06, 09–13, 16–19 e 23–27 (18 dias).
describe('gerarSugestaoDoMes', () => {
  const regra = (id: string, janelas: JanelaEnvio[], enviosSugeridosMes: number | null = null) => ({
    id,
    janelas,
    enviosSugeridosMes,
    ativo: true,
  });

  /** As datas criadas para cada regra, em ordem. */
  const datasPorRegra = (criar: { regraId: string; dataPrevista: string }[]) => {
    const mapa: Record<string, string[]> = {};
    for (const { regraId, dataPrevista } of criar) (mapa[regraId] ??= []).push(dataPrevista);
    for (const datas of Object.values(mapa)) datas.sort();
    return mapa;
  };

  it('faixa de dias corridos num mês vazio vai para o primeiro dia útil da faixa', () => {
    const { criar, remover } = gerarSugestaoDoMes('2026-11', [regra('AMIL', [{ tipo: 'dias_corridos', de: 1, ate: 15 }])], FERIADOS, []);
    expect(criar).toEqual([{ regraId: 'AMIL', dataPrevista: '2026-11-03', janelaIndice: 0 }]);
    expect(remover).toEqual([]);
  });

  /** Agendamento que já está no mês (de outra regra, por padrão manual). */
  const existente = (id: string, regraId: string, dataPrevista: string, extra: Partial<AgendamentoDoMes> = {}): AgendamentoDoMes => ({
    id,
    regraId,
    dataPrevista,
    origem: 'manual',
    editado: false,
    dataEnvio: null,
    ...extra,
  });

  it('dias úteis pulam o feriado no meio da faixa e o dia mais carregado', () => {
    // 13º dia útil = 19; o 14º é 23, porque 20 é feriado. O dia 19 já tem um envio.
    const { criar } = gerarSugestaoDoMes(
      '2026-11',
      [regra('TRE', [{ tipo: 'dias_uteis', de: 13, ate: 14 }])],
      FERIADOS,
      [existente('x', 'OUTRA', '2026-11-19')],
    );
    expect(criar).toEqual([{ regraId: 'TRE', dataPrevista: '2026-11-23', janelaIndice: 0 }]);
  });

  it('dia fixo no sábado vai para o próximo dia útil, um agendamento por dia', () => {
    // FUSEX "dia 03 e 16": em out/2026 o dia 03 é sábado → segunda 05.
    const { criar } = gerarSugestaoDoMes('2026-10', [regra('FUSEX', [{ tipo: 'dias_fixos', dias: [3, 16] }])], FERIADOS, []);
    expect(criar).toEqual([
      { regraId: 'FUSEX', dataPrevista: '2026-10-05', janelaIndice: 0 },
      { regraId: 'FUSEX', dataPrevista: '2026-10-16', janelaIndice: 0 },
    ]);
  });

  it('último dia útil cai antes do feriado do fim do mês, mesmo carregado', () => {
    // 30/11 é feriado: o último dia útil é 27, que já tem dois envios.
    const { criar } = gerarSugestaoDoMes(
      '2026-11',
      [regra('CBMDF', [{ tipo: 'ultimo_dia_util' }])],
      FERIADOS,
      [existente('x', 'OUTRA', '2026-11-27'), existente('y', 'OUTRA', '2026-11-27')],
    );
    expect(criar).toEqual([{ regraId: 'CBMDF', dataPrevista: '2026-11-27', janelaIndice: 0 }]);
  });

  it('no empate de carga fica o dia mais cedo', () => {
    const { criar } = gerarSugestaoDoMes(
      '2026-11',
      [regra('AMPLA', [{ tipo: 'dias_corridos', de: 1, ate: 10 }]), regra('GEAP', [{ tipo: 'dias_corridos', de: 1, ate: 10 }])],
      FERIADOS,
      [],
    );
    expect(datasPorRegra(criar)).toEqual({ AMPLA: ['2026-11-03'], GEAP: ['2026-11-04'] });
  });

  it('dias fixos primeiro, depois as faixas das mais estreitas para as mais largas', () => {
    // Na ordem recebida, AMIL ficaria com o 03 e BRB com o 04, junto do FUSEX.
    const { criar } = gerarSugestaoDoMes(
      '2026-11',
      [
        regra('AMIL', [{ tipo: 'dias_corridos', de: 1, ate: 15 }]),
        regra('BRB', [{ tipo: 'dias_uteis', de: 1, ate: 2 }]),
        regra('FUSEX', [{ tipo: 'dias_fixos', dias: [4] }]),
      ],
      FERIADOS,
      [],
    );
    expect(datasPorRegra(criar)).toEqual({ FUSEX: ['2026-11-04'], BRB: ['2026-11-03'], AMIL: ['2026-11-05'] });
  });

  it('"todos os dias" com N envios: um em cada um dos N trechos seguidos, no dia mais vazio', () => {
    // 18 dias úteis em 4 trechos: 03–06, 09–13, 16–19, 23–27. O dia 03 já tem um envio.
    const { criar } = gerarSugestaoDoMes(
      '2026-11',
      [regra('BRADESCO', [{ tipo: 'todos_os_dias' }], 4)],
      FERIADOS,
      [existente('x', 'OUTRA', '2026-11-03')],
    );
    expect(datasPorRegra(criar)).toEqual({ BRADESCO: ['2026-11-04', '2026-11-09', '2026-11-16', '2026-11-23'] });
    expect(criar.every((c) => c.janelaIndice === 0)).toBe(true);
  });

  it('"todos os dias" vai depois das faixas, para os dias que sobraram', () => {
    const { criar } = gerarSugestaoDoMes(
      '2026-11',
      [regra('BRADESCO', [{ tipo: 'todos_os_dias' }], 1), regra('AMPLA', [{ tipo: 'dias_corridos', de: 1, ate: 3 }])],
      FERIADOS,
      [],
    );
    expect(datasPorRegra(criar)).toEqual({ AMPLA: ['2026-11-03'], BRADESCO: ['2026-11-04'] });
  });

  it('"todos os dias" sem N, "calendário do convênio" e regra desativada não geram nada', () => {
    const { criar } = gerarSugestaoDoMes(
      '2026-11',
      [
        regra('PMDF', [{ tipo: 'todos_os_dias' }]),
        regra('TST', [{ tipo: 'calendario_convenio' }]),
        { ...regra('AMIL', [{ tipo: 'dias_corridos', de: 1, ate: 15 }]), ativo: false },
      ],
      FERIADOS,
      [],
    );
    expect(criar).toEqual([]);
  });

  it('faixa sem dia útil no mês vai para o próximo dia útil, fora da janela', () => {
    // 21 e 22/11/2026 são sábado e domingo.
    const { criar } = gerarSugestaoDoMes('2026-11', [regra('STJ', [{ tipo: 'dias_corridos', de: 21, ate: 22 }])], FERIADOS, []);
    expect(criar).toEqual([{ regraId: 'STJ', dataPrevista: '2026-11-23', janelaIndice: null }]);
  });

  describe('regerar', () => {
    const AMIL = regra('AMIL', [{ tipo: 'dias_corridos', de: 1, ate: 15 }]);
    const TRT = regra('TRT', [
      { tipo: 'dias_uteis', de: 1, ate: 2 },
      { tipo: 'dias_uteis', de: 15, ate: 16 },
    ]);
    const sugerido = (id: string, regraId: string, dataPrevista: string, extra: Partial<AgendamentoDoMes> = {}) =>
      existente(id, regraId, dataPrevista, { origem: 'sugestao', ...extra });

    it('gerar de novo sem mudança não cria nem remove nada', () => {
      const primeira = gerarSugestaoDoMes('2026-11', [AMIL, TRT], FERIADOS, []);
      const existentes = primeira.criar.map((c, i) => sugerido(`s${i}`, c.regraId, c.dataPrevista));
      expect(gerarSugestaoDoMes('2026-11', [AMIL, TRT], FERIADOS, existentes)).toEqual({ criar: [], remover: [] });
    });

    it('refaz o sugerido pendente e não editado que mudou de lugar', () => {
      // AMIL passou a ser 10 ao 15: o sugerido do dia 03 sai e entra um no dia 10.
      const AMIL_NOVA = regra('AMIL', [{ tipo: 'dias_corridos', de: 10, ate: 15 }]);
      expect(gerarSugestaoDoMes('2026-11', [AMIL_NOVA], FERIADOS, [sugerido('s1', 'AMIL', '2026-11-03')])).toEqual({
        criar: [{ regraId: 'AMIL', dataPrevista: '2026-11-10', janelaIndice: 0 }],
        remover: ['s1'],
      });
    });

    it('a regra desativada perde os sugeridos pendentes', () => {
      const desativada = { ...AMIL, ativo: false };
      expect(gerarSugestaoDoMes('2026-11', [desativada], FERIADOS, [sugerido('s1', 'AMIL', '2026-11-03')]).remover).toEqual(['s1']);
    });

    it('preserva o manual na janela, o editado e o enviado, e não gera outro para a janela deles', () => {
      const existentes = [
        existente('m1', 'AMIL', '2026-11-12'), // manual dentro da janela de AMIL
        sugerido('e1', 'TRT', '2026-11-04', { editado: true }), // TRT 1º–2º, movido à mão
        sugerido('v1', 'TRT', '2026-11-24', { dataEnvio: '2026-11-24' }), // TRT 15º–16º, já enviado
      ];
      expect(gerarSugestaoDoMes('2026-11', [AMIL, TRT], FERIADOS, existentes)).toEqual({ criar: [], remover: [] });
    });

    it('o sugerido movido para fora da janela continua valendo pela janela mais próxima', () => {
      // TRT 15º–16º (24 e 25) movido para 27, fora das janelas: só a 1ª janela é gerada.
      const existentes = [sugerido('e1', 'TRT', '2026-11-27', { editado: true })];
      expect(gerarSugestaoDoMes('2026-11', [TRT], FERIADOS, existentes)).toEqual({
        criar: [{ regraId: 'TRT', dataPrevista: '2026-11-03', janelaIndice: 0 }],
        remover: [],
      });
    });

    it('o avulso manual fora da janela é um envio extra e não ocupa a janela', () => {
      const existentes = [existente('m1', 'AMIL', '2026-11-20')];
      expect(gerarSugestaoDoMes('2026-11', [AMIL], FERIADOS, existentes).criar).toEqual([
        { regraId: 'AMIL', dataPrevista: '2026-11-03', janelaIndice: 0 },
      ]);
    });

    it('"todos os dias": o manual ocupa o trecho em que caiu', () => {
      // Trechos de 2: 03–13 e 16–27. O manual no dia 05 ocupa o primeiro.
      const BRADESCO = regra('BRADESCO', [{ tipo: 'todos_os_dias' }], 2);
      const { criar } = gerarSugestaoDoMes('2026-11', [BRADESCO], FERIADOS, [existente('m1', 'BRADESCO', '2026-11-05')]);
      expect(datasPorRegra(criar)).toEqual({ BRADESCO: ['2026-11-16'] });
    });

    it('os sugeridos que saem não contam na carga dos dias', () => {
      // O sugerido de AMPLA no dia 03 vai ser refeito: o dia 03 não conta como ocupado.
      const { criar } = gerarSugestaoDoMes(
        '2026-11',
        [regra('AMPLA', [{ tipo: 'dias_corridos', de: 1, ate: 10 }])],
        FERIADOS,
        [sugerido('s1', 'GEAP', '2026-11-03')],
      );
      expect(criar).toEqual([{ regraId: 'AMPLA', dataPrevista: '2026-11-03', janelaIndice: 0 }]);
    });
  });
});

describe('casarLotes', () => {
  // AMIL (fonte 1007) envia de 1 a 15; FUSEX (1204) nos dias 3 e 16.
  const AMIL = { id: 'AMIL', janelas: [{ tipo: 'dias_corridos', de: 1, ate: 15 }] as JanelaEnvio[], fontesPagadoras: [1007], conveniosAplis: [] };
  const FUSEX = { id: 'FUSEX', janelas: [{ tipo: 'dias_fixos', dias: [3, 16] }] as JanelaEnvio[], fontesPagadoras: [1204], conveniosAplis: [] };
  const pendente = (id: string, regraId: string, dataPrevista: string): AgendamentoParaCasar => ({
    id, regraId, dataPrevista, dataEnvio: null, loteAplisConfirmado: null,
  });
  const lote = (idLote: number, fontePagadora: number, dataEnvio: string, convenios: number[] = []): LoteEnviado => ({
    idLote, fontePagadora, convenios, dataEnvio,
  });

  it('o lote casa com o agendamento pendente do convênio mais próximo da data de envio e o marca com ela', () => {
    const { confirmacoes, naoPlanejados } = casarLotes(
      [lote(7001, 1007, '2026-11-10')],
      [pendente('a', 'AMIL', '2026-11-04'), pendente('b', 'AMIL', '2026-11-12'), pendente('f', 'FUSEX', '2026-11-10')],
      [AMIL, FUSEX],
      FERIADOS,
    );
    expect(confirmacoes).toEqual([{ agendamentoId: 'b', idLote: 7001, dataEnvio: '2026-11-10', marcar: true }]);
    expect(naoPlanejados).toEqual([]);
  });

  it('lote fora da janela do agendamento, ou de outro mês, vai para os envios não planejados', () => {
    const atrasado = lote(7002, 1007, '2026-11-17');
    const doMesSeguinte = lote(7003, 1007, '2026-12-01');
    const { confirmacoes, naoPlanejados } = casarLotes(
      [atrasado, doMesSeguinte],
      [pendente('a', 'AMIL', '2026-11-13')],
      [AMIL],
      FERIADOS,
    );
    expect(confirmacoes).toEqual([]);
    expect(naoPlanejados).toEqual([atrasado, doMesSeguinte]);
  });

  it('cada agendamento recebe no máximo um lote: o segundo do mesmo dia vai para os não planejados', () => {
    const segundo = lote(7005, 1007, '2026-11-10');
    const { confirmacoes, naoPlanejados } = casarLotes(
      [lote(7004, 1007, '2026-11-10'), segundo],
      [pendente('a', 'AMIL', '2026-11-10')],
      [AMIL],
      FERIADOS,
    );
    expect(confirmacoes).toEqual([{ agendamentoId: 'a', idLote: 7004, dataEnvio: '2026-11-10', marcar: true }]);
    expect(naoPlanejados).toEqual([segundo]);
  });

  it('o segundo lote vai para o próximo agendamento pendente mais próximo, se houver', () => {
    const { confirmacoes } = casarLotes(
      [lote(7004, 1007, '2026-11-10'), lote(7005, 1007, '2026-11-10')],
      [pendente('a', 'AMIL', '2026-11-10'), pendente('b', 'AMIL', '2026-11-05')],
      [AMIL],
      FERIADOS,
    );
    expect(confirmacoes.map((c) => [c.agendamentoId, c.idLote])).toEqual([['a', 7004], ['b', 7005]]);
  });

  it('rodar de novo não muda nada: o lote já confirmado não confirma de novo nem vira não planejado', () => {
    const outro = lote(7005, 1007, '2026-11-10');
    const { confirmacoes, naoPlanejados } = casarLotes(
      [lote(7004, 1007, '2026-11-10'), outro],
      [{ id: 'a', regraId: 'AMIL', dataPrevista: '2026-11-10', dataEnvio: '2026-11-10', loteAplisConfirmado: 7004 }],
      [AMIL],
      FERIADOS,
    );
    expect(confirmacoes).toEqual([]);
    expect(naoPlanejados).toEqual([outro]);
  });

  it('agendamento já marcado à mão só ganha o selo: a data informada pela faturista prevalece', () => {
    const { confirmacoes } = casarLotes(
      [lote(7006, 1007, '2026-11-11')],
      [{ id: 'a', regraId: 'AMIL', dataPrevista: '2026-11-10', dataEnvio: '2026-11-10', loteAplisConfirmado: null }],
      [AMIL],
      FERIADOS,
    );
    expect(confirmacoes).toEqual([{ agendamentoId: 'a', idLote: 7006, dataEnvio: '2026-11-11', marcar: false }]);
  });

  it('o marcado à mão conta pela data de envio informada: o lote daquele dia é dele, não do pendente ao lado', () => {
    const { confirmacoes } = casarLotes(
      [lote(7007, 1007, '2026-11-05')],
      [
        { id: 'a', regraId: 'AMIL', dataPrevista: '2026-11-03', dataEnvio: '2026-11-05', loteAplisConfirmado: null },
        pendente('b', 'AMIL', '2026-11-06'),
      ],
      [AMIL],
      FERIADOS,
    );
    expect(confirmacoes).toEqual([{ agendamentoId: 'a', idLote: 7007, dataEnvio: '2026-11-05', marcar: false }]);
  });

  describe('agrupador AMHPDF', () => {
    // No apLIS, os membros do AMHPDF são convênios (requisicao.IdConvenio) da fonte AMHP-DF (1025).
    const TODOS = [{ tipo: 'todos_os_dias' }] as JanelaEnvio[];
    const AMHP = { id: 'AMHP', janelas: TODOS, fontesPagadoras: [1025], conveniosAplis: [] };
    const ONLINE = { id: 'ONLINE', janelas: TODOS, fontesPagadoras: [1025], conveniosAplis: [1042, 1003] }; // SERPRO, BACEN
    const FISICA = { id: 'FISICA', janelas: TODOS, fontesPagadoras: [1025], conveniosAplis: [1043] }; // PROASA

    it('o lote casa pelo convênio membro, não com qualquer agrupador da mesma fonte', () => {
      const { confirmacoes } = casarLotes(
        [lote(7100, 1025, '2026-11-10', [1043])],
        [pendente('amhp', 'AMHP', '2026-11-10'), pendente('online', 'ONLINE', '2026-11-10'), pendente('fisica', 'FISICA', '2026-11-12')],
        [AMHP, ONLINE, FISICA],
        FERIADOS,
      );
      expect(confirmacoes.map((c) => c.agendamentoId)).toEqual(['fisica']);
    });

    it('o lote de convênio que nenhum agrupador cobre fica com a regra da fonte inteira', () => {
      const { confirmacoes } = casarLotes(
        [lote(7101, 1025, '2026-11-10', [1082])], // REAL GRANDEZA
        [pendente('amhp', 'AMHP', '2026-11-13'), pendente('online', 'ONLINE', '2026-11-10')],
        [AMHP, ONLINE, FISICA],
        FERIADOS,
      );
      expect(confirmacoes.map((c) => c.agendamentoId)).toEqual(['amhp']);
    });

    it('o convênio membro só vale na fonte do agrupador: o mesmo id em outra fonte não é membro', () => {
      const EVIDA = { id: 'EVIDA', janelas: TODOS, fontesPagadoras: [1049], conveniosAplis: [] };
      const { confirmacoes } = casarLotes(
        [lote(7103, 1049, '2026-11-10', [1043])],
        [pendente('evida', 'EVIDA', '2026-11-10'), pendente('fisica', 'FISICA', '2026-11-10')],
        [EVIDA, FISICA],
        FERIADOS,
      );
      expect(confirmacoes.map((c) => c.agendamentoId)).toEqual(['evida']);
    });

    it('o lote do membro sem agendamento pendente do agrupador vai para os não planejados', () => {
      const membro = lote(7102, 1025, '2026-11-10', [1042]);
      const { confirmacoes, naoPlanejados } = casarLotes(
        [membro],
        [pendente('amhp', 'AMHP', '2026-11-10')],
        [AMHP, ONLINE, FISICA],
        FERIADOS,
      );
      expect(confirmacoes).toEqual([]);
      expect(naoPlanejados).toEqual([membro]);
    });
  });
});
