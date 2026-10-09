import { describe, expect, it } from 'vitest';
import { competenciasEntre, ocorrenciasNoPeriodo, totaisDoPeriodo } from './finops';
import { cobrancasNaVisao, competenciaDeCaixa, diluirOcorrencia, ocorrenciasNaVisao, resumoDoItem } from './visao';
import type { Despesa, Lancamento } from '../types';

const HOJE = '2026-10-15';

const despesa = (campos: Partial<Despesa>): Despesa => ({
  id: 'x',
  descricao: 'Despesa',
  categoriaId: 'cat',
  natureza: 'opex',
  quantidade: null,
  unidade: null,
  fornecedorId: null,
  fornecedorNome: 'Fornecedor',
  setor: null,
  responsavelId: null,
  responsavelNome: null,
  tipoValor: 'fixo',
  valorBase: 1000,
  recorrencia: 'mensal',
  competenciaInicio: '2026-01-01',
  competenciaFim: null,
  diaVencimento: 10,
  formaPagamento: 'boleto',
  meioPagamentoDetalhe: null,
  moedaOriginal: null,
  valorOriginal: null,
  numeroContrato: null,
  renovacaoAutomatica: false,
  avisoRenovacaoDias: 30,
  autorizadoPor: 'Diretoria',
  autorizadoEm: null,
  observacoes: null,
  anexos: [],
  reajustes: [],
  createdAt: '',
  updatedAt: '',
  ...campos,
});

const lancamento = (campos: Partial<Lancamento>): Lancamento => ({
  id: `l-${campos.despesaId}-${campos.competencia}`,
  despesaId: 'x',
  competencia: '2026-09-01',
  status: 'pago',
  valorPrevisto: 1000,
  vencimento: '2026-09-10',
  formaPagamento: 'boleto',
  valorPago: 1000,
  pagoEm: '2026-09-09',
  notaFiscal: null,
  motivoDispensa: null,
  observacao: null,
  anexos: [],
  createdAt: '',
  updatedAt: '',
  ...campos,
});

const somaRealizada = (visao: Parameters<typeof ocorrenciasNaVisao>[0], despesas: Despesa[], lancamentos: Lancamento[], meses: string[]) =>
  totaisDoPeriodo(ocorrenciasNaVisao(visao, despesas, lancamentos, meses, HOJE)).realizado;

describe('visão caixa', () => {
  const mensal = despesa({ id: 'm', valorBase: 1000 });
  const lancamentos = [
    // Agosto pago com atraso, em setembro: no caixa, conta em setembro.
    lancamento({ despesaId: 'm', competencia: '2026-08-01', vencimento: '2026-08-10', valorPago: 1000, pagoEm: '2026-09-02' }),
    lancamento({ despesaId: 'm', competencia: '2026-09-01', vencimento: '2026-09-10', valorPago: 1000, pagoEm: '2026-09-09' }),
    // Outubro pago adiantado, ainda em setembro.
    lancamento({ despesaId: 'm', competencia: '2026-10-01', vencimento: '2026-10-10', valorPago: 1000, pagoEm: '2026-09-30' }),
  ];

  it('paga entra no mês do pagamento, não paga no mês do vencimento', () => {
    const [ago, set, out] = ocorrenciasNoPeriodo([mensal], lancamentos, ['2026-08-01', '2026-09-01', '2026-10-01'], HOJE);
    expect([ago, set, out].map(competenciaDeCaixa)).toEqual(['2026-09-01', '2026-09-01', '2026-09-01']);
    const [nov] = ocorrenciasNoPeriodo([mensal], lancamentos, ['2026-11-01'], HOJE);
    expect(competenciaDeCaixa(nov)).toBe('2026-11-01');
  });

  it('setembro no caixa soma as três cobranças pagas no mês; na cobrança, só a de setembro', () => {
    expect(somaRealizada('caixa', [mensal], lancamentos, ['2026-09-01'])).toBe(3000);
    expect(somaRealizada('caixa', [mensal], lancamentos, ['2026-08-01'])).toBe(0);
    expect(somaRealizada('cobranca', [mensal], lancamentos, ['2026-09-01'])).toBe(1000);
  });

  it('para o detalhamento, as cobranças reais do caixa de setembro mantêm o mês a que se referem', () => {
    expect(cobrancasNaVisao('caixa', [mensal], lancamentos, ['2026-09-01'], HOJE).map((o) => o.competencia)).toEqual([
      '2026-08-01',
      '2026-09-01',
      '2026-10-01',
    ]);
    expect(cobrancasNaVisao('diluida', [mensal], lancamentos, ['2026-09-01'], HOJE).map((o) => o.competencia)).toEqual(['2026-09-01']);
  });
});

