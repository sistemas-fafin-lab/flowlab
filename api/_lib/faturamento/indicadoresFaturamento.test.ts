import { describe, expect, it } from 'vitest';
import { erroDoPeriodo, janelasDoPeriodo, resumirIndicadores } from './indicadoresFaturamento.js';
import type { LinhaFaturada } from './indicadoresFaturamento.js';

const SETEMBRO = janelasDoPeriodo({ modo: 'mes', mes: '2026-09' });

function linha(overrides: Partial<LinhaFaturada> = {}): LinhaFaturada {
  return {
    idLote: 1,
    dataLote: '2026-09-10',
    idRequisicao: 100,
    codigo: '40301630',
    descricao: 'HEMOGRAMA COMPLETO',
    quantidade: 1,
    valorLiquido: 10,
    fontePagadoraId: 10,
    fontePagadoraNome: 'CASSI',
    localOrigemId: 500,
    localOrigemNome: 'CLÍNICA A',
    ...overrides,
  };
}

describe('resumirIndicadores — cards', () => {
  it('requisição com vários procedimentos conta uma vez; quantidade maior que 1 soma nos exames', () => {
    const { cards } = resumirIndicadores([
      linha({ idRequisicao: 100, quantidade: 1, valorLiquido: 10 }),
      linha({ idRequisicao: 100, codigo: '40302040', quantidade: 2, valorLiquido: 30.5 }),
      linha({ idRequisicao: 101, quantidade: 1, valorLiquido: 9.5 }),
    ], SETEMBRO);

    expect(cards.totalFaturado.atual).toBe(50);
    expect(cards.requisicoes.atual).toBe(2);
    expect(cards.exames.atual).toBe(4);
  });

  it('as linhas da janela anterior não entram na atual, e as de fora das duas são ignoradas', () => {
    const { cards } = resumirIndicadores([
      linha({ dataLote: '2026-09-01', idRequisicao: 1, valorLiquido: 100 }),
      linha({ dataLote: '2026-09-30', idRequisicao: 2, valorLiquido: 50 }),
      linha({ dataLote: '2026-08-31', idRequisicao: 3, valorLiquido: 70, quantidade: 3 }),
      linha({ dataLote: '2026-10-01', idRequisicao: 4, valorLiquido: 999 }),
    ], SETEMBRO);

    expect(cards.totalFaturado).toMatchObject({ atual: 150, anterior: 70 });
    expect(cards.requisicoes).toMatchObject({ atual: 2, anterior: 1 });
    expect(cards.exames).toMatchObject({ atual: 2, anterior: 3 });
  });

  it('variação sobre o mês anterior: positiva, negativa e com uma casa', () => {
    const { cards } = resumirIndicadores([
      linha({ dataLote: '2026-09-05', idRequisicao: 1, valorLiquido: 150, quantidade: 1 }),
      linha({ dataLote: '2026-08-05', idRequisicao: 2, valorLiquido: 100, quantidade: 3 }),
      linha({ dataLote: '2026-08-05', idRequisicao: 3, valorLiquido: 0, quantidade: 3 }),
    ], SETEMBRO);

    expect(cards.totalFaturado.variacao).toBe(50);
    expect(cards.requisicoes.variacao).toBe(-50);
    expect(cards.exames.variacao).toBe(-83.3);
  });

  it('variação nula quando o mês anterior é zero', () => {
    const { cards } = resumirIndicadores([linha({ dataLote: '2026-09-05' })], SETEMBRO);

    expect(cards.totalFaturado.variacao).toBeNull();
    expect(cards.requisicoes.variacao).toBeNull();
    expect(cards.exames.variacao).toBeNull();
  });
});

