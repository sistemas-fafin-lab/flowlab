import { describe, expect, it } from 'vitest';
import { buildQuotationApprovalNotifications } from './notifications';
import { formatCurrency } from '../../utils/paymentUtils';

const baseQuotation = {
  code: 'COT-001',
  title: 'Compra de luvas',
  quotationType: 'compras' as const,
  createdByName: 'Maria Souza',
  finalTotalAmount: undefined as number | undefined,
  estimatedTotalAmount: 5000,
  selectedSupplierName: 'Fornecedor Alfa Ltda',
  items: [
    { productName: 'Luva nitrílica M', quantity: 10, unit: 'cx' },
    { productName: 'Máscara N95', quantity: 3, unit: 'un' },
  ],
};

describe('buildQuotationApprovalNotifications', () => {
  it('monta uma notificação por aprovador com email, usando o template de alçada', () => {
    const notifications = buildQuotationApprovalNotifications(baseQuotation, [
      { user_email: 'gestor1@empresa.com' },
      { user_email: 'gestor2@empresa.com' },
    ]);

    const expectedVariables = {
      quotation_code: 'COT-001',
      quotation_title: 'Compra de luvas',
      quotation_type_label: 'Compras',
      requester_name: 'Maria Souza',
      total_amount: formatCurrency(5000),
      action_url: 'https://flow-lab.vercel.app/quotations',
      supplier_name: 'Fornecedor Alfa Ltda',
      items_list_html: '<li>10 cx &mdash; Luva nitrílica M</li><li>3 un &mdash; Máscara N95</li>',
    };

    expect(notifications).toEqual([
      { to: 'gestor1@empresa.com', templateSlug: 'quotation_awaiting_approval', variables: expectedVariables },
      { to: 'gestor2@empresa.com', templateSlug: 'quotation_awaiting_approval', variables: expectedVariables },
    ]);
  });

  it('ignora aprovadores sem email cadastrado', () => {
    const notifications = buildQuotationApprovalNotifications(baseQuotation, [
      { user_email: null },
      { user_email: 'gestor@empresa.com' },
    ]);

    expect(notifications).toHaveLength(1);
    expect(notifications[0].to).toBe('gestor@empresa.com');
  });

  it('retorna lista vazia quando não há aprovadores elegíveis', () => {
    expect(buildQuotationApprovalNotifications(baseQuotation, [])).toEqual([]);
  });

  it('usa finalTotalAmount no lugar de estimatedTotalAmount quando definido', () => {
    const notifications = buildQuotationApprovalNotifications(
      { ...baseQuotation, finalTotalAmount: 12345.6 },
      [{ user_email: 'gestor@empresa.com' }],
    );

    expect(notifications[0].variables.total_amount).toBe(formatCurrency(12345.6));
  });

  it('usa o rótulo correto para cotações do tipo contratação', () => {
    const notifications = buildQuotationApprovalNotifications(
      { ...baseQuotation, quotationType: 'contratacao' },
      [{ user_email: 'gestor@empresa.com' }],
    );

    expect(notifications[0].variables.quotation_type_label).toBe('Contratação');
  });

  it('usa "Não informado" quando não há fornecedor selecionado', () => {
    const notifications = buildQuotationApprovalNotifications(
      { ...baseQuotation, selectedSupplierName: undefined },
      [{ user_email: 'gestor@empresa.com' }],
    );

    expect(notifications[0].variables.supplier_name).toBe('Não informado');
  });

  it('escapa HTML nos itens para evitar injeção no template de email', () => {
    const notifications = buildQuotationApprovalNotifications(
      { ...baseQuotation, items: [{ productName: '<script>alert(1)</script>', quantity: 1, unit: 'un' }] },
      [{ user_email: 'gestor@empresa.com' }],
    );

    expect(notifications[0].variables.items_list_html).toBe(
      '<li>1 un &mdash; &lt;script&gt;alert(1)&lt;/script&gt;</li>',
    );
  });

  it('escapa HTML em título, solicitante e fornecedor para evitar injeção no template de email', () => {
    const notifications = buildQuotationApprovalNotifications(
      {
        ...baseQuotation,
        title: '<img src=x onerror=alert(1)>',
        createdByName: '<b>Maria</b>',
        selectedSupplierName: 'Fornecedor & Cia <script>',
      },
      [{ user_email: 'gestor@empresa.com' }],
    );

    expect(notifications[0].variables.quotation_title).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(notifications[0].variables.requester_name).toBe('&lt;b&gt;Maria&lt;/b&gt;');
    expect(notifications[0].variables.supplier_name).toBe('Fornecedor &amp; Cia &lt;script&gt;');
  });
});
