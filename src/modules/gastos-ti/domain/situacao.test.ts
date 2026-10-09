import { describe, expect, it } from 'vitest';
import { montarOcorrenciasDoMes, situacaoDaOcorrencia, totaisDoMes } from './situacao';
import type { Despesa, Lancamento } from '../types';

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
  valorBase: 100,
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
  id: 'l',
  despesaId: 'x',
  competencia: '2026-10-01',
  status: 'pago',
  valorPrevisto: 100,
  vencimento: '2026-10-10',
  formaPagamento: 'boleto',
  valorPago: 100,
  pagoEm: '2026-10-09',
  notaFiscal: null,
  motivoDispensa: null,
  observacao: null,
  anexos: [],
  createdAt: '',
  updatedAt: '',
  ...campos,
});

const OUT = '2026-10-01';

describe('situacaoDaOcorrencia (RN07)', () => {
  it('paga e dispensada vêm do lançamento', () => {
    expect(situacaoDaOcorrencia('pago', '2026-10-10', '2026-12-01')).toBe('paga');
    expect(situacaoDaOcorrencia('dispensado', '2026-10-10', '2026-12-01')).toBe('dispensada');
  });

  it('sem baixa: vencida se o vencimento já passou, senão a vencer (vence hoje = a vencer)', () => {
    expect(situacaoDaOcorrencia(null, '2026-10-10', '2026-10-11')).toBe('vencida');
    expect(situacaoDaOcorrencia(null, '2026-10-10', '2026-10-10')).toBe('a_vencer');
    expect(situacaoDaOcorrencia('previsto', '2026-10-10', '2026-10-11')).toBe('vencida');
  });
});

describe('montarOcorrenciasDoMes', () => {
  it('só despesas com cobrança na competência entram', () => {
    const despesas = [
      despesa({ id: 'mensal' }),
      despesa({ id: 'trimestral', recorrencia: 'trimestral', competenciaInicio: '2026-09-01' }),
      despesa({ id: 'encerrada', competenciaFim: '2026-09-01' }),
      despesa({ id: 'futura', competenciaInicio: '2026-11-01' }),
    ];
    const ids = montarOcorrenciasDoMes(despesas, [], OUT, '2026-10-05').map((o) => o.despesa.id);
    expect(ids).toEqual(['mensal']);
  });

  it('previsão pura: valor vigente (com reajuste) e vencimento calculado, sem selo de ajuste', () => {
    const d = despesa({ diaVencimento: 31, reajustes: [{ id: 'r', vigenteDesde: '2026-08-01', valor: 150, motivo: 'outro', quantidade: null, observacao: null, createdAt: '' }] });
    const [o] = montarOcorrenciasDoMes([d], [], '2026-09-01', '2026-09-05');
    expect(o).toMatchObject({ valorPrevisto: 150, previstoOriginal: 150, vencimento: '2026-09-30', ajustada: false, lancamento: null, situacao: 'a_vencer' });
  });

  it('o lançamento sobrepõe valor, vencimento e forma (RN04 item 1) e marca ajustada', () => {
    const l = lancamento({ status: 'previsto', valorPrevisto: 180, vencimento: '2026-10-20', formaPagamento: 'pix', valorPago: null, pagoEm: null });
    const [o] = montarOcorrenciasDoMes([despesa({})], [l], OUT, '2026-10-15');
    expect(o).toMatchObject({ valorPrevisto: 180, previstoOriginal: 100, vencimento: '2026-10-20', formaPagamento: 'pix', ajustada: true, situacao: 'a_vencer' });
  });

  it('baixa com o previsto igual ao calculado não conta como ajuste', () => {
    const [o] = montarOcorrenciasDoMes([despesa({})], [lancamento({})], OUT, '2026-10-15');
    expect(o).toMatchObject({ situacao: 'paga', ajustada: false });
  });

  it('variável sem baixa é estimada; paga não é', () => {
    const d = despesa({ tipoValor: 'variavel' });
    expect(montarOcorrenciasDoMes([d], [], OUT, '2026-10-05')[0].estimada).toBe(true);
    expect(montarOcorrenciasDoMes([d], [lancamento({})], OUT, '2026-10-05')[0].estimada).toBe(false);
  });

  it('lançamento numa competência sem cobrança aparece como fora da recorrência (RN17)', () => {
    const d = despesa({ recorrencia: 'trimestral', competenciaInicio: '2026-09-01' });
    const [o] = montarOcorrenciasDoMes([d], [lancamento({ valorPrevisto: 90 })], OUT, '2026-10-15');
    expect(o).toMatchObject({ foraDaRecorrencia: true, ajustada: false, valorPrevisto: 90, previstoOriginal: 90 });
  });

  it('ignora lançamentos de outras competências', () => {
    const [o] = montarOcorrenciasDoMes([despesa({})], [lancamento({ competencia: '2026-09-01' })], OUT, '2026-10-05');
    expect(o.lancamento).toBeNull();
  });

  it('ordena: vencidas, a vencer, pagas, dispensadas; depois vencimento e descrição', () => {
    const despesas = [
      despesa({ id: 'paga', descricao: 'Paga' }),
      despesa({ id: 'avencer-b', descricao: 'B', diaVencimento: 25 }),
      despesa({ id: 'dispensada', descricao: 'Dispensada' }),
      despesa({ id: 'vencida', descricao: 'Vencida', diaVencimento: 5 }),
      despesa({ id: 'avencer-a', descricao: 'A', diaVencimento: 25 }),
    ];
    const lancamentos = [
      lancamento({ despesaId: 'paga' }),
      lancamento({ despesaId: 'dispensada', status: 'dispensado', valorPago: null, pagoEm: null, motivoDispensa: 'carência' }),
    ];
    const ids = montarOcorrenciasDoMes(despesas, lancamentos, OUT, '2026-10-15').map((o) => o.despesa.id);
    expect(ids).toEqual(['vencida', 'avencer-a', 'avencer-b', 'paga', 'dispensada']);
  });

  it('a mesma entrada com outro "hoje" só muda a situação', () => {
    const d = [despesa({})];
    const antes = montarOcorrenciasDoMes(d, [], OUT, '2026-10-05')[0];
    const depois = montarOcorrenciasDoMes(d, [], OUT, '2026-10-20')[0];
    expect(antes.situacao).toBe('a_vencer');
    expect(depois.situacao).toBe('vencida');
    expect({ ...depois, situacao: antes.situacao }).toEqual(antes);
  });
});

describe('totaisDoMes', () => {
  it('previsto sem dispensadas, pago pelo valor pago, em aberto e vencido', () => {
    const despesas = [
      despesa({ id: 'paga', valorBase: 100 }),
      despesa({ id: 'vencida', valorBase: 200, diaVencimento: 5 }),
      despesa({ id: 'avencer', valorBase: 300, diaVencimento: 25 }),
      despesa({ id: 'dispensada', valorBase: 400 }),
    ];
    const lancamentos = [
      lancamento({ despesaId: 'paga', valorPago: 110 }),
      lancamento({ despesaId: 'dispensada', status: 'dispensado', valorPrevisto: 400, valorPago: null, pagoEm: null, motivoDispensa: 'carência' }),
    ];
    const totais = totaisDoMes(montarOcorrenciasDoMes(despesas, lancamentos, OUT, '2026-10-15'));
    expect(totais).toEqual({
      previsto: 600,
      pago: 110,
      emAberto: 500,
      vencido: 200,
      quantidade: { vencida: 1, a_vencer: 1, paga: 1, dispensada: 1 },
    });
  });
});