describe('janelasDoPeriodo', () => {
  it('modo Mês: o mês inteiro e o mês anterior', () => {
    expect(janelasDoPeriodo({ modo: 'mes', mes: '2026-09' })).toEqual({
      atual: { inicio: '2026-09-01', fim: '2026-09-30' },
      anterior: { inicio: '2026-08-01', fim: '2026-08-31' },
    });
  });

  it('modo Mês: janeiro compara com dezembro do ano anterior', () => {
    expect(janelasDoPeriodo({ modo: 'mes', mes: '2026-01' })).toEqual({
      atual: { inicio: '2026-01-01', fim: '2026-01-31' },
      anterior: { inicio: '2025-12-01', fim: '2025-12-31' },
    });
  });

  it('modo Mês: março compara com fevereiro de ano bissexto', () => {
    expect(janelasDoPeriodo({ modo: 'mes', mes: '2028-03' }).anterior).toEqual({
      inicio: '2028-02-01',
      fim: '2028-02-29',
    });
  });

  it('modo Período: o anterior tem o mesmo número de dias e cruza a virada de mês', () => {
    expect(janelasDoPeriodo({ modo: 'periodo', inicio: '2026-10-01', fim: '2026-10-15' })).toEqual({
      atual: { inicio: '2026-10-01', fim: '2026-10-15' },
      anterior: { inicio: '2026-09-16', fim: '2026-09-30' },
    });
  });

  it('modo Período: um dia só compara com o dia anterior, inclusive na virada de ano', () => {
    expect(janelasDoPeriodo({ modo: 'periodo', inicio: '2026-01-01', fim: '2026-01-01' })).toEqual({
      atual: { inicio: '2026-01-01', fim: '2026-01-01' },
      anterior: { inicio: '2025-12-31', fim: '2025-12-31' },
    });
  });

  it('modo Período: o fim é inclusivo — um lote no último dia conta na atual', () => {
    const janelas = janelasDoPeriodo({ modo: 'periodo', inicio: '2026-10-01', fim: '2026-10-15' });
    const { cards } = resumirIndicadores([
      linha({ dataLote: '2026-10-15', idRequisicao: 1, valorLiquido: 40 }),
      linha({ dataLote: '2026-09-16', idRequisicao: 2, valorLiquido: 20 }),
      linha({ dataLote: '2026-09-15', idRequisicao: 3, valorLiquido: 999 }),
    ], janelas);

    expect(cards.totalFaturado).toMatchObject({ atual: 40, anterior: 20, variacao: 100 });
  });
});

describe('erroDoPeriodo', () => {
  it('aceita um período válido, inclusive de um dia', () => {
    expect(erroDoPeriodo('2026-10-01', '2026-10-15')).toBeNull();
    expect(erroDoPeriodo('2026-10-01', '2026-10-01')).toBeNull();
  });

  it('recusa fim antes do início', () => {
    expect(erroDoPeriodo('2026-10-15', '2026-10-01')).toBe('O fim do período deve ser igual ou posterior ao início.');
  });

  it('recusa datas que não existem ou fora do formato', () => {
    expect(erroDoPeriodo('2026-02-30', '2026-03-01')).toBe('Parâmetro inválido: inicio (YYYY-MM-DD).');
    expect(erroDoPeriodo('2026-10-01', '15/10/2026')).toBe('Parâmetro inválido: fim (YYYY-MM-DD).');
    expect(erroDoPeriodo('', '2026-10-01')).toBe('Parâmetro inválido: inicio (YYYY-MM-DD).');
  });
});

