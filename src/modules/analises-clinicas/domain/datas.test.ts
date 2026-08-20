import { describe, expect, it } from 'vitest';
import {
  dataKeyDeIso,
  diaSeguinteISO,
  ehSlotRetroativo,
  fimDaSemanaISO,
  fmtDiaSemana,
  hojeISO,
  janelaDoDia,
  janelaDoPresetData,
  parseDataLocal,
  rotuloDiaPassado,
  temDataRetroativa,
} from './datas';

describe('hojeISO', () => {
  it('devolve a data informada como chave YYYY-MM-DD local', () => {
    expect(hojeISO(new Date(2024, 2, 5))).toBe('2024-03-05');
  });

  it('usa a data atual quando nenhuma é informada', () => {
    expect(hojeISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('dataKeyDeIso', () => {
  it('devolve a chave local YYYY-MM-DD de um instante local', () => {
    expect(dataKeyDeIso('2024-03-05T09:00:00')).toBe('2024-03-05');
  });

  it('formata com zero à esquerda em mês e dia', () => {
    expect(dataKeyDeIso('2024-11-07T23:59:00')).toBe('2024-11-07');
  });
});

describe('parseDataLocal', () => {
  it('constrói a meia-noite local da chave, sem recuo de fuso', () => {
    const d = parseDataLocal('2024-03-05');
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(5);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('devolve data inválida para chave malformada', () => {
    expect(Number.isNaN(parseDataLocal('05/03/2024').getTime())).toBe(true);
  });
});

describe('janelaDoDia', () => {
  it('vai da meia-noite local ao fim do dia local', () => {
    const { inicio, fim } = janelaDoDia('2024-03-05');
    expect([inicio.getFullYear(), inicio.getMonth(), inicio.getDate()]).toEqual([2024, 2, 5]);
    expect([inicio.getHours(), inicio.getMinutes(), inicio.getSeconds(), inicio.getMilliseconds()]).toEqual([0, 0, 0, 0]);
    expect([fim.getFullYear(), fim.getMonth(), fim.getDate()]).toEqual([2024, 2, 5]);
    expect([fim.getHours(), fim.getMinutes(), fim.getSeconds(), fim.getMilliseconds()]).toEqual([23, 59, 59, 999]);
  });
});

describe('fmtDiaSemana', () => {
  it('formata "qua., 05/08" para uma quarta-feira', () => {
    expect(fmtDiaSemana('2026-08-05')).toBe('qua., 05/08');
  });

  it('formata com zero à esquerda em dia e mês', () => {
    expect(fmtDiaSemana('2026-01-09')).toBe('sex., 09/01');
  });
});

describe('rotuloDiaPassado', () => {
  const hoje = '2026-08-13';

  it('devolve null para hoje', () => {
    expect(rotuloDiaPassado('2026-08-13', hoje)).toBeNull();
  });

  it('devolve null para dias futuros', () => {
    expect(rotuloDiaPassado('2026-08-14', hoje)).toBeNull();
  });

  it('devolve "ontem" para o dia imediatamente anterior', () => {
    expect(rotuloDiaPassado('2026-08-12', hoje)).toBe('ontem');
  });

  it('devolve "retroativo" para dias anteriores a ontem', () => {
    expect(rotuloDiaPassado('2026-08-01', hoje)).toBe('retroativo');
  });

  it('calcula "ontem" contra a data atual quando o hoje não é informado', () => {
    const ontem = hojeISO(new Date(Date.now() - 86_400_000));
    expect(rotuloDiaPassado(ontem)).toBe('ontem');
  });
});

describe('temDataRetroativa', () => {
  const hoje = '2026-08-13';

  it('é falso quando todas as datas são hoje ou futuras', () => {
    expect(temDataRetroativa(['2026-08-13', '2026-08-14'], hoje)).toBe(false);
  });

  it('é verdadeiro quando alguma data já passou', () => {
    expect(temDataRetroativa(['2026-08-14', '2026-08-12'], hoje)).toBe(true);
  });

  it('é falso para lista vazia', () => {
    expect(temDataRetroativa([], hoje)).toBe(false);
  });
});

describe('ehSlotRetroativo', () => {
  const slot = '2026-08-13T09:00:00';

  it('é verdadeiro quando o horário já passou', () => {
    expect(ehSlotRetroativo(slot, new Date(2026, 7, 13, 10, 0))).toBe(true);
  });

  it('é falso quando o horário ainda vai acontecer', () => {
    expect(ehSlotRetroativo(slot, new Date(2026, 7, 13, 8, 0))).toBe(false);
  });

  it('é falso sem horário escolhido', () => {
    expect(ehSlotRetroativo('', new Date(2026, 7, 13, 8, 0))).toBe(false);
  });
});

describe('diaSeguinteISO', () => {
  it('devolve o dia seguinte no mesmo mês', () => {
    expect(diaSeguinteISO('2026-08-12')).toBe('2026-08-13');
  });

  it('rola para o mês seguinte', () => {
    expect(diaSeguinteISO('2026-01-31')).toBe('2026-02-01');
  });

  it('rola para o ano seguinte', () => {
    expect(diaSeguinteISO('2025-12-31')).toBe('2026-01-01');
  });
});

describe('fimDaSemanaISO', () => {
  it('avança de uma quarta-feira até o sábado da mesma semana', () => {
    expect(fimDaSemanaISO('2026-08-12')).toBe('2026-08-15');
  });

  it('avança de um domingo até o sábado da mesma semana', () => {
    expect(fimDaSemanaISO('2026-08-09')).toBe('2026-08-15');
  });

  it('devolve a própria data quando já é sábado', () => {
    expect(fimDaSemanaISO('2026-08-15')).toBe('2026-08-15');
  });
});

describe('janelaDoPresetData', () => {
  const hoje = '2026-08-12'; // quarta-feira

  it('"hoje" é uma janela de um único dia', () => {
    expect(janelaDoPresetData('hoje', hoje)).toEqual({ inicio: hoje, fim: hoje });
  });

  it('"amanha" é uma janela de um único dia, no dia seguinte', () => {
    expect(janelaDoPresetData('amanha', hoje)).toEqual({
      inicio: '2026-08-13',
      fim: '2026-08-13',
    });
  });

  it('"semana" vai de hoje até o sábado da semana atual', () => {
    expect(janelaDoPresetData('semana', hoje)).toEqual({
      inicio: '2026-08-12',
      fim: '2026-08-15',
    });
  });

  it('usa a data atual quando "hoje" não é informado', () => {
    const { inicio, fim } = janelaDoPresetData('hoje');
    expect(inicio).toBe(fim);
    expect(inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
