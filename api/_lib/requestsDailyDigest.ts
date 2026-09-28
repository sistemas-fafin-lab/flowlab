// api/_lib/requestsDailyDigest.ts
// Resumo diário de solicitações (SC/SM) para a Louise
// (api/_lib/handlers/notifications-requests-digest-cron.ts). Funções puras — o
// handler lê as linhas de `requests` no Supabase e só repassa aqui.
//
// Janela sem estado, a partir do momento da execução (`now`):
//   • novas            → created_at em [now − 24h, now), qualquer status
//   • pendentes antigas → status = 'pending' e created_at < now − 24h (só a contagem)
//
// `counts` fica separado das variáveis do e-mail para ser reaproveitado pelo
// canal WhatsApp (issue 04 — parâmetros do template na mesma ordem).

import { escapeHtml } from './html.js';
import { DEPARTMENT_LABELS } from './requestCreatedEmail.js';

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Linha de `requests` (snake_case), só com as colunas usadas no resumo. */
export interface RequestsDigestRow {
  type: 'SC' | 'SM';
  status: string;
  priority: 'standard' | 'priority' | 'urgent';
  requested_by: string | null;
  department: string | null;
  items: unknown[] | null;
  created_at: string;
}

export interface RequestsDigestCounts {
  newCount: number;
  scCount: number;
  smCount: number;
  urgentCount: number;
  olderPendingCount: number;
}

export interface RequestsDailyDigest {
  /** Novas da janela, da mais antiga para a mais recente. */
  newRequests: RequestsDigestRow[];
  counts: RequestsDigestCounts;
  /** Nada novo e nenhuma pendente antiga → nada a enviar. */
  isEmpty: boolean;
}

export type RequestsDigestEmailVariables = Record<
  | 'subject'
  | 'digest_date'
  | 'notice_html'
  | 'new_count'
  | 'sc_count'
  | 'sm_count'
  | 'urgent_count'
  | 'older_pending_count'
  | 'new_list_html'
  | 'action_url',
  string
>;

// "Urgente" no resumo = qualquer prioridade acima de standard (priority ou urgent),
// mesma regra do "[URGENTE]" no assunto do e-mail do estoque.
const isUrgent = (row: RequestsDigestRow): boolean => row.priority !== 'standard';

/** Início da janela das "novas" (now − 24h) — o handler usa no filtro da query. */
export const digestWindowStart = (now: Date): Date => new Date(now.getTime() - WINDOW_MS);

export function buildRequestsDailyDigest(rows: RequestsDigestRow[], now: Date): RequestsDailyDigest {
  const nowMs = now.getTime();
  const windowStartMs = digestWindowStart(now).getTime();
  const createdMs = (row: RequestsDigestRow) => new Date(row.created_at).getTime();

  const newRequests = rows
    .filter((row) => createdMs(row) >= windowStartMs && createdMs(row) < nowMs)
    .sort((a, b) => createdMs(a) - createdMs(b));
  const olderPendingCount = rows.filter(
    (row) => row.status === 'pending' && createdMs(row) < windowStartMs,
  ).length;

  const counts: RequestsDigestCounts = {
    newCount: newRequests.length,
    scCount: newRequests.filter((row) => row.type === 'SC').length,
    smCount: newRequests.filter((row) => row.type === 'SM').length,
    urgentCount: newRequests.filter(isUrgent).length,
    olderPendingCount,
  };

  return { newRequests, counts, isEmpty: counts.newCount === 0 && olderPendingCount === 0 };
}

/** dd/mm/aaaa no fuso de Brasília — o cron roda às 20h UTC, mas o dia é o local. */
export const formatDigestDate = (now: Date): string =>
  now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

const URGENT_BADGE =
  '<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:4px;background-color:#fee2e2;color:#b91c1c;font-size:11px;font-weight:600;">URGENTE</span>';

const formatItemsCount = (n: number): string => (n === 1 ? '1 item' : `${n} itens`);

const buildNewListHtml = (newRequests: RequestsDigestRow[]): string => {
  if (newRequests.length === 0) {
    return '<li style="margin:0;color:#6b7280;">Nenhuma solicitação nova nas últimas 24h.</li>';
  }
  return newRequests
    .map((row) => {
      const department = row.department ?? '';
      const details = [
        escapeHtml(row.requested_by ?? ''),
        escapeHtml(DEPARTMENT_LABELS[department] ?? department),
        formatItemsCount(row.items?.length ?? 0),
      ].join(' &middot; ');
      return `<li style="margin:0 0 8px 0;"><strong style="color:#1a1a2e;">${row.type}</strong> &middot; ${details}`
        + (isUrgent(row) ? URGENT_BADGE : '')
        + '</li>';
    })
    .join('');
};

const buildNoticeHtml = (notice: string): string =>
  '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:24px;">'
  + '<tr><td style="background-color:#fef3c7;border-left:4px solid #d97706;border-radius:0 8px 8px 0;padding:12px 16px;'
  + 'font-size:13px;color:#92400e;font-family:\'Segoe UI\',Arial,sans-serif;line-height:1.5;">'
  + `${escapeHtml(notice)}</td></tr></table>`;

/**
 * Variáveis do template `purchase_requests_daily_digest`. `notice` é o aviso
 * opcional no topo (issue 04: "enviado por e-mail porque o WhatsApp falhou").
 */
export function buildRequestsDigestEmailVariables(
  digest: RequestsDailyDigest,
  now: Date,
  actionUrl: string,
  notice?: string,
): RequestsDigestEmailVariables {
  const { counts } = digest;
  const date = formatDigestDate(now);

  return {
    // Assunto vai no header do e-mail (texto puro), por isso sem escape de HTML.
    subject: `[FlowLAB] Resumo de solicitações de ${date}: ${counts.newCount} nova(s), `
      + `${counts.olderPendingCount} pendente(s) antiga(s)`,
    digest_date: date,
    notice_html: notice ? buildNoticeHtml(notice) : '',
    new_count: String(counts.newCount),
    sc_count: String(counts.scCount),
    sm_count: String(counts.smCount),
    urgent_count: String(counts.urgentCount),
    older_pending_count: String(counts.olderPendingCount),
    new_list_html: buildNewListHtml(digest.newRequests),
    action_url: actionUrl,
  };
}
