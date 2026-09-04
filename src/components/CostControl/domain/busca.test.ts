import { describe, expect, it } from 'vitest';
import type { Exam, Payor } from '../../../hooks/useCostControl';
import { buscarExamesPorTermo, fontesPagadorasPorTuss } from './busca';

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
