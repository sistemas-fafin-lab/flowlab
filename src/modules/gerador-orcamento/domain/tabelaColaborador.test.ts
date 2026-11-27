import { describe, expect, it } from 'vitest';
import {
  fatorTabelaColaborador,
  validarParametrosTabelaColaborador,
  type ConfiguracaoTabelaColaborador,
} from './tabelaColaborador';

const PLANILHA: ConfiguracaoTabelaColaborador = {
  parcelaA: 48,
  parcelaB: 2.5,
  limitePoucaVantagem: 0.9,
  rotuloParcelaA: 'Parcela A',
  rotuloParcelaB: 'Parcela B',
};

describe('fatorTabelaColaborador', () => {
  it('com as parcelas da planilha aprovada (48% e 2,5%) o fator é 0,495', () => {
    expect(fatorTabelaColaborador({ parcelaA: 48, parcelaB: 2.5 })).toBeCloseTo(0.495, 10);
  });

  it('muda quando uma parcela muda', () => {
    expect(fatorTabelaColaborador({ parcelaA: 40, parcelaB: 10 })).toBeCloseTo(0.5, 10);
  });
});

describe('validarParametrosTabelaColaborador', () => {
  it('os parâmetros da planilha aprovada não têm erro', () => {
    expect(validarParametrosTabelaColaborador(PLANILHA)).toEqual({});
  });

  it('recusa parcelas que somam 100% ou mais (fator ≤ 0)', () => {
    expect(validarParametrosTabelaColaborador({ ...PLANILHA, parcelaA: 97.5 })).toEqual({
      fator: 'As parcelas precisam somar menos de 100% (fator maior que zero).',
    });
    expect(validarParametrosTabelaColaborador({ ...PLANILHA, parcelaA: 98 }).fator).toBeDefined();
    expect(validarParametrosTabelaColaborador({ ...PLANILHA, parcelaA: 97.4 })).toEqual({});
  });

  it('recusa parcela negativa ou que não é número', () => {
    expect(validarParametrosTabelaColaborador({ ...PLANILHA, parcelaA: -1 })).toEqual({
      parcelaA: 'Informe um percentual maior ou igual a zero.',
    });
    expect(validarParametrosTabelaColaborador({ ...PLANILHA, parcelaB: Number.NaN })).toEqual({
      parcelaB: 'Informe um percentual maior ou igual a zero.',
    });
    expect(validarParametrosTabelaColaborador({ ...PLANILHA, parcelaB: 0 })).toEqual({});
  });

  it('recusa limite de pouca vantagem fora de (0%, 100%]', () => {
    const erro = { limitePoucaVantagem: 'Informe um limite maior que 0% e até 100%.' };
    expect(validarParametrosTabelaColaborador({ ...PLANILHA, limitePoucaVantagem: 0 })).toEqual(erro);
    expect(validarParametrosTabelaColaborador({ ...PLANILHA, limitePoucaVantagem: 1.01 })).toEqual(erro);
    expect(validarParametrosTabelaColaborador({ ...PLANILHA, limitePoucaVantagem: Number.NaN })).toEqual(erro);
    expect(validarParametrosTabelaColaborador({ ...PLANILHA, limitePoucaVantagem: 1 })).toEqual({});
  });

  it('recusa rótulo de parcela vazio', () => {
    expect(validarParametrosTabelaColaborador({ ...PLANILHA, rotuloParcelaA: '   ', rotuloParcelaB: '' })).toEqual({
      rotuloParcelaA: 'Informe o nome da parcela.',
      rotuloParcelaB: 'Informe o nome da parcela.',
    });
  });
});
