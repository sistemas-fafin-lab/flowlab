import { describe, expect, it } from 'vitest';
import { buildPendingApprovalDigestNotifications } from './pendingApprovalDigest';
import { formatCurrency } from '../../utils/paymentUtils';
import { buildProposalsListHtml } from './utils/emailListsHtml';

const ACTION_URL = 'https://flow-lab.vercel.app/quotations?status=awaiting_approval';

const cotacaoLuvas = {
  code: 'COT-001',
  title: 'Compra de luvas',
  quotation_type: 'compras' as const,
  created_by_name: 'Maria Souza',
  selected_price: null,
  final_total_amount: null,
  estimated_total: 3000,
  selected_proposal_id: null,
  quotation_proposals: [],
};

const cotacaoManutencao = {
  code: 'COT-002',
  title: 'Contratação de manutenção predial',
  quotation_type: 'contratacao' as const,
  created_by_name: 'João Lima',
  selected_price: null,
  final_total_amount: 15000,
  estimated_total: 12000,
  selected_proposal_id: 'prop-beta',
  quotation_proposals: [
    { id: 'prop-alfa', supplier_name: 'Predial Alfa Ltda', total_amount: 16500, status: 'rejected', is_winner: false },
    { id: 'prop-beta', supplier_name: 'Manutenção Beta S.A.', total_amount: 15000, status: 'selected', is_winner: true },
  ],
};

const liDaCotacao = (html: string, code: string) =>
  html.split(/(?=<li><strong>COT-)/).find((li) => li.includes(code)) ?? '';

