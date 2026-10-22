import { describe, expect, it } from 'vitest';
import type { Payor, TabelaAssociada } from '../../../hooks/useCostControl';
import type { ExameDaFontePagadora } from './busca';
import {
  linhasExportacaoExamesDaFonte,
  linhasExportacaoFontesDoExame,
  linhasExportacaoFontesPagadoras,
} from './exportacao';

const tabelas: TabelaAssociada[] = [
  { id: 't1', fontePagadora: 'Unimed', nome: 'Unimed Coop.', vencimento: '2027-03-31', ativa: true },
  { id: 't2', fontePagadora: 'Bradesco Saúde', nome: 'Bradesco Top', vencimento: null, ativa: true },
];

const exameDaFonte = (over: Partial<ExameDaFontePagadora>): ExameDaFontePagadora => ({
  payorId: 'p1',
  fontePagadora: 'Unimed',
  exameId: 'e1',
  exame: 'Hemograma completo',
  nomeConvenio: null,
  tuss: '40304361',
  tabelaId: 't1',
  tabelaAssociada: 'Unimed Coop.',
  valorCobrado: 12.5,
  valorPadraoTuss: 12.5,
  temValorPersonalizado: false,
  custoLevantado: true,
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
  tabelaId: 't1',
  tus: '40304361',
  price: 12.5,
  atendido: true,
  elegivelDescontoParticular: false,
  exameId: null,
  nomeConvenio: null,
  ...over,
});

describe('linhasExportacaoExamesDaFonte', () => {
  it('lista vazia devolve lista vazia', () => {
    expect(linhasExportacaoExamesDaFonte([], tabelas)).toEqual([]);
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
      ], tabelas),
    ).toEqual([
      {
        Exame: 'Hemograma completo',
        'Nome no convênio': '',
        TUSS: '40304361',
        'Tabela Associada': 'Unimed Coop.',
        Vencimento: '31/03/2027',
        'Valor Cobrado': 12.5,
        Custo: 12,
        Dif: 0.5,
        '%CSP': 96,
        Atendido: 'Sim',
      },
    ]);
  });

  it('atendido false vira "Não"', () => {
    expect(linhasExportacaoExamesDaFonte([exameDaFonte({ atendido: false })], tabelas)[0].Atendido).toBe('Não');
  });

  it('linha não levantada: sem exame, "Custo não levantado" e Dif/%CSP vazios', () => {
    const [linha] = linhasExportacaoExamesDaFonte(
      [exameDaFonte({ exameId: null, exame: 'Hemograma', nomeConvenio: 'Hemograma', custoLevantado: false, custo: 0, dif: 12.5, percentualCsp: 0 })],
      tabelas,
    );
    expect(linha).toMatchObject({ Exame: '', 'Nome no convênio': 'Hemograma', Custo: 'Custo não levantado', Dif: '', '%CSP': '' });
  });

  it('arredonda %CSP em duas casas', () => {
    expect(linhasExportacaoExamesDaFonte([exameDaFonte({ percentualCsp: 33.33333 })], tabelas)[0]['%CSP']).toBe(33.33);
  });
});

describe('linhasExportacaoFontesPagadoras', () => {
  it('lista vazia devolve lista vazia', () => {
    expect(linhasExportacaoFontesPagadoras([], tabelas)).toEqual([]);
  });

  it('mapeia cada fonte pagadora incluindo TUSS (útil quando não há um exame fixo de contexto)', () => {
    expect(
      linhasExportacaoFontesPagadoras([
        fonte({ payor: 'Bradesco Saúde', table: 'Bradesco Top', tabelaId: 't2', tus: '40304312', price: 20, atendido: false }),
        fonte({}),
      ], tabelas),
    ).toEqual([
      {
        'Fonte Pagadora': 'Bradesco Saúde',
        'Tabela Associada': 'Bradesco Top',
        Vencimento: '',
        TUSS: '40304312',
        'Nome no convênio': '',
        'Valor Cobrado': 20,
        Atendido: 'Não',
      },
      {
        'Fonte Pagadora': 'Unimed',
        'Tabela Associada': 'Unimed Coop.',
        Vencimento: '31/03/2027',
        TUSS: '40304361',
        'Nome no convênio': '',
        'Valor Cobrado': 12.5,
        Atendido: 'Sim',
      },
    ]);
  });

  it('traz o nome do exame no convênio das linhas importadas', () => {
    expect(linhasExportacaoFontesPagadoras([fonte({ nomeConvenio: 'Hemograma' })], tabelas)[0]['Nome no convênio']).toBe(
      'Hemograma',
    );
  });

  it('linha cuja tabela não está no cadastro carregado sai com Vencimento vazio', () => {
    expect(linhasExportacaoFontesPagadoras([fonte({ tabelaId: 'inexistente' })], tabelas)[0].Vencimento).toBe('');
  });
});

describe('linhasExportacaoFontesDoExame', () => {
  it('traz o vencimento da tabela de cada fonte, pelo id', () => {
    expect(
      linhasExportacaoFontesDoExame(
        [
          exameDaFonte({ fontePagadora: 'Unimed', tabelaId: 't1', tabelaAssociada: 'Unimed Coop.' }),
          exameDaFonte({ fontePagadora: 'Bradesco Saúde', tabelaId: 't2', tabelaAssociada: 'Bradesco Top', atendido: false }),
        ],
        tabelas,
      ),
    ).toEqual([
      {
        'Fonte Pagadora': 'Unimed',
        'Tabela Associada': 'Unimed Coop.',
        Vencimento: '31/03/2027',
        TUSS: '40304361',
        'Valor Cobrado': 12.5,
        Atendido: 'Sim',
      },
      {
        'Fonte Pagadora': 'Bradesco Saúde',
        'Tabela Associada': 'Bradesco Top',
        Vencimento: '',
        TUSS: '40304361',
        'Valor Cobrado': 12.5,
        Atendido: 'Não',
      },
    ]);
  });
});
