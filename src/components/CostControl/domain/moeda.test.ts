import { describe, expect, it } from 'vitest';
import { escreverMoeda, lerMoeda } from './moeda';

describe('lerMoeda', () => {
  it('lê o formato brasileiro com milhar e vírgula', () => {
    expect(lerMoeda('1.234,56')).toBe(1234.56);
  });

  it('lê vírgula decimal sem milhar', () => {
    expect(lerMoeda('12,5')).toBe(12.5);
  });

  it('lê ponto decimal de planilha', () => {
    expect(lerMoeda('1234.56')).toBe(1234.56);
  });

  it('ponto com três dígitos depois é milhar, não decimal', () => {
    expect(lerMoeda('1.234')).toBe(1234);
  });

  it('ignora o prefixo R$ e espaços colados junto', () => {
    expect(lerMoeda('R$ 28,00')).toBe(28);
  });

  it('campo vazio ou sem número vira 0', () => {
    expect(lerMoeda('')).toBe(0);
    expect(lerMoeda('abc')).toBe(0);
  });

  it('vírgula sozinha no fim (ainda digitando) lê a parte inteira', () => {
    expect(lerMoeda('15,')).toBe(15);
  });
});

describe('escreverMoeda', () => {
  it('formata com milhar e duas casas', () => {
    expect(escreverMoeda(1234.5)).toBe('1.234,50');
  });

  it('zero vira 0,00', () => {
    expect(escreverMoeda(0)).toBe('0,00');
  });
});
