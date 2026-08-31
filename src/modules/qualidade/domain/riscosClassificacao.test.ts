import { describe, expect, it } from 'vitest';
import {
  FAIXAS_CLASSIFICACAO_PADRAO,
  classificarScore,
  faixasSaoValidas,
  resolverFaixasClassificacao,
} from './riscosClassificacao.js';

describe('classificarScore', () => {
  it('classifica com as faixas padrão do documento do cliente', () => {
    expect(classificarScore(3, FAIXAS_CLASSIFICACAO_PADRAO)).toBe('baixo');
    expect(classificarScore(9, FAIXAS_CLASSIFICACAO_PADRAO)).toBe('medio');
    expect(classificarScore(15, FAIXAS_CLASSIFICACAO_PADRAO)).toBe('alto');
    expect(classificarScore(25, FAIXAS_CLASSIFICACAO_PADRAO)).toBe('critico');
  });

  it('score nulo (P/S ainda não informados) não é classificado', () => {
    expect(classificarScore(null)).toBeNull();
  });

  it('respeita faixas customizadas configuradas pelo usuário', () => {
    const faixasCustom = [
      { min: 1, max: 10, nivel: 'baixo' as const },
      { min: 11, max: 25, nivel: 'critico' as const },
    ];
    expect(classificarScore(10, faixasCustom)).toBe('baixo');
    expect(classificarScore(11, faixasCustom)).toBe('critico');
  });
});

describe('faixasSaoValidas', () => {
  it('aceita as faixas padrão', () => {
    expect(faixasSaoValidas(FAIXAS_CLASSIFICACAO_PADRAO)).toBe(true);
  });

  it('rejeita faixas com buraco (não cobre 1–25)', () => {
    expect(
      faixasSaoValidas([
        { min: 1, max: 4, nivel: 'baixo' },
        { min: 6, max: 25, nivel: 'critico' },
      ]),
    ).toBe(false);
  });

  it('rejeita faixas com sobreposição', () => {
    expect(
      faixasSaoValidas([
        { min: 1, max: 10, nivel: 'baixo' },
        { min: 9, max: 25, nivel: 'critico' },
      ]),
    ).toBe(false);
  });

  it('rejeita lista vazia', () => {
    expect(faixasSaoValidas([])).toBe(false);
  });
});

describe('resolverFaixasClassificacao', () => {
  it('usa a configuração quando válida', () => {
    const configuradas = [
      { min: 1, max: 12, nivel: 'baixo' as const },
      { min: 13, max: 25, nivel: 'critico' as const },
    ];
    expect(resolverFaixasClassificacao(configuradas)).toEqual(configuradas);
  });

  it('cai para as faixas padrão quando a configuração é inválida', () => {
    expect(resolverFaixasClassificacao([{ min: 1, max: 10, nivel: 'baixo' }])).toEqual(FAIXAS_CLASSIFICACAO_PADRAO);
  });

  it('cai para as faixas padrão quando não há configuração', () => {
    expect(resolverFaixasClassificacao(null)).toEqual(FAIXAS_CLASSIFICACAO_PADRAO);
    expect(resolverFaixasClassificacao(undefined)).toEqual(FAIXAS_CLASSIFICACAO_PADRAO);
  });
});
