import { describe, expect, it } from 'vitest';
import {
  fatorTabelaColaborador,
  precoColaborador,
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

describe('precoColaborador', () => {
  it('custo 9,73 com os parâmetros da planilha aprovada → R$ 19,66 (19,6565… arredondado em centavos)', () => {
    expect(precoColaborador({ custo: 9.73, precoParticular: 50 }, PLANILHA)).toEqual({ disponivel: true, valor: 19.66 });
  });

  it('meio centavo sobe, sem erro de ponto flutuante (1,01 ÷ 0,4 = 2,525 → 2,53)', () => {
    const fator04 = { ...PLANILHA, parcelaA: 60, parcelaB: 0 };
    expect(precoColaborador({ custo: 1.01, precoParticular: null }, fator04)).toEqual({ disponivel: true, valor: 2.53 });
  });

  it('custo zero ou ausente → sem custo, mesmo sem preço Particular', () => {
    const semCusto = { disponivel: false, motivo: 'sem_custo' };
    expect(precoColaborador({ custo: 0, precoParticular: 100 }, PLANILHA)).toEqual(semCusto);
    expect(precoColaborador({ custo: null, precoParticular: 100 }, PLANILHA)).toEqual(semCusto);
    expect(precoColaborador({ custo: 0, precoParticular: null }, PLANILHA)).toEqual(semCusto);
  });

  it('custo maior ou igual ao particular → custo ≥ particular', () => {
    const motivo = { disponivel: false, motivo: 'custo_maior_ou_igual_particular' };
    expect(precoColaborador({ custo: 50, precoParticular: 50 }, PLANILHA)).toEqual(motivo);
    expect(precoColaborador({ custo: 60, precoParticular: 50 }, PLANILHA)).toEqual(motivo);
  });

  it('valor colaborador a partir do limite do particular → pouca vantagem', () => {
    // 44,55 ÷ 0,495 = 90,00 = 90% de 100
    expect(precoColaborador({ custo: 44.55, precoParticular: 100 }, PLANILHA)).toEqual({
      disponivel: false,
      motivo: 'pouca_vantagem',
    });
    // 44,54 ÷ 0,495 = 89,98 < 90
    expect(precoColaborador({ custo: 44.54, precoParticular: 100 }, PLANILHA)).toEqual({ disponivel: true, valor: 89.98 });
  });

  it('a pouca vantagem compara o valor já arredondado', () => {
    // 13,36 ÷ 0,495 = 26,9899… → 26,99; 90% de 29,99 = 26,991: 26,99 fica abaixo
    expect(precoColaborador({ custo: 13.36, precoParticular: 29.99 }, PLANILHA)).toEqual({ disponivel: true, valor: 26.99 });
    // 13,37 ÷ 0,495 = 27,0101… → 27,01 ≥ 26,991
    expect(precoColaborador({ custo: 13.37, precoParticular: 29.99 }, PLANILHA).disponivel).toBe(false);
  });

  it('sem preço Particular fica disponível mesmo com valor alto', () => {
    expect(precoColaborador({ custo: 495, precoParticular: null }, PLANILHA)).toEqual({ disponivel: true, valor: 1000 });
  });

  it('mudar um parâmetro muda o valor e a pouca vantagem', () => {
    expect(precoColaborador({ custo: 10, precoParticular: null }, { ...PLANILHA, parcelaA: 40, parcelaB: 10 })).toEqual({
      disponivel: true,
      valor: 20,
    });
    expect(precoColaborador({ custo: 44.54, precoParticular: 100 }, { ...PLANILHA, limitePoucaVantagem: 0.8 }).disponivel).toBe(
      false,
    );
  });
});
