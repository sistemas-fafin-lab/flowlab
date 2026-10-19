import { describe, expect, it } from 'vitest';
import { diffQuotationInfo, quotationInfoInputFrom, validateQuotationInfo, type QuotationInfo, type QuotationInfoInput } from './quotationInfo';

const input = (overrides: Partial<QuotationInfoInput> = {}): QuotationInfoInput => ({
  title: 'Compra de reagentes',
  description: '',
  justification: '',
  priority: 'medium',
  costCenter: '',
  deliveryDeadline: '',
  responseDeadline: '',
  ...overrides,
});

describe('validateQuotationInfo', () => {
  it('recusa título vazio', () => {
    expect(validateQuotationInfo(input({ title: '' }))).toEqual({ ok: false, error: 'Informe o título da cotação.' });
  });

  it('recusa título só com espaços', () => {
    expect(validateQuotationInfo(input({ title: '   \n ' }))).toEqual({ ok: false, error: 'Informe o título da cotação.' });
  });

  it('recusa prioridade fora de baixa, média, alta e urgente', () => {
    expect(validateQuotationInfo(input({ priority: 'critical' }))).toEqual({
      ok: false,
      error: 'Prioridade inválida: use baixa, média, alta ou urgente.',
    });
  });

  it('apara os textos e transforma opcionais vazios em nulo', () => {
    expect(validateQuotationInfo(input({
      title: '  Compra de reagentes ',
      description: '   ',
      justification: ' Requisição: REQ-866\n',
      costCenter: '',
      priority: 'urgent',
    }))).toEqual({
      ok: true,
      info: {
        title: 'Compra de reagentes',
        description: null,
        justification: 'Requisição: REQ-866',
        priority: 'urgent',
        costCenter: null,
        deliveryDeadline: null,
        responseDeadline: null,
      },
    });
  });

  it('aceita prazos no passado', () => {
    const result = validateQuotationInfo(input({ deliveryDeadline: '2020-01-10', responseDeadline: '2020-01-05' }));
    expect(result).toMatchObject({ ok: true, info: { deliveryDeadline: '2020-01-10', responseDeadline: '2020-01-05' } });
  });
});

const current: QuotationInfo = {
  title: 'Compra de reagentes',
  description: 'Reagentes do setor de bioquímica',
  justification: 'Estoque baixo',
  priority: 'medium',
  costCenter: 'CC-001',
  deliveryDeadline: '2026-11-10',
  responseDeadline: '2026-10-30',
};

describe('diffQuotationInfo', () => {
  it('lista só os campos alterados, pela coluna do banco, com de e para', () => {
    expect(diffQuotationInfo(current, {
      ...current,
      justification: 'Estoque baixo\nRequisição: REQ-866',
      priority: 'urgent',
      deliveryDeadline: '2026-11-20',
    })).toEqual({
      justification: { de: 'Estoque baixo', para: 'Estoque baixo\nRequisição: REQ-866' },
      priority: { de: 'medium', para: 'urgent' },
      deadline: { de: '2026-11-10', para: '2026-11-20' },
    });
  });

  it('sem alteração, o diff é vazio', () => {
    expect(diffQuotationInfo(current, { ...current })).toEqual({});
  });

  it('vazio para preenchido e preenchido para vazio contam como alteração', () => {
    expect(diffQuotationInfo(
      { ...current, costCenter: null, responseDeadline: '2026-10-30' },
      { ...current, costCenter: 'CC-002', responseDeadline: null },
    )).toEqual({
      cost_center: { de: null, para: 'CC-002' },
      response_deadline: { de: '2026-10-30', para: null },
    });
  });

  it('texto igual depois de aparar não conta como alteração', () => {
    expect(diffQuotationInfo(
      { ...current, justification: 'Estoque baixo  \n', description: '' },
      { ...current, justification: 'Estoque baixo', description: null },
    )).toEqual({});
  });
});

describe('quotationInfoInputFrom', () => {
  it('preenche o formulário com os valores da cotação, prazos como data e ausentes como vazio', () => {
    expect(quotationInfoInputFrom({
      title: 'Compra de reagentes',
      description: undefined,
      justification: 'Estoque baixo',
      priority: 'high',
      costCenter: undefined,
      deliveryDeadline: '2026-11-10T00:00:00+00:00',
      responseDeadline: undefined,
    })).toEqual({
      title: 'Compra de reagentes',
      description: '',
      justification: 'Estoque baixo',
      priority: 'high',
      costCenter: '',
      deliveryDeadline: '2026-11-10',
      responseDeadline: '',
    });
  });
});
