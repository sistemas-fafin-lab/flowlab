import { describe, expect, it } from 'vitest';
import { camposAjuste, linhaAjusteNovo, validarAjuste, type AjusteInput } from './ajuste';
import { montarOcorrenciasDoMes, type OcorrenciaDoMes } from './situacao';
import type { Despesa, Lancamento } from '../types';

const despesa = (campos: Partial<Despesa> = {}): Despesa => ({
  id: 'd1',
  descricao: 'AWS',
  categoriaId: 'cat',
  natureza: 'opex',
  quantidade: null,
  unidade: null,
  fornecedorId: null,
  fornecedorNome: 'Amazon',
  setor: null,
  responsavelId: null,
  responsavelNome: null,
  tipoValor: 'variavel',
  valorBase: 3200,
  recorrencia: 'mensal',
  competenciaInicio: '2026-01-01',
  competenciaFim: null,
  diaVencimento: 10,
  formaPagamento: 'cartao_corporativo',
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

const ajuste = (campos: Partial<Lancamento> = {}): Lancamento => ({
  id: 'l1',
  despesaId: 'd1',
  competencia: '2026-10-01',
  status: 'previsto',
  valorPrevisto: 3900,
  vencimento: '2026-10-10',
  formaPagamento: 'cartao_corporativo',
  valorPago: null,
  pagoEm: null,
  notaFiscal: null,
  motivoDispensa: null,
  observacao: null,
  anexos: [],
  createdAt: '',
  updatedAt: '',
  ...campos,
});

const ocorrenciaDe = (d: Despesa, lancamentos: Lancamento[], competencia = '2026-10-01', hoje = '2026-10-05'): OcorrenciaDoMes =>
  montarOcorrenciasDoMes([d], lancamentos, competencia, hoje)[0];

const input = (campos: Partial<AjusteInput> = {}): AjusteInput => ({
  escopo: 'mes',
  valorPrevisto: 3900,
  vencimento: '2026-10-10',
  formaPagamento: 'cartao_corporativo',
  observacao: null,
  motivo: 'outro',
  ...campos,
});

describe('ajuste aplicado nas ocorrências (issue 07)', () => {
  it('ajuste só neste mês muda aquela competência e não as outras', () => {
    const d = despesa();
    expect(ocorrenciaDe(d, [ajuste()], '2026-10-01').valorPrevisto).toBe(3900);
    expect(ocorrenciaDe(d, [ajuste()], '2026-11-01').valorPrevisto).toBe(3200);
    expect(ocorrenciaDe(d, [ajuste()], '2026-09-01').valorPrevisto).toBe(3200);
  });

  it('vencimento ajustado para depois de hoje tira a ocorrência de "vencida"', () => {
    const d = despesa();
    expect(ocorrenciaDe(d, [], '2026-10-01', '2026-10-12').situacao).toBe('vencida');
    expect(ocorrenciaDe(d, [ajuste({ valorPrevisto: 3200, vencimento: '2026-10-20' })], '2026-10-01', '2026-10-12').situacao).toBe('a_vencer');
  });

  it('desfazer o ajuste (apagar o lançamento) volta à previsão calculada', () => {
    const d = despesa();
    const antes = ocorrenciaDe(d, [ajuste()]);
    const depois = ocorrenciaDe(d, []);
    expect(antes).toMatchObject({ valorPrevisto: 3900, ajustada: true });
    expect(depois).toMatchObject({ valorPrevisto: 3200, ajustada: false, lancamento: null });
  });

  it('reajuste posterior não sobrescreve o ajuste já feito na competência (RN04)', () => {
    const d = despesa({ reajustes: [{ id: 'r', vigenteDesde: '2026-10-01', valor: 3500, motivo: 'outro', quantidade: null, observacao: null, createdAt: '' }] });
    const o = ocorrenciaDe(d, [ajuste()]);
    expect(o.previstoOriginal).toBe(3500);
    expect(o.valorPrevisto).toBe(3900);
    expect(ocorrenciaDe(d, [ajuste()], '2026-11-01').valorPrevisto).toBe(3500);
  });
});

describe('validarAjuste — só este mês', () => {
  const o = ocorrenciaDe(despesa(), []);

  it('aceita mudar valor, vencimento ou forma', () => {
    expect(validarAjuste(input(), o)).toEqual({});
    expect(validarAjuste(input({ valorPrevisto: 3200, vencimento: '2026-10-20' }), o)).toEqual({});
    expect(validarAjuste(input({ valorPrevisto: 3200, formaPagamento: 'pix' }), o)).toEqual({});
  });

  it('valor zero é aceito; negativo não', () => {
    expect(validarAjuste(input({ valorPrevisto: 0 }), o)).toEqual({});
    expect(validarAjuste(input({ valorPrevisto: -1 }), o).valorPrevisto).toBeDefined();
  });

  it('exige valor e vencimento', () => {
    expect(validarAjuste(input({ valorPrevisto: null }), o).valorPrevisto).toBeDefined();
    expect(validarAjuste(input({ vencimento: null }), o).vencimento).toBeDefined();
  });

  it('recusa salvar sem mudança', () => {
    expect(validarAjuste(input({ valorPrevisto: 3200 }), o).geral).toMatch(/Nada mudou/);
  });
});

describe('validarAjuste — deste mês em diante', () => {
  it('vira reajuste: aceita valor positivo depois do mês inicial', () => {
    expect(validarAjuste(input({ escopo: 'em_diante', valorPrevisto: 3500, motivo: 'reajuste_contratual' }), ocorrenciaDe(despesa(), []))).toEqual({});
  });

  it('no mês inicial da despesa explica que é para editar a despesa', () => {
    const o = ocorrenciaDe(despesa({ competenciaInicio: '2026-10-01' }), []);
    expect(validarAjuste(input({ escopo: 'em_diante', valorPrevisto: 3500 }), o).escopo).toMatch(/edite a despesa/);
  });

  it('valor zero não vale para reajuste', () => {
    expect(validarAjuste(input({ escopo: 'em_diante', valorPrevisto: 0 }), ocorrenciaDe(despesa(), [])).valorPrevisto).toBeDefined();
  });

  it('valor igual ao vigente não muda nada', () => {
    expect(validarAjuste(input({ escopo: 'em_diante', valorPrevisto: 3200 }), ocorrenciaDe(despesa(), [])).geral).toMatch(/já é este/);
  });
});

describe('linhas gravadas', () => {
  const o = ocorrenciaDe(despesa(), []);

  it('primeiro toque cria o lançamento como previsto', () => {
    expect(linhaAjusteNovo(o, input({ observacao: '  pico de uso ' }))).toEqual({
      despesa_id: 'd1',
      competencia: '2026-10-01',
      status: 'previsto',
      valor_previsto: 3900,
      vencimento: '2026-10-10',
      forma_pagamento: 'cartao_corporativo',
      observacao: 'pico de uso',
    });
  });

  it('ajuste em lançamento existente não mexe no status', () => {
    expect('status' in camposAjuste(input())).toBe(false);
  });
});
