import { describe, expect, it } from 'vitest';
import { periodosDoAnoAte, montarGlosaPorMes } from './glosaPorMes';

describe('periodosDoAnoAte', () => {
  it('lista de janeiro até o mês de referência, com o primeiro e o último dia', () => {
    expect(periodosDoAnoAte('2026-03')).toEqual([
      { mes: '2026-01', desde: '2026-01-01', ate: '2026-01-31' },
      { mes: '2026-02', desde: '2026-02-01', ate: '2026-02-28' },
      { mes: '2026-03', desde: '2026-03-01', ate: '2026-03-31' },
    ]);
  });
});

// Valores da planilha da DRE (Análise de Faturamento jan–set/2026, aba dinâmica "Planilha2").
describe('montarGlosaPorMes', () => {
  const periodos = periodosDoAnoAte('2026-03')!;

  it('um item por mês, mês sem glosa vira zero, e o total soma os meses', () => {
    const resultado = montarGlosaPorMes(periodos, [
      { mes: '2026-01', valor: 25281.54, qtdCobrancas: 1733 },
      { mes: '2026-03', valor: 44088.59, qtdCobrancas: 980 },
    ]);

    expect(resultado).toEqual({
      meses: [
        { mes: '2026-01', valor: 25281.54, qtdCobrancas: 1733 },
        { mes: '2026-02', valor: 0, qtdCobrancas: 0 },
        { mes: '2026-03', valor: 44088.59, qtdCobrancas: 980 },
      ],
      total: { valor: 69370.13, qtdCobrancas: 2713 },
    });
  });

  it('ignora linhas de meses fora da lista', () => {
    const resultado = montarGlosaPorMes(periodos, [
      { mes: '2025-12', valor: 999, qtdCobrancas: 9 },
      { mes: '2026-04', valor: 29532.83, qtdCobrancas: 335 },
    ]);

    expect(resultado.total).toEqual({ valor: 0, qtdCobrancas: 0 });
  });
});
