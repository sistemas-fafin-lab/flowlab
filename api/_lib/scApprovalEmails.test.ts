import { describe, expect, it } from 'vitest';
import {
  buildScAwaitingApprovalEmail,
  buildScRejectedEmail,
  type ScEmailRow,
} from './scApprovalEmails.js';

const BASE_URL = 'https://flow-lab.vercel.app';

const sc: ScEmailRow = {
  id: 'REQ868',
  items: [
    { productId: 'p-luva', productName: 'Luva nitrílica', quantity: 10 },
    { productId: null, productName: 'Tubo EDTA', quantity: 200 },
  ],
  reason: 'Reposição mensal',
  priority: 'standard',
  requested_by: 'Ana Claudia',
  request_date: '2026-10-20',
  department: 'QUALIDADE',
  rejection_comment: null,
};

const paulo = { name: 'Paulo Vítor', email: 'paulo@lab.com' };

describe('buildScAwaitingApprovalEmail', () => {
  it('vai para o aprovador, com link para a lista filtrada em "Aguardando minha aprovação"', () => {
    const email = buildScAwaitingApprovalEmail(sc, paulo, BASE_URL);

    expect(email?.to).toBe('paulo@lab.com');
    expect(email?.variables.action_url).toBe('https://flow-lab.vercel.app/requests/purchases?aprovacao=minha');
    expect(email?.variables.subject).toBe('[FlowLAB] SC REQ868 de Ana Claudia aguarda sua aprovação');
    expect(email?.variables.approver_name).toBe('Paulo Vítor');
    expect(email?.variables.requester_name).toBe('Ana Claudia');
    expect(email?.variables.department).toBe('Qualidade');
    expect(email?.variables.request_date).toBe('20/10/2026');
    expect(email?.variables.priority_label).toBe('Padrão');
  });

  it.each([
    ['sem e-mail', { name: 'Paulo Vítor', email: null }],
    ['com e-mail em branco', { name: 'Paulo Vítor', email: '  ' }],
    ['com e-mail inválido', { name: 'Paulo Vítor', email: 'paulo' }],
    ['não encontrado', null],
  ])('aprovador %s não recebe e-mail', (_caso, approver) => {
    expect(buildScAwaitingApprovalEmail(sc, approver, BASE_URL)).toBeNull();
  });

  it('lista os itens e escapa HTML nos campos livres', () => {
    const email = buildScAwaitingApprovalEmail(
      {
        ...sc,
        reason: '<script>x</script>\nsegunda linha',
        requested_by: 'Ana <b>',
        items: [{ productId: null, productName: '<img src=x>', quantity: 3 }],
      },
      { name: 'Paulo & Cia', email: 'paulo@lab.com' },
      BASE_URL,
    );

    expect(email?.variables.reason_html).toBe('&lt;script&gt;x&lt;/script&gt;<br />segunda linha');
    expect(email?.variables.requester_name).toBe('Ana &lt;b&gt;');
    expect(email?.variables.approver_name).toBe('Paulo &amp; Cia');
    expect(email?.variables.items_list_html).toContain('&lt;img src=x&gt;');
    expect(email?.variables.items_list_html).toContain('Quantidade: 3');
    expect(email?.variables.items_list_html).not.toContain('<img');
  });
});

describe('buildScRejectedEmail', () => {
  const rejeitada: ScEmailRow = { ...sc, rejection_comment: 'Já temos em estoque' };
  const ana = { name: 'Ana Claudia', email: 'ana@lab.com' };

  it('vai para quem pediu, com o motivo e quem rejeitou, e link para as rejeitadas', () => {
    const email = buildScRejectedEmail(rejeitada, ana, paulo, BASE_URL);

    expect(email?.to).toBe('ana@lab.com');
    expect(email?.variables.subject).toBe('[FlowLAB] Sua SC REQ868 foi rejeitada');
    expect(email?.variables.rejection_comment_html).toBe('Já temos em estoque');
    expect(email?.variables.rejected_by_name).toBe('Paulo Vítor');
    expect(email?.variables.requester_name).toBe('Ana Claudia');
    expect(email?.variables.action_url).toBe('https://flow-lab.vercel.app/requests/purchases?status=rejected');
  });

  it('escapa o comentário e preserva as quebras de linha', () => {
    const email = buildScRejectedEmail(
      { ...rejeitada, rejection_comment: '<a href="x">fornecedor</a> & cia\nrefaça' },
      ana,
      { name: 'Paulo <i>', email: null },
      BASE_URL,
    );

    expect(email?.variables.rejection_comment_html).toBe(
      '&lt;a href=&quot;x&quot;&gt;fornecedor&lt;/a&gt; &amp; cia<br />refaça',
    );
    expect(email?.variables.rejected_by_name).toBe('Paulo &lt;i&gt;');
  });

  it('quem rejeitou não identificado fica em branco', () => {
    const email = buildScRejectedEmail(rejeitada, ana, null, BASE_URL);
    expect(email?.variables.rejected_by_name).toBe('');
  });

  it.each([
    ['sem e-mail', { name: 'Ana Claudia', email: null }],
    ['não encontrado', null],
  ])('quem pediu %s não recebe e-mail', (_caso, requester) => {
    expect(buildScRejectedEmail(rejeitada, requester, paulo, BASE_URL)).toBeNull();
  });
});
