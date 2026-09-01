import { describe, expect, it } from 'vitest';
import { buildPendingApprovalDigestNotifications } from './pendingApprovalDigest';
import { formatCurrency } from '../../utils/paymentUtils';

const ACTION_URL = 'https://flow-lab.vercel.app/quotations?status=awaiting_approval';

const cotacaoLuvas = {
  code: 'COT-001',
  title: 'Compra de luvas',
  quotation_type: 'compras' as const,
  created_by_name: 'Maria Souza',
  selected_price: null,
  final_total_amount: null,
  estimated_total: 3000,
};

const cotacaoManutencao = {
  code: 'COT-002',
  title: 'Contratação de manutenção predial',
  quotation_type: 'contratacao' as const,
  created_by_name: 'João Lima',
  selected_price: null,
  final_total_amount: 15000,
  estimated_total: 12000,
};

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
});
