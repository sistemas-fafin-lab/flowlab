import type { EmailNotificationRequest } from './notifications';
import { QuotationType, QuotationTypeLabels } from './types';
import { formatCurrency } from '../../utils/paymentUtils';
import { getQuotationAmountFromRow } from './utils/getQuotationAmountFromRow';
import { escapeHtml } from './utils/escapeHtml';

export interface PendingApprovalDigestApprover {
  user_email: string | null;
  effective_max_amount: number;
}

/** Linha de `quotations` (snake_case) — mesmo shape aceito por `getQuotationAmountFromRow`. */
export interface PendingApprovalQuotationRow {
  code: string;
  title: string;
  quotation_type: QuotationType;
  created_by_name: string;
  selected_price?: number | null;
  final_total_amount?: number | null;
  estimated_total?: number | null;
}

const buildPendingListHtml = (quotations: PendingApprovalQuotationRow[]): string =>
  quotations
    .map((quotation) => {
      const amount = getQuotationAmountFromRow(quotation);
      return `<li><strong>${escapeHtml(quotation.code)}</strong> &mdash; ${escapeHtml(quotation.title)} `
        + `(${QuotationTypeLabels[quotation.quotation_type]}, solicitado por ${escapeHtml(quotation.created_by_name)}) `
        + `&mdash; ${formatCurrency(amount)}</li>`;
    })
    .join('');

/**
 * Monta uma notificação-resumo por gestor com alçada, cada uma listando só
 * as cotações que ainda estão "aguardando aprovação" dentro da alçada dele.
 * Gestor sem nenhuma cotação elegível (ou sem email cadastrado) não gera
 * notificação — mesmo critério de valor (gestor × alçada × valor) e mesma
 * regra de "valor real" (`getQuotationAmountFromRow`) usadas hoje pela
 * notificação de submissão e pela decisão de aprovação/rejeição no servidor.
 */
export function buildPendingApprovalDigestNotifications(
  pendingQuotations: PendingApprovalQuotationRow[],
  approvers: PendingApprovalDigestApprover[],
  actionUrl: string,
): EmailNotificationRequest[] {
  return approvers
    .filter((approver): approver is PendingApprovalDigestApprover & { user_email: string } =>
      Boolean(approver.user_email))
    .flatMap((approver) => {
      const eligibleQuotations = pendingQuotations.filter(
        (quotation) => getQuotationAmountFromRow(quotation) <= approver.effective_max_amount,
      );

      if (eligibleQuotations.length === 0) return [];

      return [{
        to: approver.user_email,
        templateSlug: 'quotation_pending_approval_digest',
        variables: {
          pending_count: String(eligibleQuotations.length),
          pending_list_html: buildPendingListHtml(eligibleQuotations),
          action_url: actionUrl,
        },
      }];
    });
}
