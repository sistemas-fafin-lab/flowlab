import { describe, expect, it } from 'vitest';
import { buildQuotationApprovalNotifications } from './notifications';
import { formatCurrency } from '../../utils/paymentUtils';
import { SupplierProposal } from './types';

const makeProposal = (overrides: Partial<SupplierProposal> & Pick<SupplierProposal, 'id' | 'supplierName' | 'totalAmount'>): SupplierProposal => ({
  quotationId: 'q1',
  supplierId: overrides.id,
  status: 'submitted',
  items: [],
  deliveryTime: '7 dias',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const winnerProposal = makeProposal({ id: 'p1', supplierName: 'Fornecedor Alfa Ltda', totalAmount: 5000 });
const otherProposal = makeProposal({ id: 'p2', supplierName: 'Fornecedor Beta S.A.', totalAmount: 6200 });

const baseQuotation = {
  code: 'COT-001',
  title: 'Compra de luvas',
  quotationType: 'compras' as const,
  createdByName: 'Maria Souza',
  finalTotalAmount: undefined as number | undefined,
  estimatedTotalAmount: 5000,
  proposals: [winnerProposal, otherProposal],
  selectedProposalId: 'p1',
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
      action_url: 'https://flow-lab.vercel.app/quotations?status=awaiting_approval',
      proposals_list_html:
        '<li style="margin-bottom:4px;"><strong>Fornecedor Alfa Ltda &mdash; ' + formatCurrency(5000) + '</strong> '
        + '<span style="display:inline-block;padding:1px 8px;font-size:10px;font-weight:700;color:#047857;'
        + 'background-color:#d1fae5;border-radius:9999px;letter-spacing:0.3px;">VENCEDORA</span></li>'
        + '<li style="margin-bottom:4px;">Fornecedor Beta S.A. &mdash; ' + formatCurrency(6200) + '</li>',
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

  it('lista todas as propostas recebidas, não só a vencedora', () => {
    const thirdProposal = makeProposal({ id: 'p3', supplierName: 'Fornecedor Gama ME', totalAmount: 4800 });
    const notifications = buildQuotationApprovalNotifications(
      { ...baseQuotation, proposals: [winnerProposal, otherProposal, thirdProposal] },
      [{ user_email: 'gestor@empresa.com' }],
    );

    const html = notifications[0].variables.proposals_list_html;
    expect(html).toContain('Fornecedor Alfa Ltda');
    expect(html).toContain('Fornecedor Beta S.A.');
    expect(html).toContain('Fornecedor Gama ME');
  });

  it('destaca só a proposta vencedora atual (VENCEDORA aparece uma única vez)', () => {
    const notifications = buildQuotationApprovalNotifications(baseQuotation, [{ user_email: 'gestor@empresa.com' }]);

    const html = notifications[0].variables.proposals_list_html;
    expect(html.match(/VENCEDORA/g)).toHaveLength(1);
    expect(html.indexOf('Fornecedor Alfa Ltda')).toBeLessThan(html.indexOf('VENCEDORA'));
  });

  it('reflete a troca de vencedora: destaca a proposta recém-selecionada', () => {
    const notifications = buildQuotationApprovalNotifications(
      { ...baseQuotation, selectedProposalId: 'p2' },
      [{ user_email: 'gestor@empresa.com' }],
    );

    const html = notifications[0].variables.proposals_list_html;
    const winnerLi = html.split('</li>').find((li) => li.includes('VENCEDORA'));
    expect(winnerLi).toContain('Fornecedor Beta S.A.');
  });

  it('sem propostas, a lista fica vazia (sem quebrar a montagem)', () => {
    const notifications = buildQuotationApprovalNotifications(
      { ...baseQuotation, proposals: [], selectedProposalId: undefined },
      [{ user_email: 'gestor@empresa.com' }],
    );

    expect(notifications[0].variables.proposals_list_html).toBe('');
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

  it('escapa HTML no nome do fornecedor da proposta para evitar injeção no template de email', () => {
    const notifications = buildQuotationApprovalNotifications(
      { ...baseQuotation, proposals: [makeProposal({ id: 'p1', supplierName: 'Fornecedor & Cia <script>', totalAmount: 5000 })] },
      [{ user_email: 'gestor@empresa.com' }],
    );

    expect(notifications[0].variables.proposals_list_html).toContain('Fornecedor &amp; Cia &lt;script&gt;');
  });

  it('escapa HTML em título e solicitante para evitar injeção no template de email', () => {
    const notifications = buildQuotationApprovalNotifications(
      {
        ...baseQuotation,
        title: '<img src=x onerror=alert(1)>',
        createdByName: '<b>Maria</b>',
      },
      [{ user_email: 'gestor@empresa.com' }],
    );

    expect(notifications[0].variables.quotation_title).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(notifications[0].variables.requester_name).toBe('&lt;b&gt;Maria&lt;/b&gt;');
  });
});
