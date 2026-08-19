import { describe, expect, it } from 'vitest';
import { dayKey, janelaDoPreset, janelaEfetiva, statusIgnoraPeriodo } from './periodo';

describe('dayKey', () => {
  it('formata com zero à esquerda em mês e dia', () => {
    expect(dayKey(new Date(2024, 2, 5))).toBe('2024-03-05');
  });

  it('formata mês e dia de dois dígitos sem zero extra', () => {
    expect(dayKey(new Date(2024, 10, 23))).toBe('2024-11-23');
  });
});

describe('janelaDoPreset', () => {
  const hoje = new Date(2024, 2, 15); // 2024-03-15

  it('preset "mes" vai do dia 1 do mês até hoje', () => {
    expect(janelaDoPreset('mes', hoje)).toEqual({
      periodoIni: '2024-03-01',
      periodoFim: '2024-03-15',
    });
  });

  it('preset 30 cobre os últimos 30 dias (inclusive hoje)', () => {
    expect(janelaDoPreset(30, hoje)).toEqual({
      periodoIni: '2024-02-15',
      periodoFim: '2024-03-15',
    });
  });

  it('preset 90 cobre os últimos 90 dias (inclusive hoje)', () => {
    expect(janelaDoPreset(90, hoje)).toEqual({
      periodoIni: '2023-12-17',
      periodoFim: '2024-03-15',
    });
  });

  it('preset "custom" usa as datas informadas quando ini <= fim', () => {
    expect(
      janelaDoPreset('custom', hoje, { ini: '2024-01-01', fim: '2024-01-31' }),
    ).toEqual({ periodoIni: '2024-01-01', periodoFim: '2024-01-31' });
  });

  it('preset "custom" troca ini/fim quando vêm invertidos', () => {
    expect(
      janelaDoPreset('custom', hoje, { ini: '2024-01-31', fim: '2024-01-01' }),
    ).toEqual({ periodoIni: '2024-01-01', periodoFim: '2024-01-31' });
  });

  it('preset "custom" sem ini/fim cai no padrão de 30 dias', () => {
    expect(janelaDoPreset('custom', hoje)).toEqual({
      periodoIni: '2024-02-15',
      periodoFim: '2024-03-15',
    });
  });

  it('não muta a data recebida', () => {
    const referencia = new Date(2024, 2, 15, 13, 45);
    janelaDoPreset('mes', referencia);
    expect(referencia.getHours()).toBe(13);
  });
});

describe('janelaEfetiva', () => {
  const hoje = new Date(2024, 2, 15); // 2024-03-15

  it('status Prejuízo (8) com preset padrão ignora o período: mostra o ano atual inteiro', () => {
    expect(janelaEfetiva('mes', 8, hoje)).toEqual({
      periodoIni: '2024-01-01',
      periodoFim: '2024-03-15',
      ignorandoPeriodo: true,
    });
  });

  it('status Prejuízo com preset "custom" respeita o período escolhido pelo usuário', () => {
    expect(
      janelaEfetiva('custom', 8, hoje, { ini: '2024-01-01', fim: '2024-01-31' }),
    ).toEqual({ periodoIni: '2024-01-01', periodoFim: '2024-01-31', ignorandoPeriodo: false });
  });

  it('outros status seguem o preset normalmente', () => {
    expect(janelaEfetiva(30, 3, hoje)).toEqual({
      periodoIni: '2024-02-15',
      periodoFim: '2024-03-15',
      ignorandoPeriodo: false,
    });
  });

  it('sem filtro de status (0 = "Todos") segue o preset normalmente', () => {
    expect(janelaEfetiva('mes', 0, hoje)).toEqual({
      periodoIni: '2024-03-01',
      periodoFim: '2024-03-15',
      ignorandoPeriodo: false,
    });
  });

  it('status Recebido - parcial (7) com preset padrão também ignora o período: o lote leva semanas/meses após criado para chegar nesse status, então "criado neste mês" quase nunca coincide com "já está parcial"', () => {
    expect(janelaEfetiva('mes', 7, hoje)).toEqual({
      periodoIni: '2024-01-01',
      periodoFim: '2024-03-15',
      ignorandoPeriodo: true,
    });
  });

  it('status Recebido - parcial com preset "custom" respeita o período escolhido pelo usuário', () => {
    expect(
      janelaEfetiva('custom', 7, hoje, { ini: '2024-01-01', fim: '2024-01-31' }),
    ).toEqual({ periodoIni: '2024-01-01', periodoFim: '2024-01-31', ignorandoPeriodo: false });
  });

  it('protocolos duplicados com preset padrão também ignora o período, mesmo sem filtro de status', () => {
    expect(
      janelaEfetiva('mes', 0, hoje, undefined, { somenteProtocoloDuplicado: true }),
    ).toEqual({ periodoIni: '2024-01-01', periodoFim: '2024-03-15', ignorandoPeriodo: true });
  });

  it('protocolos duplicados com preset "custom" respeita o período escolhido pelo usuário', () => {
    expect(
      janelaEfetiva('custom', 0, hoje, { ini: '2024-01-01', fim: '2024-01-31' }, { somenteProtocoloDuplicado: true }),
    ).toEqual({ periodoIni: '2024-01-01', periodoFim: '2024-01-31', ignorandoPeriodo: false });
  });

  it('protocolos duplicados e status sem prazo juntos continuam ignorando o período (não é aditivo, só um ou/outro já basta)', () => {
    expect(
      janelaEfetiva('mes', 8, hoje, undefined, { somenteProtocoloDuplicado: true }),
    ).toEqual({ periodoIni: '2024-01-01', periodoFim: '2024-03-15', ignorandoPeriodo: true });
  });

  it('o início do ano usado é o de `agora`, não um valor fixo — em janeiro cobre só o ano corrente', () => {
    const janeiro = new Date(2025, 0, 10); // 2025-01-10
    expect(janelaEfetiva('mes', 8, janeiro)).toEqual({
      periodoIni: '2025-01-01',
      periodoFim: '2025-01-10',
      ignorandoPeriodo: true,
    });
  });
});

describe('statusIgnoraPeriodo', () => {
  it('true para Prejuízo (8) e Recebido - parcial (7)', () => {
    expect(statusIgnoraPeriodo(8)).toBe(true);
    expect(statusIgnoraPeriodo(7)).toBe(true);
  });

  it('false para os demais status, inclusive "Todos" (0)', () => {
    expect(statusIgnoraPeriodo(0)).toBe(false);
    expect(statusIgnoraPeriodo(3)).toBe(false);
    expect(statusIgnoraPeriodo(4)).toBe(false);
  });
});
