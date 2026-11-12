import { describe, expect, it } from 'vitest';
import { calcularCandidatas } from './metaSugerida';

// Elegíveis de jul–set/2026 da planilha do setor. Setembro está na issue 01; julho e
// agosto foram tirados das candidatas de outubro da planilha (issue 02), que é o que se
// quer reproduzir: 90/10 R$ 1.177.059,29, média de 3 R$ 1.103.521,18, média de 2
// R$ 1.138.669,22.
const PLANILHA = { '2026-07': 1_033_225.1, '2026-08': 1_090_681.63, '2026-09': 1_186_656.81 };

function valorDe(resultado: ReturnType<typeof calcularCandidatas>, origem: string) {
  return resultado.candidatas.find((c) => c.origem === origem)?.valor;
}

describe('calcularCandidatas', () => {
  it('reproduz até o centavo as candidatas de outubro/2026 da planilha', () => {
    const resultado = calcularCandidatas('2026-10', PLANILHA);

    expect(valorDe(resultado, '90_10')).toBe(1_177_059.29);
    expect(valorDe(resultado, 'media_2')).toBe(1_138_669.22);
    expect(valorDe(resultado, 'media_3')).toBe(1_103_521.18);
  });

  it('cada candidata informa os meses usados, do mais recente ao mais antigo', () => {
    expect(calcularCandidatas('2026-10', PLANILHA).candidatas).toEqual([
      { origem: '90_10', valor: 1_177_059.29, meses: ['2026-09', '2026-08'] },
      { origem: 'media_2', valor: 1_138_669.22, meses: ['2026-09', '2026-08'] },
      { origem: 'media_3', valor: 1_103_521.18, meses: ['2026-09', '2026-08', '2026-07'] },
    ]);
  });

  it('janeiro usa dezembro, novembro e outubro do ano anterior', () => {
    const resultado = calcularCandidatas('2027-01', { '2026-12': 100, '2026-11': 200, '2026-10': 300 });

    expect(resultado.candidatas.map((c) => c.meses)).toEqual([
      ['2026-12', '2026-11'],
      ['2026-12', '2026-11'],
      ['2026-12', '2026-11', '2026-10'],
    ]);
    expect(resultado.candidatas.map((c) => c.valor)).toEqual([110, 150, 200]);
  });

  it('mês sem Elegíveis deixa indisponíveis só as candidatas que o usam', () => {
    const resultado = calcularCandidatas('2026-10', { '2026-09': 100, '2026-08': 200 });

    expect(valorDe(resultado, '90_10')).toBe(110);
    expect(valorDe(resultado, 'media_2')).toBe(150);
    expect(valorDe(resultado, 'media_3')).toBeNull();
  });

  it('Elegíveis zero contam como valor, não como ausência', () => {
    const resultado = calcularCandidatas('2026-10', { '2026-09': 0, '2026-08': 0, '2026-07': 0 });

    expect(resultado.candidatas.map((c) => c.valor)).toEqual([0, 0, 0]);
  });

  it('arredonda o resultado em centavos', () => {
    const resultado = calcularCandidatas('2026-10', { '2026-09': 0.01, '2026-08': 0.02, '2026-07': 0.02 });

    // 0,009 + 0,002 = 0,011; (0,01 + 0,02) / 2 = 0,015; 0,05 / 3 = 0,0166…
    expect(resultado.candidatas.map((c) => c.valor)).toEqual([0.01, 0.02, 0.02]);
  });
});
