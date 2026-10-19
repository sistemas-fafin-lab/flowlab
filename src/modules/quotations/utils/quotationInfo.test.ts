import { describe, expect, it } from 'vitest';
import { diffQuotationInfo, formatQuotationInfoDetails, quotationInfoInputFrom, validateQuotationInfo, type QuotationInfo, type QuotationInfoInput } from './quotationInfo';

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

describe('formatQuotationInfoDetails', () => {
  it('lista cada campo alterado com o rótulo em português, antes e depois', () => {
    expect(formatQuotationInfoDetails({ title: { de: 'Reagentes', para: 'Compra de reagentes' } })).toEqual([
      {
        label: 'Título',
        de: { text: 'Reagentes', full: null },
        para: { text: 'Compra de reagentes', full: null },
      },
    ]);
  });

  it('mostra "—" para valor vazio, de um lado ou do outro', () => {
    expect(
      formatQuotationInfoDetails({
        justification: { de: null, para: 'Requisição: REQ-866' },
        cost_center: { de: 'CC-12', para: '' },
      }),
    ).toEqual([
      { label: 'Justificativa', de: { text: '—', full: null }, para: { text: 'Requisição: REQ-866', full: null } },
      { label: 'Centro de custo', de: { text: 'CC-12', full: null }, para: { text: '—', full: null } },
    ]);
  });

  it('mostra a prioridade pelo rótulo', () => {
    expect(formatQuotationInfoDetails({ priority: { de: 'medium', para: 'urgent' } })).toEqual([
      { label: 'Prioridade', de: { text: 'Média', full: null }, para: { text: 'Urgente', full: null } },
    ]);
  });

  it('mostra os prazos como dd/mm/aaaa, no dia gravado', () => {
    expect(
      formatQuotationInfoDetails({
        deadline: { de: '2026-10-20T00:00:00+00:00', para: '2026-11-03T00:00:00+00:00' },
        response_deadline: { de: null, para: '2026-09-30T00:00:00+00:00' },
      }),
    ).toEqual([
      { label: 'Prazo de entrega', de: { text: '20/10/2026', full: null }, para: { text: '03/11/2026', full: null } },
      { label: 'Prazo de resposta', de: { text: '—', full: null }, para: { text: '30/09/2026', full: null } },
    ]);
  });

  it('corta textos longos em 120 caracteres e guarda o valor completo', () => {
    const longo = 'a'.repeat(150);
    const exato = 'b'.repeat(120);
    expect(formatQuotationInfoDetails({ justification: { de: exato, para: longo } })).toEqual([
      {
        label: 'Justificativa',
        de: { text: exato, full: null },
        para: { text: `${'a'.repeat(120)}…`, full: longo },
      },
    ]);
  });

  it('mantém uma coluna desconhecida, com o nome da coluna como rótulo', () => {
    expect(formatQuotationInfoDetails({ notes: { de: 'x', para: 'y' } })).toEqual([
      { label: 'notes', de: { text: 'x', full: null }, para: { text: 'y', full: null } },
    ]);
  });

  it('ignora entradas do details que não têm o formato { de, para }', () => {
    expect(formatQuotationInfoDetails({ title: null, priority: 'high', description: { de: 'a', para: 'b' } })).toEqual([
      { label: 'Descrição', de: { text: 'a', full: null }, para: { text: 'b', full: null } },
    ]);
  });
});
