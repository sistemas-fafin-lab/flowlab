import { describe, expect, it } from 'vitest';
import { dayKey, janelaDoPreset } from './periodo';

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