describe('visão diluída', () => {
  const anual = despesa({ id: 'a', recorrencia: 'anual', competenciaInicio: '2026-01-01', valorBase: 12000 });
  const pagoJaneiro = [lancamento({ despesaId: 'a', competencia: '2026-01-01', vencimento: '2026-01-10', valorPrevisto: 12000, valorPago: 12000, pagoEm: '2026-01-10' })];

  it('anual paga em janeiro vira 1/12 em cada mês do ano', () => {
    const meses = competenciasEntre('2026-01-01', '2026-12-01');
    const ocorrencias = ocorrenciasNaVisao('diluida', [anual], pagoJaneiro, meses, HOJE);
    expect(ocorrencias.map((o) => o.competencia)).toEqual(meses);
    expect(ocorrencias.every((o) => o.lancamento?.valorPago === 1000 && o.valorPrevisto === 1000)).toBe(true);
    expect(somaRealizada('diluida', [anual], pagoJaneiro, ['2026-06-01'])).toBe(1000);
    expect(somaRealizada('cobranca', [anual], pagoJaneiro, ['2026-06-01'])).toBe(0);
  });

  it('virada de ano: anual de julho se espalha até junho do ano seguinte', () => {
    const julho = despesa({ id: 'j', recorrencia: 'anual', competenciaInicio: '2025-07-01', valorBase: 6000 });
    const lanc = [lancamento({ despesaId: 'j', competencia: '2025-07-01', vencimento: '2025-07-10', valorPrevisto: 6000, valorPago: 6000, pagoEm: '2025-07-08' })];
    expect(somaRealizada('diluida', [julho], lanc, competenciasEntre('2025-07-01', '2025-12-01'))).toBe(3000);
    expect(somaRealizada('diluida', [julho], lanc, competenciasEntre('2026-01-01', '2026-06-01'))).toBe(3000);
    expect(somaRealizada('diluida', [julho], lanc, ['2026-07-01'])).toBe(0);
  });

  it('mensal e única ficam inteiras; trimestral vira 3 fatias com chaves distintas', () => {
    const [m] = ocorrenciasNoPeriodo([despesa({ id: 'm' })], [], ['2026-09-01'], HOJE);
    expect(diluirOcorrencia(m)).toEqual([m]);
    const [u] = ocorrenciasNoPeriodo([despesa({ id: 'u', recorrencia: 'unica', competenciaInicio: '2026-09-01' })], [], ['2026-09-01'], HOJE);
    expect(diluirOcorrencia(u)).toEqual([u]);
    const [t] = ocorrenciasNoPeriodo([despesa({ id: 't', recorrencia: 'trimestral', competenciaInicio: '2026-07-01', valorBase: 900 })], [], ['2026-07-01'], HOJE);
    const fatias = diluirOcorrencia(t);
    expect(fatias.map((f) => [f.chave, f.competencia, f.valorPrevisto])).toEqual([
      ['t:2026-07-01#1', '2026-07-01', 300],
      ['t:2026-07-01#2', '2026-08-01', 300],
      ['t:2026-07-01#3', '2026-09-01', 300],
    ]);
  });
});

describe('resumoDoItem', () => {
  it('pago dos 12 meses até o atual, recorrente e despesas na ordem (ativas, mais caras primeiro)', () => {
    const despesas = [
      despesa({ id: 'barata', descricao: 'Barata', valorBase: 100, competenciaInicio: '2025-01-01' }),
      despesa({ id: 'cara', descricao: 'Cara', valorBase: 900, competenciaInicio: '2025-01-01' }),
      despesa({ id: 'velha', descricao: 'Encerrada', valorBase: 5000, competenciaInicio: '2025-01-01', competenciaFim: '2026-03-01' }),
    ];
    const lancamentos = [
      lancamento({ despesaId: 'cara', competencia: '2025-10-01', valorPago: 900 }),
      lancamento({ despesaId: 'cara', competencia: '2025-11-01', valorPago: 900 }),
      lancamento({ despesaId: 'barata', competencia: '2026-10-01', valorPago: 100 }),
    ];
    const r = resumoDoItem(despesas, lancamentos, HOJE);
    expect(r.serie).toHaveLength(12);
    // Outubro/2025 está fora dos 12 meses (nov/2025 a out/2026).
    expect(r.serie[0]).toBe(900);
    expect(r.serie[11]).toBe(100);
    expect(r.totalDozeMeses).toBe(1000);
    expect(r.recorrenteMensal).toBe(1000);
    expect(r.despesas.map((d) => [d.despesa.id, d.situacao, d.valor, d.mensal])).toEqual([
      ['cara', 'ativa', 900, true],
      ['barata', 'ativa', 100, true],
      ['velha', 'encerrada', 5000, true],
    ]);
  });
});
