import { describe, expect, it } from 'vitest';
import type { Exam, Payor } from '../../../hooks/useCostControl';
import {
  buscarExamesPorTermo,
  buscarFontesPagadorasPorTermo,
  buscarTabelasAssociadasPorTermo,
  examesPorFontePagadora,
  fontesPagadorasPorTuss,
} from './busca';

const exame = (over: Partial<Exam>): Exam => ({
  id: 'e1',
  code: 'C1',
  tuss: '40304361',
  name: 'Hemograma completo',
  location: 'Unidade Central',
  direct: 10,
  indirect: 2,
  indirectItems: [],
  ...over,
});

const fonte = (over: Partial<Payor>): Payor => ({
  id: 'p1',
  payor: 'Unimed',
  table: 'Unimed Coop.',
  tus: '40304361',
  price: 9.2,
  atendido: true,
  elegivelDescontoParticular: false,
  ...over,
});

describe('buscarExamesPorTermo', () => {
  const exames = [
    exame({ id: 'e1', name: 'Hemograma completo', tuss: '40304361' }),
    exame({ id: 'e2', name: 'Glicemia de jejum', tuss: '40302040' }),
    exame({ id: 'e3', name: 'Colesterol total', tuss: '40304312' }),
  ];

  it('termo vazio devolve lista vazia', () => {
    expect(buscarExamesPorTermo(exames, '')).toEqual([]);
  });

  it('termo só com espaços devolve lista vazia', () => {
    expect(buscarExamesPorTermo(exames, '   ')).toEqual([]);
  });

  it('termo sem nenhum match devolve lista vazia', () => {
    expect(buscarExamesPorTermo(exames, 'inexistente')).toEqual([]);
  });

  it('casa por nome, parcial e case-insensitive', () => {
    expect(buscarExamesPorTermo(exames, 'HEMOgrama')).toEqual([exames[0]]);
  });

  it('casa ignorando acentos', () => {
    const comAcento = [exame({ id: 'e4', name: 'Colesterol LDL — avaliação', tuss: '40304399' })];
    expect(buscarExamesPorTermo(comAcento, 'avaliacao')).toEqual(comAcento);
  });

  it('casa de forma fuzzy, sem precisar ser substring contígua', () => {
    expect(buscarExamesPorTermo(exames, 'hmgcmplt')).toEqual([exames[0]]);
  });

  it('casa por código TUSS, parcial, não precisa ser o código completo', () => {
    expect(buscarExamesPorTermo(exames, '403043')).toEqual([exames[0], exames[2]]);
  });

  it('devolve múltiplos matches simultâneos', () => {
    expect(buscarExamesPorTermo(exames, '4030')).toEqual(exames);
  });
});

describe('fontesPagadorasPorTuss', () => {
  const fontes = [
    fonte({ id: 'p1', tus: '40304361', price: 12.5 }),
    fonte({ id: 'p2', tus: '40304361', price: 9.2 }),
    fonte({ id: 'p3', tus: '40302040', price: 4.8 }),
    fonte({ id: 'p4', tus: '40304361', price: 8.1 }),
  ];

  it('tuss vazio devolve lista vazia', () => {
    expect(fontesPagadorasPorTuss(fontes, '')).toEqual([]);
  });

  it('tuss sem nenhum match devolve lista vazia', () => {
    expect(fontesPagadorasPorTuss(fontes, '00000000')).toEqual([]);
  });

  it('devolve só as fontes pagadoras do TUSS informado, ordenadas por valor crescente', () => {
    expect(fontesPagadorasPorTuss(fontes, '40304361')).toEqual([
      fontes[3], // 8.10
      fontes[1], // 9.20
      fontes[0], // 12.50
    ]);
  });
});

