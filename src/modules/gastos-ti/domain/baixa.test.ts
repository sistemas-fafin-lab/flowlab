import { describe, expect, it } from 'vitest';
import { acaoAoDesfazer, linhaBaixa, linhaBaixaEmLote, linhaDispensa, podeDarBaixa, validarBaixa, validarMotivoDispensa } from './baixa';
import type { OcorrenciaDoMes } from './situacao';
import type { BaixaInput } from '../types';

const ocorrencia = (campos: Partial<OcorrenciaDoMes> = {}): OcorrenciaDoMes =>
  ({
    chave: 'd1:2026-10-01',
    despesa: { id: 'd1' },
    competencia: '2026-10-01',
    previstoOriginal: 100,
    vencimentoOriginal: '2026-10-10',
    valorPrevisto: 120,
    vencimento: '2026-10-15',
    formaPagamento: 'pix',
    lancamento: null,
    situacao: 'a_vencer',
    ajustada: true,
    foraDaRecorrencia: false,
    estimada: false,
    ...campos,
  }) as OcorrenciaDoMes;

const baixa = (campos: Partial<BaixaInput> = {}): BaixaInput => ({
  valorPago: 118.9,
  pagoEm: '2026-10-14',
  formaPagamento: 'cartao_corporativo',
  notaFiscal: ' NF 123 ',
  observacao: '',
  ...campos,
});

describe('validarBaixa', () => {
  const HOJE = '2026-10-15';

  it('aceita uma baixa válida, inclusive valor zero', () => {
    expect(validarBaixa(baixa(), HOJE)).toEqual({});
    expect(validarBaixa(baixa({ valorPago: 0 }), HOJE)).toEqual({});
  });

  it('exige valor e data, sem valor negativo nem data futura', () => {
    expect(Object.keys(validarBaixa(baixa({ valorPago: null, pagoEm: null }), HOJE)).sort()).toEqual(['pagoEm', 'valorPago']);
    expect(validarBaixa(baixa({ valorPago: -1 }), HOJE).valorPago).toBeDefined();
    expect(validarBaixa(baixa({ pagoEm: '2026-10-16' }), HOJE).pagoEm).toMatch(/futura/);
    expect(validarBaixa(baixa({ pagoEm: '2026-10-15' }), HOJE)).toEqual({});
  });
});

describe('validarMotivoDispensa', () => {
  it('exige um motivo', () => {
    expect(validarMotivoDispensa('  ')).not.toBeNull();
    expect(validarMotivoDispensa('Carência')).toBeNull();
  });
});

describe('linhas gravadas', () => {
  it('baixa leva a previsão do mês (já ajustada) e os dados do pagamento', () => {
    expect(linhaBaixa(ocorrencia(), baixa())).toEqual({
      despesa_id: 'd1',
      competencia: '2026-10-01',
      valor_previsto: 120,
      vencimento: '2026-10-15',
      status: 'pago',
      forma_pagamento: 'cartao_corporativo',
      valor_pago: 118.9,
      pago_em: '2026-10-14',
      nota_fiscal: 'NF 123',
      observacao: null,
      motivo_dispensa: null,
    });
  });

  it('baixa em lote paga o previsto e não sobrescreve nota fiscal nem observação', () => {
    const linha = linhaBaixaEmLote(ocorrencia(), '2026-10-15');
    expect(linha).toMatchObject({ status: 'pago', valor_pago: 120, pago_em: '2026-10-15', forma_pagamento: 'pix', motivo_dispensa: null });
    expect('nota_fiscal' in linha).toBe(false);
    expect('observacao' in linha).toBe(false);
  });

  it('dispensa limpa o pagamento e guarda o motivo sem espaços nas pontas', () => {
    expect(linhaDispensa(ocorrencia(), '  Carência do contrato ')).toMatchObject({
      status: 'dispensado',
      valor_pago: null,
      pago_em: null,
      motivo_dispensa: 'Carência do contrato',
    });
  });
});

describe('acaoAoDesfazer (RN15)', () => {
  const lancamento = (status: 'previsto' | 'pago' | 'dispensado') => ({ status }) as OcorrenciaDoMes['lancamento'];

  it('sem lançamento não há o que desfazer', () => {
    expect(acaoAoDesfazer(ocorrencia({ lancamento: null }))).toBe('nada');
  });

  it('baixa ou dispensa sem ajuste: apaga, a ocorrência volta a seguir a despesa', () => {
    expect(acaoAoDesfazer(ocorrencia({ lancamento: lancamento('pago'), ajustada: false }))).toBe('apagar');
    expect(acaoAoDesfazer(ocorrencia({ lancamento: lancamento('dispensado'), ajustada: false }))).toBe('apagar');
  });

  it('baixa ou dispensa de ocorrência ajustada: volta para previsto mantendo o ajuste', () => {
    expect(acaoAoDesfazer(ocorrencia({ lancamento: lancamento('pago'), ajustada: true }))).toBe('voltar_para_previsto');
    expect(acaoAoDesfazer(ocorrencia({ lancamento: lancamento('dispensado'), ajustada: true }))).toBe('voltar_para_previsto');
  });

  it('desfazer o próprio ajuste apaga', () => {
    expect(acaoAoDesfazer(ocorrencia({ lancamento: lancamento('previsto'), ajustada: true }))).toBe('apagar');
  });
});

describe('podeDarBaixa', () => {
  it('só vencidas e a vencer', () => {
    expect(podeDarBaixa(ocorrencia({ situacao: 'vencida' }))).toBe(true);
    expect(podeDarBaixa(ocorrencia({ situacao: 'a_vencer' }))).toBe(true);
    expect(podeDarBaixa(ocorrencia({ situacao: 'paga' }))).toBe(false);
    expect(podeDarBaixa(ocorrencia({ situacao: 'dispensada' }))).toBe(false);
  });
});
