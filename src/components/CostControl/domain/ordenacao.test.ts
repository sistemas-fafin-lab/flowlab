import { describe, expect, it } from 'vitest';
import { ORDENACAO_PADRAO, alternarOrdenacao, ordenar, type EstadoOrdenacao } from './ordenacao';

describe('alternarOrdenacao', () => {
  it('clicar numa coluna sem ordenação atual começa crescente', () => {
    expect(alternarOrdenacao(ORDENACAO_PADRAO, 'nome')).toEqual({ coluna: 'nome', direcao: 'asc' });
  });

  it('clicar de novo na mesma coluna crescente vira decrescente', () => {
    const atual: EstadoOrdenacao = { coluna: 'nome', direcao: 'asc' };
    expect(alternarOrdenacao(atual, 'nome')).toEqual({ coluna: 'nome', direcao: 'desc' });
  });

  it('um terceiro clique na mesma coluna remove a ordenação (volta ao padrão)', () => {
    const atual: EstadoOrdenacao = { coluna: 'nome', direcao: 'desc' };
    expect(alternarOrdenacao(atual, 'nome')).toEqual(ORDENACAO_PADRAO);
  });

  it('clicar numa coluna diferente da atual reinicia no crescente', () => {
    const atual: EstadoOrdenacao = { coluna: 'nome', direcao: 'desc' };
    expect(alternarOrdenacao(atual, 'valor')).toEqual({ coluna: 'valor', direcao: 'asc' });
  });
});

interface Item {
  nome: string;
  valor: number;
}

const itens: Item[] = [
  { nome: 'Bradesco', valor: 20 },
  { nome: 'Amil', valor: 5 },
  { nome: 'Unimed', valor: 12.5 },
];

const valorDaColuna = (item: Item, coluna: string): string | number =>
  coluna === 'valor' ? item.valor : item.nome;

const comparadorPadrao = (a: Item, b: Item) => a.valor - b.valor;

describe('ordenar', () => {
  it('sem coluna/direção customizada, aplica o comparador padrão', () => {
    expect(ordenar(itens, ORDENACAO_PADRAO, valorDaColuna, comparadorPadrao)).toEqual([
      itens[1], // Amil, 5
      itens[2], // Unimed, 12.5
      itens[0], // Bradesco, 20
    ]);
  });

  it('ordena coluna de texto alfabeticamente, crescente', () => {
    expect(ordenar(itens, { coluna: 'nome', direcao: 'asc' }, valorDaColuna, comparadorPadrao)).toEqual([
      itens[1], // Amil
      itens[0], // Bradesco
      itens[2], // Unimed
    ]);
  });

  it('ordena coluna de texto alfabeticamente, decrescente', () => {
    expect(ordenar(itens, { coluna: 'nome', direcao: 'desc' }, valorDaColuna, comparadorPadrao)).toEqual([
      itens[2], // Unimed
      itens[0], // Bradesco
      itens[1], // Amil
    ]);
  });

  it('ordena coluna numérica crescente', () => {
    expect(ordenar(itens, { coluna: 'valor', direcao: 'asc' }, valorDaColuna, comparadorPadrao)).toEqual([
      itens[1], // 5
      itens[2], // 12.5
      itens[0], // 20
    ]);
  });

  it('ordena coluna numérica decrescente', () => {
    expect(ordenar(itens, { coluna: 'valor', direcao: 'desc' }, valorDaColuna, comparadorPadrao)).toEqual([
      itens[0], // 20
      itens[2], // 12.5
      itens[1], // 5
    ]);
  });

  it('não muta o array original', () => {
    const copia = [...itens];
    ordenar(itens, { coluna: 'nome', direcao: 'asc' }, valorDaColuna, comparadorPadrao);
    expect(itens).toEqual(copia);
  });
});