describe('resumirIndicadores — ranking de convênios', () => {
  it('agrupa pela fonte pagadora do lote, e o Particular é uma fonte qualquer', () => {
    const { rankings } = resumirIndicadores([
      linha({ idLote: 1, idRequisicao: 1, fontePagadoraId: 10, fontePagadoraNome: 'CASSI', valorLiquido: 30, quantidade: 1 }),
      linha({ idLote: 2, idRequisicao: 2, fontePagadoraId: 10, fontePagadoraNome: 'CASSI', valorLiquido: 20, quantidade: 2 }),
      linha({ idLote: 3, idRequisicao: 3, fontePagadoraId: 1102, fontePagadoraNome: 'PARTICULAR', valorLiquido: 40, quantidade: 1 }),
      linha({ dataLote: '2026-08-10', fontePagadoraId: 20, fontePagadoraNome: 'UNIMED', valorLiquido: 999 }),
    ], SETEMBRO);

    expect(rankings.convenios.porValor).toEqual([
      { nome: 'CASSI', valor: 50, quantidade: 3 },
      { nome: 'PARTICULAR', valor: 40, quantidade: 1 },
    ]);
  });

  it('a ordem por valor é diferente da ordem por quantidade', () => {
    const { rankings } = resumirIndicadores([
      linha({ fontePagadoraId: 10, fontePagadoraNome: 'CASSI', valorLiquido: 500, quantidade: 2 }),
      linha({ fontePagadoraId: 20, fontePagadoraNome: 'UNIMED', valorLiquido: 100, quantidade: 9 }),
      linha({ fontePagadoraId: 30, fontePagadoraNome: 'BRADESCO', valorLiquido: 300, quantidade: 5 }),
    ], SETEMBRO);

    expect(rankings.convenios.porValor.map((c) => c.nome)).toEqual(['CASSI', 'BRADESCO', 'UNIMED']);
    expect(rankings.convenios.porQuantidade.map((c) => c.nome)).toEqual(['UNIMED', 'BRADESCO', 'CASSI']);
  });

  it('corta no Top 10, nas duas ordens', () => {
    // Fonte i: valor cresce com i, quantidade decresce com i.
    const linhas = Array.from({ length: 12 }, (_, i) =>
      linha({ fontePagadoraId: i + 1, fontePagadoraNome: `F${i + 1}`, valorLiquido: (i + 1) * 10, quantidade: 13 - (i + 1) }));
    const { rankings } = resumirIndicadores(linhas, SETEMBRO);

    expect(rankings.convenios.porValor.map((c) => c.nome)).toEqual(
      ['F12', 'F11', 'F10', 'F9', 'F8', 'F7', 'F6', 'F5', 'F4', 'F3']);
    expect(rankings.convenios.porQuantidade.map((c) => c.nome)).toEqual(
      ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10']);
  });
});

describe('resumirIndicadores — ranking de exames', () => {
  it('o mesmo código com descrições diferentes vira uma barra, com a descrição mais frequente pela quantidade', () => {
    const { rankings } = resumirIndicadores([
      // 2 linhas de 1 na CASSI, 1 linha de 3 na UNIMED: a da UNIMED pesa mais.
      linha({ fontePagadoraId: 10, codigo: '40301630', descricao: 'HEMOGRAMA COMPLETO', quantidade: 1, valorLiquido: 10 }),
      linha({ fontePagadoraId: 10, codigo: '40301630', descricao: 'HEMOGRAMA COMPLETO', quantidade: 1, valorLiquido: 10 }),
      linha({ fontePagadoraId: 20, codigo: '40301630', descricao: 'HEMOGRAMA C/ PLAQUETAS', quantidade: 3, valorLiquido: 25 }),
      linha({ codigo: '40302040', descricao: 'GLICOSE', quantidade: 1, valorLiquido: 5 }),
    ], SETEMBRO);

    expect(rankings.exames.porValor).toEqual([
      { nome: '40301630 - HEMOGRAMA C/ PLAQUETAS', valor: 45, quantidade: 5 },
      { nome: '40302040 - GLICOSE', valor: 5, quantidade: 1 },
    ]);
  });

  it('no empate de peso, a descrição não depende da ordem das linhas', () => {
    const a = linha({ codigo: '40301630', descricao: 'HEMOGRAMA', quantidade: 2 });
    const b = linha({ codigo: '40301630', descricao: 'HEMOGRAMA COMPLETO', quantidade: 2 });

    const nomes = [[a, b], [b, a]].map((linhas) => resumirIndicadores(linhas, SETEMBRO).rankings.exames.porValor[0].nome);

    expect(nomes).toEqual(['40301630 - HEMOGRAMA', '40301630 - HEMOGRAMA']);
  });

  it('a ordem por valor é diferente da ordem por quantidade', () => {
    const { rankings } = resumirIndicadores([
      linha({ codigo: '1', descricao: 'TSH', valorLiquido: 500, quantidade: 2 }),
      linha({ codigo: '2', descricao: 'GLICOSE', valorLiquido: 100, quantidade: 9 }),
      linha({ codigo: '3', descricao: 'UREIA', valorLiquido: 300, quantidade: 5 }),
    ], SETEMBRO);

    expect(rankings.exames.porValor.map((e) => e.nome)).toEqual(['1 - TSH', '3 - UREIA', '2 - GLICOSE']);
    expect(rankings.exames.porQuantidade.map((e) => e.nome)).toEqual(['2 - GLICOSE', '3 - UREIA', '1 - TSH']);
  });

  it('corta no Top 10, nas duas ordens', () => {
    // Exame i: valor cresce com i, quantidade decresce com i.
    const linhas = Array.from({ length: 12 }, (_, i) =>
      linha({ codigo: `E${i + 1}`, descricao: 'X', valorLiquido: (i + 1) * 10, quantidade: 13 - (i + 1) }));
    const { rankings } = resumirIndicadores(linhas, SETEMBRO);

    expect(rankings.exames.porValor.map((e) => e.nome)).toEqual(
      ['E12', 'E11', 'E10', 'E9', 'E8', 'E7', 'E6', 'E5', 'E4', 'E3'].map((c) => `${c} - X`));
    expect(rankings.exames.porQuantidade.map((e) => e.nome)).toEqual(
      ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10'].map((c) => `${c} - X`));
  });
});

describe('resumirIndicadores — ranking de clínicas', () => {
  it('a quantidade é o número de requisições distintas, mesmo com vários procedimentos', () => {
    const { rankings } = resumirIndicadores([
      linha({ idRequisicao: 100, codigo: '1', quantidade: 2, valorLiquido: 10 }),
      linha({ idRequisicao: 100, codigo: '2', quantidade: 1, valorLiquido: 20 }),
      linha({ idRequisicao: 101, codigo: '1', quantidade: 1, valorLiquido: 5 }),
    ], SETEMBRO);

    expect(rankings.clinicas.porValor).toEqual([{ nome: 'CLÍNICA A', valor: 35, quantidade: 2 }]);
  });

  it('as requisições sem Local de Origem viram "Sem clínica"', () => {
    const { rankings } = resumirIndicadores([
      linha({ idRequisicao: 1, localOrigemId: null, localOrigemNome: null, valorLiquido: 10 }),
      linha({ idRequisicao: 2, localOrigemId: null, localOrigemNome: null, valorLiquido: 15 }),
      linha({ idRequisicao: 3, valorLiquido: 5 }),
    ], SETEMBRO);

    expect(rankings.clinicas.porValor).toEqual([
      { nome: 'Sem clínica', valor: 25, quantidade: 2 },
      { nome: 'CLÍNICA A', valor: 5, quantidade: 1 },
    ]);
  });

  it('a ordem por valor é diferente da ordem por quantidade', () => {
    const clinica = (id: number, nome: string) => ({ localOrigemId: id, localOrigemNome: nome });
    const { rankings } = resumirIndicadores([
      // A: 1 requisição cara. B: 3 requisições baratas. C: 2 requisições médias.
      linha({ idRequisicao: 1, ...clinica(1, 'A'), valorLiquido: 900 }),
      linha({ idRequisicao: 2, ...clinica(2, 'B'), valorLiquido: 10 }),
      linha({ idRequisicao: 3, ...clinica(2, 'B'), valorLiquido: 10 }),
      linha({ idRequisicao: 4, ...clinica(2, 'B'), valorLiquido: 10 }),
      linha({ idRequisicao: 5, ...clinica(3, 'C'), valorLiquido: 100 }),
      linha({ idRequisicao: 6, ...clinica(3, 'C'), valorLiquido: 100 }),
    ], SETEMBRO);

    expect(rankings.clinicas.porValor.map((c) => c.nome)).toEqual(['A', 'C', 'B']);
    expect(rankings.clinicas.porQuantidade.map((c) => c.nome)).toEqual(['B', 'C', 'A']);
  });

  it('corta no Top 10', () => {
    const linhas = Array.from({ length: 12 }, (_, i) =>
      linha({ idRequisicao: i, localOrigemId: i, localOrigemNome: `C${i}`, valorLiquido: i + 1 }));

    expect(resumirIndicadores(linhas, SETEMBRO).rankings.clinicas.porValor).toHaveLength(10);
  });
});
