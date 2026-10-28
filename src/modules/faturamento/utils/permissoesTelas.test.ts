import { describe, expect, it } from 'vitest';
import { chavesQueAbremTela, podeVerTela, primeiraTelaPermitida, TELAS_FATURAMENTO } from './permissoesTelas';

describe('permissão de ver uma tela do Faturamento (ADR 0001)', () => {
  it('canViewBilling abre todas as telas', () => {
    for (const { tela } of TELAS_FATURAMENTO) {
      expect(podeVerTela(['canViewBilling'], tela)).toBe(true);
    }
    expect(podeVerTela(['canViewBilling'], 'calendarioEnvios')).toBe(true);
  });

  it('a chave da tela abre só aquela tela', () => {
    const permissoes = ['canViewContasReceber'];
    expect(podeVerTela(permissoes, 'contasReceber')).toBe(true);
    expect(podeVerTela(permissoes, 'faturas')).toBe(false);
    expect(podeVerTela(permissoes, 'glosas')).toBe(false);
    expect(podeVerTela(permissoes, 'indicadores')).toBe(false);
    expect(podeVerTela(permissoes, 'calendarioEnvios')).toBe(false);
  });

  it('cada tela tem a sua chave', () => {
    expect(chavesQueAbremTela('faturas')).toEqual(['canViewBilling', 'canViewFaturas']);
    expect(chavesQueAbremTela('contasReceber')).toEqual(['canViewBilling', 'canViewContasReceber']);
    expect(chavesQueAbremTela('glosas')).toEqual(['canViewBilling', 'canViewGlosas']);
    expect(chavesQueAbremTela('indicadores')).toEqual(['canViewBilling', 'canViewIndicadores']);
    expect(chavesQueAbremTela('calendarioEnvios')).toEqual(['canViewBilling', 'canViewCalendarioEnvios']);
  });

  it('gerir o Calendário não abre a tela sem a chave de ver', () => {
    expect(podeVerTela(['canManageCalendarioEnvios'], 'calendarioEnvios')).toBe(false);
  });

  it('sem nenhuma chave, nenhuma tela', () => {
    for (const { tela } of TELAS_FATURAMENTO) {
      expect(podeVerTela([], tela)).toBe(false);
    }
  });

  describe('primeira tela permitida (entrada do menu)', () => {
    it('com canViewBilling é Faturas', () => {
      expect(primeiraTelaPermitida(['canViewBilling'])).toBe('/faturamento/faturas');
    });

    it('só com Contas a Receber é Contas a Receber', () => {
      expect(primeiraTelaPermitida(['canViewContasReceber'])).toBe('/faturamento/recebimentos');
    });

    it('segue a ordem do menu', () => {
      expect(primeiraTelaPermitida(['canViewIndicadores', 'canViewGlosas'])).toBe('/faturamento/glosas');
    });

    it('sem nenhuma tela é null', () => {
      expect(primeiraTelaPermitida(['canManageBilling'])).toBeNull();
    });
  });
});
