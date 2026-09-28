import { describe, expect, it } from 'vitest';
import {
  buildRequestsDailyDigest,
  buildRequestsDigestEmailVariables,
  type RequestsDigestRow,
} from './requestsDailyDigest.js';

const ACTION_URL = 'https://flow-lab.vercel.app/requests/purchases?status=pending';

// 28/09/2026 20:00 UTC = 17:00 BRT (horário do cron).
const NOW = new Date('2026-09-28T20:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * HOUR_MS).toISOString();

const row = (overrides: Partial<RequestsDigestRow> = {}): RequestsDigestRow => ({
  type: 'SC',
  status: 'pending',
  priority: 'standard',
  requested_by: 'Maria Souza',
  department: 'AREA_TECNICA',
  items: [{ productName: 'Luva' }],
  created_at: hoursAgo(1),
  ...overrides,
});

describe('buildRequestsDailyDigest', () => {
  it('janela de 24h: inclui o limite inicial e exclui o momento da execução', () => {
    const digest = buildRequestsDailyDigest(
      [
        row({ requested_by: 'no limite', created_at: hoursAgo(24) }),
        row({ requested_by: 'um ms antes', created_at: new Date(NOW.getTime() - 24 * HOUR_MS - 1).toISOString() }),
        row({ requested_by: 'agora', created_at: NOW.toISOString() }),
      ],
      NOW,
    );

    expect(digest.newRequests.map((r) => r.requested_by)).toEqual(['no limite']);
    expect(digest.counts.newCount).toBe(1);
    // "um ms antes" ficou fora da janela, mas segue pendente → pendente antiga.
    expect(digest.counts.olderPendingCount).toBe(1);
  });

  it('separa novas (qualquer status) de pendentes antigas (só status pending, antes da janela)', () => {
    const digest = buildRequestsDailyDigest(
      [
        row({ requested_by: 'nova pendente', created_at: hoursAgo(2) }),
        row({ requested_by: 'nova já aprovada', status: 'approved', created_at: hoursAgo(3) }),
        row({ requested_by: 'antiga pendente', created_at: hoursAgo(48) }),
        row({ requested_by: 'antiga pendente 2', created_at: hoursAgo(30) }),
        row({ requested_by: 'antiga aprovada', status: 'approved', created_at: hoursAgo(48) }),
      ],
      NOW,
    );

    expect(digest.newRequests.map((r) => r.requested_by)).toEqual(['nova já aprovada', 'nova pendente']);
    expect(digest.counts.newCount).toBe(2);
    expect(digest.counts.olderPendingCount).toBe(2);
    expect(digest.isEmpty).toBe(false);
  });

  it('conta as novas por tipo e urgência (prioridade diferente de standard)', () => {
    const digest = buildRequestsDailyDigest(
      [
        row({ type: 'SC', priority: 'standard' }),
        row({ type: 'SC', priority: 'urgent' }),
        row({ type: 'SM', priority: 'priority' }),
        row({ type: 'SM', priority: 'standard' }),
        row({ type: 'SM', priority: 'standard' }),
        // pendente antiga urgente não entra nas contagens das novas
        row({ type: 'SC', priority: 'urgent', created_at: hoursAgo(72) }),
      ],
      NOW,
    );

    expect(digest.counts).toEqual({
      newCount: 5,
      scCount: 2,
      smCount: 3,
      urgentCount: 2,
      olderPendingCount: 1,
    });
  });

  it('ordena as novas da mais antiga para a mais recente', () => {
    const digest = buildRequestsDailyDigest(
      [
        row({ requested_by: 'c', created_at: hoursAgo(1) }),
        row({ requested_by: 'a', created_at: hoursAgo(20) }),
        row({ requested_by: 'b', created_at: hoursAgo(5) }),
      ],
      NOW,
    );

    expect(digest.newRequests.map((r) => r.requested_by)).toEqual(['a', 'b', 'c']);
  });

  it('sem novas e sem pendentes antigas → resumo vazio', () => {
    const vazio = buildRequestsDailyDigest([], NOW);
    expect(vazio.isEmpty).toBe(true);
    expect(vazio.counts).toEqual({ newCount: 0, scCount: 0, smCount: 0, urgentCount: 0, olderPendingCount: 0 });

    const soAntigasResolvidas = buildRequestsDailyDigest(
      [row({ status: 'completed', created_at: hoursAgo(100) })],
      NOW,
    );
    expect(soAntigasResolvidas.isEmpty).toBe(true);
  });

  it('só pendentes antigas (nada novo) ainda gera resumo', () => {
    const digest = buildRequestsDailyDigest([row({ created_at: hoursAgo(50) })], NOW);
    expect(digest.isEmpty).toBe(false);
    expect(digest.counts.newCount).toBe(0);
    expect(digest.counts.olderPendingCount).toBe(1);
  });
});

describe('buildRequestsDigestEmailVariables', () => {
  it('monta data, contagens, lista das novas e link', () => {
    const digest = buildRequestsDailyDigest(
      [
        row({
          type: 'SC',
          priority: 'urgent',
          requested_by: 'Maria Souza',
          department: 'AREA_TECNICA',
          items: [{ productName: 'Luva' }, { productName: 'Tubo' }],
          created_at: hoursAgo(3),
        }),
        row({
          type: 'SM',
          requested_by: 'João Lima',
          department: 'ATENDIMENTO',
          items: [{ productName: 'Papel' }],
          created_at: hoursAgo(2),
        }),
        row({ created_at: hoursAgo(40) }),
      ],
      NOW,
    );

    const v = buildRequestsDigestEmailVariables(digest, NOW, ACTION_URL);

    expect(v.digest_date).toBe('28/09/2026');
    expect(v.subject).toBe('[FlowLAB] Resumo de solicitações de 28/09/2026: 2 nova(s), 1 pendente(s) antiga(s)');
    expect(v.new_count).toBe('2');
    expect(v.sc_count).toBe('1');
    expect(v.sm_count).toBe('1');
    expect(v.urgent_count).toBe('1');
    expect(v.older_pending_count).toBe('1');
    expect(v.action_url).toBe(ACTION_URL);
    expect(v.notice_html).toBe('');

    const [maria, joao] = v.new_list_html.split('</li>');
    expect(maria).toContain('SC');
    expect(maria).toContain('Maria Souza');
    expect(maria).toContain('Área técnica');
    expect(maria).toContain('2 itens');
    expect(maria).toContain('URGENTE');
    expect(joao).toContain('SM');
    expect(joao).toContain('João Lima');
    expect(joao).toContain('Atendimento');
    expect(joao).toContain('1 item');
    expect(joao).not.toContain('URGENTE');
  });

  it('data do resumo usa o fuso de Brasília', () => {
    // 29/09 01:00 UTC ainda é 28/09 em BRT.
    const madrugadaUtc = new Date('2026-09-29T01:00:00.000Z');
    const v = buildRequestsDigestEmailVariables(buildRequestsDailyDigest([], madrugadaUtc), madrugadaUtc, ACTION_URL);
    expect(v.digest_date).toBe('28/09/2026');
  });

  it('sem novas, a lista traz uma linha informativa', () => {
    const digest = buildRequestsDailyDigest([row({ created_at: hoursAgo(50) })], NOW);
    const v = buildRequestsDigestEmailVariables(digest, NOW, ACTION_URL);
    expect(v.new_list_html).toContain('Nenhuma solicitação nova');
  });

  it('aviso opcional vira um bloco no topo, com o texto escapado', () => {
    const digest = buildRequestsDailyDigest([row()], NOW);
    const v = buildRequestsDigestEmailVariables(digest, NOW, ACTION_URL, 'WhatsApp <falhou> & cia');
    expect(v.notice_html).toContain('WhatsApp &lt;falhou&gt; &amp; cia');
    expect(v.notice_html).not.toContain('<falhou>');
  });

  it('escapa HTML nos campos livres (solicitante e departamento)', () => {
    const digest = buildRequestsDailyDigest(
      [row({ requested_by: 'Ana <b>', department: 'Setor & <i>Cia</i>' })],
      NOW,
    );
    const v = buildRequestsDigestEmailVariables(digest, NOW, ACTION_URL);
    expect(v.new_list_html).toContain('Ana &lt;b&gt;');
    expect(v.new_list_html).toContain('Setor &amp; &lt;i&gt;Cia&lt;/i&gt;');
    expect(v.new_list_html).not.toContain('<b>');
    expect(v.new_list_html).not.toContain('<i>');
  });

  it('campos nulos não quebram a linha', () => {
    const digest = buildRequestsDailyDigest([row({ requested_by: null, department: null, items: null })], NOW);
    const v = buildRequestsDigestEmailVariables(digest, NOW, ACTION_URL);
    expect(v.new_list_html).toContain('0 itens');
  });
});