describe('buscarFontesPagadorasPorTermo', () => {
  const fontes = [
    fonte({ id: 'p1', payor: 'Unimed', tus: '40304361' }),
    fonte({ id: 'p2', payor: 'Unimed', tus: '40302040' }),
    fonte({ id: 'p3', payor: 'Bradesco Saúde', tus: '40304312' }),
    fonte({ id: 'p4', payor: 'Hemoprev', tus: '99999999' }),
  ];

  it('termo vazio devolve lista vazia', () => {
    expect(buscarFontesPagadorasPorTermo(fontes, '')).toEqual([]);
  });

  it('termo sem nenhum match devolve lista vazia', () => {
    expect(buscarFontesPagadorasPorTermo(fontes, 'inexistente')).toEqual([]);
  });

  it('casa por nome, parcial e case-insensitive', () => {
    expect(buscarFontesPagadorasPorTermo(fontes, 'bradesco')).toEqual(['Bradesco Saúde']);
  });

  it('deduplica fonte pagadora com múltiplas linhas pelo nome', () => {
    expect(buscarFontesPagadorasPorTermo(fontes, 'unimed')).toEqual(['Unimed']);
  });

  it('casa ignorando acentos, nos dois sentidos', () => {
    expect(buscarFontesPagadorasPorTermo(fontes, 'saude')).toEqual(['Bradesco Saúde']);
    expect(buscarFontesPagadorasPorTermo(fontes, 'sAÚDE')).toEqual(['Bradesco Saúde']);
  });

  it('casa de forma fuzzy, sem precisar ser substring contígua', () => {
    expect(buscarFontesPagadorasPorTermo(fontes, 'brdscsaude')).toEqual(['Bradesco Saúde']);
  });
});

describe('buscarTabelasAssociadasPorTermo', () => {
  const fontes = [
    fonte({ id: 'p1', table: 'Unimed Coop.', tus: '40304361' }),
    fonte({ id: 'p2', table: 'Unimed Nacional', tus: '40302040' }),
    fonte({ id: 'p3', table: 'Bradesco Top', tus: '40304312' }),
    fonte({ id: 'p4', table: 'Unimed Coop.', tus: '99999999' }),
  ];

  it('termo vazio devolve lista vazia', () => {
    expect(buscarTabelasAssociadasPorTermo(fontes, '')).toEqual([]);
  });

  it('termo sem nenhum match devolve lista vazia', () => {
    expect(buscarTabelasAssociadasPorTermo(fontes, 'inexistente')).toEqual([]);
  });

  it('casa por nome, parcial e case-insensitive', () => {
    expect(buscarTabelasAssociadasPorTermo(fontes, 'bradesco')).toEqual(['Bradesco Top']);
  });

  it('deduplica tabela associada com múltiplas linhas pelo nome', () => {
    expect(buscarTabelasAssociadasPorTermo(fontes, 'unimed')).toEqual(['Unimed Coop.', 'Unimed Nacional']);
  });

  it('casa de forma fuzzy, sem precisar ser substring contígua', () => {
    expect(buscarTabelasAssociadasPorTermo(fontes, 'unmdnac')).toEqual(['Unimed Nacional']);
  });
});

