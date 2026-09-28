import { describe, expect, it } from 'vitest';
import {
  buildRequestCreatedEmailVariables,
  parseRecipientList,
  type RequestCreatedRow,
} from './requestCreatedEmail.js';

const ACTION_URL = 'https://flow-lab.vercel.app/requests/purchases';

const scComFornecedor: RequestCreatedRow = {
  type: 'SC',
  items: [
    { productId: 'p-luva', productName: 'Luva nitrílica', quantity: 10 },
    { productId: 'p-tubo', productName: 'Tubo EDTA', quantity: 200 },
  ],
  reason: 'Reposição mensal',
  priority: 'standard',
  requested_by: 'Maria Souza',
  request_date: '2026-09-28',
  department: 'AREA_TECNICA',
  supplier_name: 'Distribuidora Alfa',
};

const smSemFornecedor: RequestCreatedRow = {
  type: 'SM',
  items: [{ productId: 'p-luva', productName: 'Luva nitrílica', quantity: 2 }],
  reason: 'Uso na coleta',
  priority: 'standard',
  requested_by: 'João Lima',
  request_date: '2026-09-28',
  department: 'ATENDIMENTO',
  supplier_name: null,
};

const estoque = { 'p-luva': 50, 'p-tubo': 0 };

describe('buildRequestCreatedEmailVariables', () => {
  it('monta as variáveis de uma SC com fornecedor', () => {
    const v = buildRequestCreatedEmailVariables(scComFornecedor, estoque, ACTION_URL);

    expect(v.subject).toBe('[FlowLAB] Nova Solicitação de Compra (SC) de Maria Souza');
    expect(v.request_type_label).toBe('Solicitação de Compra (SC)');
    expect(v.requester_name).toBe('Maria Souza');
    expect(v.department).toBe('Área técnica');
    expect(v.priority_label).toBe('Padrão');
    expect(v.request_date).toBe('28/09/2026');
    expect(v.reason_html).toBe('Reposição mensal');
    expect(v.supplier_row_html).toContain('Distribuidora Alfa');
    expect(v.action_url).toBe(ACTION_URL);
  });

  it('SM não mostra linha de fornecedor', () => {
    const v = buildRequestCreatedEmailVariables(smSemFornecedor, estoque, ACTION_URL);

    expect(v.subject).toBe('[FlowLAB] Nova Solicitação de Material (SM) de João Lima');
    expect(v.request_type_label).toBe('Solicitação de Material (SM)');
    expect(v.department).toBe('Atendimento');
    expect(v.supplier_row_html).toBe('');
  });

  it('SC sem fornecedor informado também não mostra a linha', () => {
    const v = buildRequestCreatedEmailVariables({ ...scComFornecedor, supplier_name: '' }, estoque, ACTION_URL);
    expect(v.supplier_row_html).toBe('');
  });

  it('prioridade standard não marca urgência no assunto', () => {
    const v = buildRequestCreatedEmailVariables(scComFornecedor, estoque, ACTION_URL);
    expect(v.subject.startsWith('[URGENTE]')).toBe(false);
  });

  it.each([
    ['urgent', 'Urgente'],
    ['priority', 'Prioritário'],
  ] as const)('prioridade %s leva [URGENTE] no assunto', (priority, label) => {
    const v = buildRequestCreatedEmailVariables({ ...scComFornecedor, priority }, estoque, ACTION_URL);
    expect(v.subject).toBe('[URGENTE] [FlowLAB] Nova Solicitação de Compra (SC) de Maria Souza');
    expect(v.priority_label).toBe(label);
  });

  it('lista os itens com quantidade e marca "sem estoque" pelo estoque atual', () => {
    const v = buildRequestCreatedEmailVariables(scComFornecedor, estoque, ACTION_URL);

    const [luva, tubo] = v.items_list_html.split('</li>');
    expect(luva).toContain('Luva nitrílica');
    expect(luva).toContain('Quantidade: 10');
    expect(luva).not.toContain('sem estoque');
    expect(tubo).toContain('Tubo EDTA');
    expect(tubo).toContain('Quantidade: 200');
    expect(tubo).toContain('sem estoque');
    expect(v.out_of_stock_count).toBe('1');
  });

  it('item sem produto cadastrado ou fora do mapa de estoque conta como sem estoque', () => {
    const v = buildRequestCreatedEmailVariables(
      {
        ...smSemFornecedor,
        items: [
          { productId: null, productName: 'Produto novo', quantity: 1 },
          { productId: 'p-desconhecido', productName: 'Sumiu', quantity: 1 },
        ],
      },
      estoque,
      ACTION_URL,
    );

    expect(v.items_list_html.match(/sem estoque/g)).toHaveLength(2);
    expect(v.out_of_stock_count).toBe('2');
  });

  it('escapa HTML nos campos livres', () => {
    const v = buildRequestCreatedEmailVariables(
      {
        ...scComFornecedor,
        reason: '<script>alert(1)</script>\nsegunda linha',
        requested_by: 'Ana <b>',
        department: 'Setor & Cia',
        supplier_name: '"Fornecedor" <x>',
        items: [{ productId: 'p-luva', productName: '<img src=x>', quantity: 1 }],
      },
      estoque,
      ACTION_URL,
    );

    expect(v.reason_html).toBe('&lt;script&gt;alert(1)&lt;/script&gt;<br />segunda linha');
    expect(v.requester_name).toBe('Ana &lt;b&gt;');
    expect(v.department).toBe('Setor &amp; Cia');
    expect(v.supplier_row_html).toContain('&quot;Fornecedor&quot; &lt;x&gt;');
    expect(v.items_list_html).toContain('&lt;img src=x&gt;');
    expect(v.items_list_html).not.toContain('<img');
    // Assunto é texto puro (header de e-mail), não HTML: não escapa.
    expect(v.subject).toBe('[FlowLAB] Nova Solicitação de Compra (SC) de Ana <b>');
  });
});

describe('parseRecipientList', () => {
  it('separa por vírgula, apara espaços e ignora vazios', () => {
    expect(parseRecipientList(' estoque@lab.com, compras@lab.com ,,')).toEqual([
      'estoque@lab.com',
      'compras@lab.com',
    ]);
  });

  it('env ausente ou vazia → lista vazia', () => {
    expect(parseRecipientList(undefined)).toEqual([]);
    expect(parseRecipientList('  ')).toEqual([]);
  });
});
