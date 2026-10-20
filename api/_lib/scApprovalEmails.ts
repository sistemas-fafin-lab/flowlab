// api/_lib/scApprovalEmails.ts
// E-mails da aprovação da SC (.scratch/solicitacoes-aprovacao-gestor, issue 04):
//   • `purchase_request_awaiting_approval` → ao aprovador, quando a SC recebe
//     approver_id (api/_lib/handlers/notifications-sc-awaiting-approval.ts);
//   • `purchase_request_rejected` → a quem pediu, com o motivo
//     (api/_lib/handlers/notifications-sc-rejected.ts).
// Funções puras: os handlers leem SC e pessoas no Supabase e só repassam aqui.
// Sem e-mail válido do destinatário, devolvem null (não envia).

import { escapeHtml } from './html.js';
import { isValidEmail } from './email.js';
import { buildRequestsAwaitingMyApprovalUrl, buildRequestsUrl } from './requestsRoutes.js';
import {
  DEPARTMENT_LABELS,
  PRIORITY_LABELS,
  formatDateBR,
  type RequestCreatedRow,
} from './requestCreatedEmail.js';

/** Linha de `requests` (snake_case), só com as colunas usadas nos e-mails. */
export interface ScEmailRow
  extends Pick<RequestCreatedRow, 'items' | 'reason' | 'priority' | 'requested_by' | 'request_date' | 'department'> {
  id: string;
  rejection_comment: string | null;
}

export interface ScEmailPerson {
  name: string | null;
  email: string | null;
}

export interface ScEmail {
  to: string;
  variables: Record<string, string>;
}

const multilineHtml = (text: string | null): string => escapeHtml(text ?? '').replace(/\n/g, '<br />');

const commonVariables = (row: ScEmailRow): Record<string, string> => {
  const department = row.department ?? '';
  return {
    request_id: escapeHtml(row.id),
    requester_name: escapeHtml(row.requested_by ?? ''),
    department: escapeHtml(DEPARTMENT_LABELS[department] ?? department),
    priority_label: PRIORITY_LABELS[row.priority] ?? row.priority,
    request_date: formatDateBR(row.request_date),
    reason_html: multilineHtml(row.reason),
    items_list_html: (row.items ?? [])
      .map(
        (item) =>
          `<li style="margin:0 0 8px 0;"><strong style="color:#1a1a2e;">${escapeHtml(item.productName)}</strong>`
          + `<br /><span style="font-size:13px;color:#6b7280;">Quantidade: ${item.quantity}</span></li>`,
      )
      .join(''),
  };
};

const recipient = (person: ScEmailPerson | null): string | null => {
  const email = person?.email?.trim() ?? '';
  return isValidEmail(email) ? email : null;
};

export function buildScAwaitingApprovalEmail(
  row: ScEmailRow,
  approver: ScEmailPerson | null,
  baseUrl: string,
): ScEmail | null {
  const to = recipient(approver);
  if (!to) return null;

  return {
    to,
    variables: {
      // Assunto vai no header do e-mail (texto puro), por isso sem escape de HTML.
      subject: `[FlowLAB] SC ${row.id} de ${row.requested_by ?? ''} aguarda sua aprovação`,
      approver_name: escapeHtml(approver?.name ?? ''),
      ...commonVariables(row),
      action_url: buildRequestsAwaitingMyApprovalUrl(baseUrl),
    },
  };
}

export function buildScRejectedEmail(
  row: ScEmailRow,
  requester: ScEmailPerson | null,
  rejectedBy: ScEmailPerson | null,
  baseUrl: string,
): ScEmail | null {
  const to = recipient(requester);
  if (!to) return null;

  return {
    to,
    variables: {
      subject: `[FlowLAB] Sua SC ${row.id} foi rejeitada`,
      rejected_by_name: escapeHtml(rejectedBy?.name ?? ''),
      rejection_comment_html: multilineHtml(row.rejection_comment),
      ...commonVariables(row),
      action_url: buildRequestsUrl(baseUrl, 'rejected'),
    },
  };
}
