import { describe, expect, it } from 'vitest';
import type { Exam, Payor } from '../../../hooks/useCostControl';
import {
  buscarExamesPorTermo,
  buscarUnificado,
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

describe('buscarUnificado', () => {
  const exames = [
    exame({ id: 'e1', name: 'Hemograma completo', tuss: '40304361' }),
    exame({ id: 'e2', name: 'Glicemia de jejum', tuss: '40302040' }),
    exame({ id: 'e3', name: 'Colesterol total', tuss: '40304312' }),
  ];

  const fontes = [
    fonte({ id: 'p1', payor: 'Unimed', tus: '40304361' }),
    fonte({ id: 'p2', payor: 'Unimed', tus: '40302040' }),
    fonte({ id: 'p3', payor: 'Bradesco Saúde', tus: '40304312' }),
    fonte({ id: 'p4', payor: 'Hemoprev', tus: '99999999' }),
  ];

  it('termo vazio devolve listas vazias', () => {
    expect(buscarUnificado(exames, fontes, '')).toEqual({
      exames: [],
      fontesPagadoras: [],
    });
  });

  it('termo sem nenhum match devolve listas vazias', () => {
    expect(buscarUnificado(exames, fontes, 'inexistente')).toEqual({
      exames: [],
      fontesPagadoras: [],
    });
  });

  it('match só de exame devolve exame e fontesPagadoras vazia', () => {
    expect(buscarUnificado(exames, fontes, 'hemograma')).toEqual({
      exames: [exames[0]],
      fontesPagadoras: [],
    });
  });

  it('match só de fonte pagadora devolve fonte e exames vazia', () => {
    expect(buscarUnificado(exames, fontes, 'bradesco')).toEqual({
      exames: [],
      fontesPagadoras: ['Bradesco Saúde'],
    });
  });

  it('match simultâneo dos dois tipos', () => {
    expect(buscarUnificado(exames, fontes, 'hemo')).toEqual({
      exames: [exames[0]], // Hemograma completo
      fontesPagadoras: ['Hemoprev'],
    });
  });

  it('deduplica fonte pagadora com múltiplas linhas pelo nome', () => {
    expect(buscarUnificado(exames, fontes, 'unimed').fontesPagadoras).toEqual([
      'Unimed',
    ]);
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
        exame: 'Glicemia de jejum',
        tuss: '40302040',
        tabelaAssociada: 'Unimed Nacional',
        valorCobrado: 4.8,
      },
      {
        exame: 'Hemograma completo',
        tuss: '40304361',
        tabelaAssociada: 'Unimed Coop.',
        valorCobrado: 12.5,
      },
    ]);
  });
});
