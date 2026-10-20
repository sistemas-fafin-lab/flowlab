import { describe, expect, it } from 'vitest';
import type { ItemGeradorOrcamento } from '../types';
import { calcularOrcamento, orcamentoDoCarrinho, type ItemOrcamento } from './orcamento';

// Portado de Tabela-Particular/lib/alvaro-orcamento/pricing.test.ts, com os limites
// logo abaixo de cada faixa.

const item = (preco: number, quantidade: number, elegivelDesconto: boolean): ItemOrcamento => ({
  preco,
  quantidade,
  elegivelDesconto,
});

const elegiveis = (n: number, preco = 1) => Array.from({ length: n }, () => item(preco, 1, true));

describe('calcularOrcamento', () => {
  it('lista vazia não quebra e não gera desconto', () => {
    expect(calcularOrcamento([])).toEqual({ valorTotal: 0, valorComDesconto: 0, percentualAplicado: 0, qtdElegiveis: 0 });
  });

  it('carrinho só com não elegíveis: sem desconto, mesmo acima dos limites de quantidade e valor', () => {
    const resultado = calcularOrcamento([...Array.from({ length: 10 }, () => item(50, 1, false)), item(1000, 1, false)]);

    expect(resultado).toEqual({ valorTotal: 1500, valorComDesconto: 1500, percentualAplicado: 0, qtdElegiveis: 0 });
  });

  it('elegíveis abaixo de ambos os limites: sem desconto', () => {
    const resultado = calcularOrcamento([item(50, 1, true), item(30, 1, true)]);

    expect(resultado.percentualAplicado).toBe(0);
    expect(resultado.valorComDesconto).toBe(80);
  });

  it('4 elegíveis distintos com valor baixo: sem desconto', () => {
    expect(calcularOrcamento(elegiveis(4, 10)).percentualAplicado).toBe(0);
  });

  it('exatamente 5 elegíveis distintos, valor baixo: 10%', () => {
    const resultado = calcularOrcamento(elegiveis(5, 10));

    expect(resultado.percentualAplicado).toBe(10);
    expect(resultado.valorTotal).toBe(50);
    expect(resultado.valorComDesconto).toBe(45);
  });

  it('R$299,99 em elegíveis com poucos exames: sem desconto', () => {
    expect(calcularOrcamento([item(299.99, 1, true)]).percentualAplicado).toBe(0);
  });

  it('exatamente R$300 em elegíveis com menos de 5 exames: 10%', () => {
    const resultado = calcularOrcamento([item(300, 1, true)]);

    expect(resultado.percentualAplicado).toBe(10);
    expect(resultado.valorComDesconto).toBe(270);
  });

  it('9 elegíveis distintos com valor baixo: 10%, não 15%', () => {
    expect(calcularOrcamento(elegiveis(9)).percentualAplicado).toBe(10);
  });

  it('exatamente 10 elegíveis distintos: 15%, mesmo com valor baixo', () => {
    const resultado = calcularOrcamento(elegiveis(10));

    expect(resultado.percentualAplicado).toBe(15);
    expect(resultado.valorTotal).toBe(10);
    expect(resultado.valorComDesconto).toBe(8.5);
  });

  it('R$999,99 em elegíveis com poucos exames: 10%, não 15%', () => {
    expect(calcularOrcamento([item(999.99, 1, true)]).percentualAplicado).toBe(10);
  });

  it('exatamente R$1.000 em elegíveis com menos de 10 exames: 15%, sem somar os 10%', () => {
    const resultado = calcularOrcamento([item(1000, 1, true)]);

    expect(resultado.percentualAplicado).toBe(15);
    expect(resultado.valorComDesconto).toBe(850);
  });

  it('quantidade > 1 conta o exame uma vez para a faixa, mas soma preço × quantidade no valor', () => {
    // 5 elegíveis distintos, um com quantidade 6: ainda 10%, nunca 15%.
    const resultado = calcularOrcamento([
      item(10, 6, true),
      item(10, 1, true),
      item(10, 1, true),
      item(10, 1, true),
      item(10, 1, true),
      item(10, 1, false),
    ]);

    expect(resultado.qtdElegiveis).toBe(5);
    expect(resultado.percentualAplicado).toBe(10);
    expect(resultado.valorTotal).toBe(110);
    expect(resultado.valorComDesconto).toBe(110 - 100 * 0.1);
  });

  it('quantidade > 1 leva o valor dos elegíveis à faixa de R$300', () => {
    const resultado = calcularOrcamento([item(100, 3, true)]);

    expect(resultado.qtdElegiveis).toBe(1);
    expect(resultado.percentualAplicado).toBe(10);
    expect(resultado.valorComDesconto).toBe(270);
  });

  it('não elegíveis nunca recebem desconto nem contam para a faixa', () => {
    // 4 elegíveis (R$40) + R$500 em não elegíveis: nenhuma faixa atingida.
    expect(calcularOrcamento([...elegiveis(4, 10), item(500, 1, false)]).percentualAplicado).toBe(0);

    // Com a faixa atingida, o desconto incide só sobre os R$100 dos elegíveis.
    const resultado = calcularOrcamento([...elegiveis(10, 10), item(100, 1, false)]);
    expect(resultado.percentualAplicado).toBe(15);
    expect(resultado.valorTotal).toBe(200);
    expect(resultado.valorComDesconto).toBe(185);
  });
});

describe('orcamentoDoCarrinho', () => {
  const exame = (nome: string, preco: number, elegivelDescontoParticular: boolean): ItemGeradorOrcamento => ({
    tuss: '40300000',
    nome,
    preco,
    elegivelDescontoParticular,
    conveniosAceitos: [],
  });

  it('usa a elegibilidade da lista de preços e a quantidade do carrinho', () => {
    const resultado = orcamentoDoCarrinho([
      { item: exame('Vitamina D', 150, true), quantidade: 2 },
      { item: exame('Painel Genético', 800, false), quantidade: 1 },
    ]);

    expect(resultado).toEqual({ valorTotal: 1100, valorComDesconto: 1070, percentualAplicado: 10, qtdElegiveis: 1 });
  });
});
