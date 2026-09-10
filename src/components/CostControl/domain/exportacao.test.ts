import { describe, expect, it } from 'vitest';
import type { Payor } from '../../../hooks/useCostControl';
import type { ExameDaFontePagadora } from './busca';
import { linhasExportacaoExamesDaFonte, linhasExportacaoFontesPagadoras } from './exportacao';

const exameDaFonte = (over: Partial<ExameDaFontePagadora>): ExameDaFontePagadora => ({
  payorId: 'p1',
  exame: 'Hemograma completo',
  tuss: '40304361',
  tabelaAssociada: 'Unimed Coop.',
  valorCobrado: 12.5,
  custo: 12,
  dif: 0.5,
  percentualCsp: 96,
  atendido: true,
  elegivelDescontoParticular: false,
  ...over,
});

const fonte = (over: Partial<Payor>): Payor => ({
  id: 'p1',
  payor: 'Unimed',
  table: 'Unimed Coop.',
  tus: '40304361',
  price: 12.5,
  atendido: true,
  elegivelDescontoParticular: false,
  ...over,
});

describe('linhasExportacaoExamesDaFonte', () => {
  it('lista vazia devolve lista vazia', () => {
    expect(linhasExportacaoExamesDaFonte([])).toEqual([]);
  });

  it('mapeia cada exame pras colunas exibidas em TabelaExamesDaFonte', () => {
    expect(
      linhasExportacaoExamesDaFonte([
        exameDaFonte({
          exame: 'Hemograma completo',
          tuss: '40304361',
          tabelaAssociada: 'Unimed Coop.',
          valorCobrado: 12.5,
          custo: 12,
          dif: 0.5,
          percentualCsp: 96,
          atendido: true,
        }),
      ]),
    ).toEqual([
      {
        Exame: 'Hemograma completo',
        TUSS: '40304361',
        'Tabela Associada': 'Unimed Coop.',
        'Valor Cobrado': 12.5,
        Custo: 12,
        Dif: 0.5,
        '%CSP': 96,
        Atendido: 'Sim',
      },
    ]);
  });

  it('atendido false vira "Não"', () => {
    expect(linhasExportacaoExamesDaFonte([exameDaFonte({ atendido: false })])[0].Atendido).toBe('Não');
  });

  it('arredonda %CSP em duas casas', () => {
    expect(linhasExportacaoExamesDaFonte([exameDaFonte({ percentualCsp: 33.33333 })])[0]['%CSP']).toBe(33.33);
  });
});

describe('linhasExportacaoFontesPagadoras', () => {
  it('lista vazia devolve lista vazia', () => {
    expect(linhasExportacaoFontesPagadoras([])).toEqual([]);
  });

  it('mapeia cada fonte pagadora incluindo TUSS (útil quando não há um exame fixo de contexto)', () => {
    expect(
      linhasExportacaoFontesPagadoras([
        fonte({ payor: 'Bradesco Saúde', table: 'Bradesco Top', tus: '40304312', price: 20, atendido: false }),
      ]),
    ).toEqual([
      {
        'Fonte Pagadora': 'Bradesco Saúde',
        'Tabela Associada': 'Bradesco Top',
        TUSS: '40304312',
        'Valor Cobrado': 20,
        Atendido: 'Não',
      },
    ]);
  });
});
