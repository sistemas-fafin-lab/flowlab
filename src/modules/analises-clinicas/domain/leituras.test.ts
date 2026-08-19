import { describe, expect, it } from 'vitest';
import { normalizarTemperatura, validarLeitura } from './leituras';

describe('normalizarTemperatura', () => {
  it('aceita vírgula como separador decimal', () => {
    expect(normalizarTemperatura('4,5')).toBe(4.5);
  });

  it('aceita ponto como separador decimal', () => {
    expect(normalizarTemperatura('4.5')).toBe(4.5);
  });

  it('aceita inteiro e negativo', () => {
    expect(normalizarTemperatura('24')).toBe(24);
    expect(normalizarTemperatura('-3,2')).toBe(-3.2);
  });

  it('devolve null para vazio, espaços e texto inválido', () => {
    expect(normalizarTemperatura('')).toBeNull();
    expect(normalizarTemperatura('   ')).toBeNull();
    expect(normalizarTemperatura('abc')).toBeNull();
  });
});

describe('validarLeitura', () => {
  const agora = new Date('2026-08-19T12:00:00');

  const input = (patch: Partial<Parameters<typeof validarLeitura>[0]> = {}) => ({
    temperatura: '4,5',
    registradoPor: 'Ana',
    dataHora: '2026-08-19T11:00',
    frascos: [],
    ...patch,
  });

  it('aceita um formulário completo', () => {
    expect(validarLeitura(input(), agora)).toBeNull();
  });

  it('exige a temperatura lida', () => {
    expect(validarLeitura(input({ temperatura: '' }), agora)).toBe('Informe a temperatura lida.');
    expect(validarLeitura(input({ temperatura: 'abc' }), agora)).toBe('Informe a temperatura lida.');
  });

  it('exige quem registrou', () => {
    expect(validarLeitura(input({ registradoPor: '   ' }), agora)).toBe('Informe quem registrou.');
  });

  it('exige data e hora válidas', () => {
    expect(validarLeitura(input({ dataHora: '' }), agora)).toBe('Informe a data e hora da leitura.');
    expect(validarLeitura(input({ dataHora: '2026-13-99T25:61' }), agora)).toBe('Data e hora inválidas.');
  });

  it('barra data e hora no futuro, com tolerância de 1 minuto', () => {
    expect(validarLeitura(input({ dataHora: '2026-08-19T12:01' }), agora)).toBeNull();
    expect(validarLeitura(input({ dataHora: '2026-08-19T12:02' }), agora)).toBe(
      'A data e hora não podem estar no futuro.',
    );
  });

  it('exige quantidades de frasco inteiras', () => {
    expect(validarLeitura(input({ frascos: [{ quantidade: 2 }] }), agora)).toBeNull();
    expect(validarLeitura(input({ frascos: [{ quantidade: 2.5 }] }), agora)).toBe(
      'A quantidade de frascos deve ser um número inteiro.',
    );
  });
});