describe('examesPorFontePagadora', () => {
  const exames = [
    exame({ id: 'e1', name: 'Hemograma completo', tuss: '40304361' }),
    exame({ id: 'e2', name: 'Glicemia de jejum', tuss: '40302040' }),
    exame({ id: 'e3', name: 'Colesterol total', tuss: '40304312' }),
  ];

  const fontes = [
    fonte({ id: 'p1', payor: 'Unimed', table: 'Unimed Coop.', tus: '40304361', price: 12.5 }),
    fonte({ id: 'p2', payor: 'Unimed', table: 'Unimed Nacional', tus: '40302040', price: 4.8 }),
    fonte({ id: 'p3', payor: 'Bradesco Saúde', table: 'Bradesco Top', tus: '40304312', price: 20 }),
  ];

  it('nome vazio devolve lista vazia', () => {
    expect(examesPorFontePagadora(exames, fontes, '')).toEqual([]);
  });

  it('nome sem nenhum match devolve lista vazia', () => {
    expect(examesPorFontePagadora(exames, fontes, 'Inexistente')).toEqual([]);
  });

  it('devolve os exames da fonte pagadora, ordenados por valor crescente', () => {
    expect(examesPorFontePagadora(exames, fontes, 'Unimed')).toEqual([
      {
        payorId: 'p2',
        exameId: 'e2',
        exame: 'Glicemia de jejum',
        tuss: '40302040',
        tabelaAssociada: 'Unimed Nacional',
        valorCobrado: 4.8,
        custo: 12,
        dif: -7.2,
        percentualCsp: 250,
        atendido: true,
        elegivelDescontoParticular: false,
      },
      {
        payorId: 'p1',
        exameId: 'e1',
        exame: 'Hemograma completo',
        tuss: '40304361',
        tabelaAssociada: 'Unimed Coop.',
        valorCobrado: 12.5,
        custo: 12,
        dif: 0.5,
        percentualCsp: 96,
        atendido: true,
        elegivelDescontoParticular: false,
      },
    ]);
  });

  it('atendido reflete o flag da fonte pagadora, e custo/dif/%csp vêm do custo total do exame', () => {
    const fontesComNaoAtendido = [
      fonte({ id: 'p4', payor: 'Amil', table: 'Amil 400', tus: '40304361', price: 15, atendido: false }),
    ];
    expect(examesPorFontePagadora(exames, fontesComNaoAtendido, 'Amil')).toEqual([
      {
        payorId: 'p4',
        exameId: 'e1',
        exame: 'Hemograma completo',
        tuss: '40304361',
        tabelaAssociada: 'Amil 400',
        valorCobrado: 15,
        custo: 12,
        dif: 3,
        percentualCsp: 80,
        atendido: false,
        elegivelDescontoParticular: false,
      },
    ]);
  });

  it('elegivelDescontoParticular reflete o flag da fonte pagadora', () => {
    const fontesParticular = [
      fonte({
        id: 'p5',
        payor: 'Particular',
        table: 'Tabela Particular',
        tus: '40304361',
        price: 24,
        elegivelDescontoParticular: true,
      }),
    ];
    expect(examesPorFontePagadora(exames, fontesParticular, 'Particular')).toEqual([
      {
        payorId: 'p5',
        exameId: 'e1',
        exame: 'Hemograma completo',
        tuss: '40304361',
        tabelaAssociada: 'Tabela Particular',
        valorCobrado: 24,
        custo: 12,
        dif: 12,
        percentualCsp: 50,
        atendido: true,
        elegivelDescontoParticular: true,
      },
    ]);
  });

  it('TUSS compartilhado por exames com nomes diferentes: devolve uma linha por nome distinto, não só o primeiro/último', () => {
    const examesComTussDuplicado = [
      exame({ id: 'e10', name: 'FÓSFORO - S', tuss: '40301931' }),
      exame({ id: 'e11', name: 'FÓSFORO - U', tuss: '40301931' }),
    ];
    const fontesParticular = [
      fonte({ id: 'p10', payor: 'Particular', table: 'Tabela Particular', tus: '40301931', price: 13 }),
    ];

    const resultado = examesPorFontePagadora(examesComTussDuplicado, fontesParticular, 'Particular');

    expect(resultado).toHaveLength(2);
    expect(resultado.map((r) => r.exame).sort()).toEqual(['FÓSFORO - S', 'FÓSFORO - U']);
    // Mesma linha de preço (payorId) reaproveitada pros dois nomes — é o
    // mesmo registro de custo_fontes_pagadoras, só sem como saber a qual
    // dos dois exames ele realmente se refere.
    expect(resultado.every((r) => r.payorId === 'p10' && r.valorCobrado === 13)).toBe(true);
    expect(resultado.map((r) => r.exameId).sort()).toEqual(['e10', 'e11']);
  });

  it('TUSS compartilhado por exames com o MESMO nome (duplicata literal): devolve uma linha só, com a ÚLTIMA entrada (mesma semântica de antes da issue 12)', () => {
    const examesDuplicadosMesmoNome = [
      exame({ id: 'e20', name: 'Hemograma completo', tuss: '40304361' }),
      exame({ id: 'e21', name: 'Hemograma completo', tuss: '40304361' }),
    ];

    const resultado = examesPorFontePagadora(examesDuplicadosMesmoNome, fontes, 'Unimed');

    expect(resultado).toHaveLength(1);
    expect(resultado[0].exame).toBe('Hemograma completo');
    expect(resultado[0].exameId).toBe('e21');
  });
});
