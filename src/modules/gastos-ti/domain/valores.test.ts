import { describe, expect, it } from 'vitest';
import { formatarValorCampo, parseValorBR } from './valores';

describe('parseValorBR', () => {
  it('aceita os formatos brasileiros', () => {
    expect(parseValorBR('2.480,00')).toBe(2480);
    expect(parseValorBR('2480,5')).toBe(2480.5);
    expect(parseValorBR('2480')).toBe(2480);
    expect(parseValorBR('R$ 1.234.567,89')).toBe(1234567.89);
    expect(parseValorBR(' 99,90 ')).toBe(99.9);
  });

  it('ponto sem vírgula: milhar só em grupos de 3, senão decimal', () => {
    expect(parseValorBR('2.480')).toBe(2480);
    expect(parseValorBR('1.234.567')).toBe(1234567);
    expect(parseValorBR('2480.50')).toBe(2480.5);
    expect(parseValorBR('2.5')).toBe(2.5);
  });

  it('número já numérico (vindo do Excel) é arredondado a 2 casas', () => {
    expect(parseValorBR(2480)).toBe(2480);
    expect(parseValorBR(10.005)).toBe(10.01);
    expect(parseValorBR(Number.NaN)).toBeNull();
  });

  it('o que não é valor vira null', () => {
    expect(parseValorBR('')).toBeNull();
    expect(parseValorBR('abc')).toBeNull();
    expect(parseValorBR('1,2,3')).toBeNull();
    expect(parseValorBR(null)).toBeNull();
  });
});

describe('formatarValorCampo', () => {
  it('usa milhar e 2 casas no padrão brasileiro', () => {
    expect(formatarValorCampo(2480)).toBe('2.480,00');
    expect(formatarValorCampo(0.5)).toBe('0,50');
    expect(formatarValorCampo(null)).toBe('');
  });
});