describe('buildPendingApprovalDigestNotifications', () => {
  it('monta uma notificação por gestor elegível, cada uma só com as cotações dentro da sua alçada', () => {
    const notifications = buildPendingApprovalDigestNotifications(
      [cotacaoLuvas, cotacaoManutencao],
      [
        { user_email: 'gestor.baixa@empresa.com', effective_max_amount: 5000 },
        { user_email: 'gestor.alta@empresa.com', effective_max_amount: 20000 },
      ],
      ACTION_URL,
    );

    expect(notifications).toHaveLength(2);

    const baixa = notifications.find((n) => n.to === 'gestor.baixa@empresa.com');
    expect(baixa).toEqual({
      to: 'gestor.baixa@empresa.com',
      templateSlug: 'quotation_pending_approval_digest',
      variables: {
        pending_count: '1',
        pending_list_html:
          '<li><strong>COT-001</strong> &mdash; Compra de luvas (Compras, solicitado por Maria Souza) '
          + `&mdash; ${formatCurrency(3000)}</li>`,
        action_url: ACTION_URL,
      },
    });

    const alta = notifications.find((n) => n.to === 'gestor.alta@empresa.com');
    expect(alta?.variables.pending_count).toBe('2');
  });

  it('agrupa mais de uma cotação pendente para o mesmo gestor em uma única notificação', () => {
    const notifications = buildPendingApprovalDigestNotifications(
      [cotacaoLuvas, cotacaoManutencao],
      [{ user_email: 'gestor@empresa.com', effective_max_amount: 20000 }],
      ACTION_URL,
    );

    expect(notifications).toHaveLength(1);
    expect(notifications[0].variables.pending_count).toBe('2');
    expect(notifications[0].variables.pending_list_html).toContain('COT-001');
    expect(notifications[0].variables.pending_list_html).toContain('COT-002');
  });

  it('não gera notificação para gestor sem nenhuma cotação pendente dentro da alçada', () => {
    const notifications = buildPendingApprovalDigestNotifications(
      [cotacaoManutencao],
      [{ user_email: 'gestor.baixa@empresa.com', effective_max_amount: 5000 }],
      ACTION_URL,
    );

    expect(notifications).toEqual([]);
  });

  it('ignora gestores sem email cadastrado', () => {
    const notifications = buildPendingApprovalDigestNotifications(
      [cotacaoLuvas],
      [
        { user_email: null, effective_max_amount: 20000 },
        { user_email: 'gestor@empresa.com', effective_max_amount: 20000 },
      ],
      ACTION_URL,
    );

    expect(notifications).toHaveLength(1);
    expect(notifications[0].to).toBe('gestor@empresa.com');
  });

  it('retorna lista vazia quando não há cotações pendentes', () => {
    expect(
      buildPendingApprovalDigestNotifications(
        [],
        [{ user_email: 'gestor@empresa.com', effective_max_amount: 20000 }],
        ACTION_URL,
      ),
    ).toEqual([]);
  });

  it('usa final_total_amount no lugar de estimated_total quando definido, para o cálculo de elegibilidade', () => {
    const notifications = buildPendingApprovalDigestNotifications(
      [cotacaoManutencao],
      [{ user_email: 'gestor@empresa.com', effective_max_amount: 13000 }],
      ACTION_URL,
    );

    expect(notifications).toEqual([]);
  });

  it('usa selected_price (fluxo legado) no lugar de final_total_amount/estimated_total quando definido', () => {
    const cotacaoLegada = {
      ...cotacaoManutencao,
      selected_price: 4000,
    };

    const notifications = buildPendingApprovalDigestNotifications(
      [cotacaoLegada],
      [{ user_email: 'gestor@empresa.com', effective_max_amount: 5000 }],
      ACTION_URL,
    );

    expect(notifications).toHaveLength(1);
    expect(notifications[0].variables.pending_list_html).toContain(formatCurrency(4000));
  });

  it('escapa HTML no título e no solicitante para evitar injeção no template de email', () => {
    const notifications = buildPendingApprovalDigestNotifications(
      [{ ...cotacaoLuvas, title: '<script>alert(1)</script>', created_by_name: '<b>Maria</b>' }],
      [{ user_email: 'gestor@empresa.com', effective_max_amount: 5000 }],
      ACTION_URL,
    );

    expect(notifications[0].variables.pending_list_html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(notifications[0].variables.pending_list_html).toContain('&lt;b&gt;Maria&lt;/b&gt;');
  });

  it('lista, dentro de cada cotação, todas as suas propostas com a vencedora destacada', () => {
    const notifications = buildPendingApprovalDigestNotifications(
      [cotacaoManutencao],
      [{ user_email: 'gestor@empresa.com', effective_max_amount: 20000 }],
      ACTION_URL,
    );

    const proposalsHtml = buildProposalsListHtml({
      proposals: [
        { id: 'prop-alfa', quotationId: '', supplierId: '', supplierName: 'Predial Alfa Ltda', status: 'rejected', items: [], totalAmount: 16500, deliveryTime: '', createdAt: '', updatedAt: '' },
        { id: 'prop-beta', quotationId: '', supplierId: '', supplierName: 'Manutenção Beta S.A.', status: 'selected', items: [], totalAmount: 15000, deliveryTime: '', createdAt: '', updatedAt: '' },
      ],
      selectedProposalId: 'prop-beta',
    });

    expect(notifications[0].variables.pending_list_html).toBe(
      '<li><strong>COT-002</strong> &mdash; Contratação de manutenção predial (Contratação, solicitado por João Lima) '
      + `&mdash; ${formatCurrency(15000)}`
      + `<ul style="margin:4px 0 8px 0;padding-left:18px;font-size:13px;line-height:1.6;">${proposalsHtml}</ul></li>`,
    );
  });

  it('mantém as propostas de cada cotação separadas, com a vencedora certa em cada uma', () => {
    const cotacaoLuvasComPropostas = {
      ...cotacaoLuvas,
      selected_proposal_id: 'prop-gama',
      quotation_proposals: [
        { id: 'prop-gama', supplier_name: 'Luvas Gama ME', total_amount: 3000, status: 'selected', is_winner: true },
        { id: 'prop-delta', supplier_name: 'Luvas Delta Ltda', total_amount: 3400, status: 'rejected', is_winner: false },
      ],
    };

    const html = buildPendingApprovalDigestNotifications(
      [cotacaoLuvasComPropostas, cotacaoManutencao],
      [{ user_email: 'gestor@empresa.com', effective_max_amount: 20000 }],
      ACTION_URL,
    )[0].variables.pending_list_html;

    const luvas = liDaCotacao(html, 'COT-001');
    const manutencao = liDaCotacao(html, 'COT-002');

    expect(luvas).toContain('Luvas Gama ME');
    expect(luvas).toContain('Luvas Delta Ltda');
    expect(luvas).not.toContain('Predial Alfa Ltda');
    expect(luvas.match(/VENCEDORA/g)).toHaveLength(1);
    expect(luvas).toMatch(/<strong>Luvas Gama ME[^<]*<\/strong> <span[^>]*>VENCEDORA/);

    expect(manutencao).toContain('Predial Alfa Ltda');
    expect(manutencao).not.toContain('Luvas Gama ME');
    expect(manutencao.match(/VENCEDORA/g)).toHaveLength(1);
    expect(manutencao).toMatch(/<strong>Manutenção Beta S\.A\.[^<]*<\/strong> <span[^>]*>VENCEDORA/);
  });

  it('cotação sem propostas carregadas não ganha sublista vazia', () => {
    const html = buildPendingApprovalDigestNotifications(
      [cotacaoLuvas],
      [{ user_email: 'gestor@empresa.com', effective_max_amount: 5000 }],
      ACTION_URL,
    )[0].variables.pending_list_html;

    expect(html).not.toContain('<ul');
  });

  it('escapa HTML no nome do fornecedor das propostas', () => {
    const html = buildPendingApprovalDigestNotifications(
      [{
        ...cotacaoLuvas,
        quotation_proposals: [
          { id: 'p1', supplier_name: '<img src=x onerror=alert(1)>', total_amount: 3000, status: 'submitted', is_winner: false },
        ],
      }],
      [{ user_email: 'gestor@empresa.com', effective_max_amount: 5000 }],
      ACTION_URL,
    )[0].variables.pending_list_html;

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img');
  });
});
