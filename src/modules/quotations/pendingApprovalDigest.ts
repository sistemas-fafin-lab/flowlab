import type { EmailNotificationRequest } from './notifications';
import { QuotationType, QuotationTypeLabels, SupplierProposal } from './types';
import { formatCurrency } from '../../utils/paymentUtils';
import { getQuotationAmountFromRow } from './utils/getQuotationAmountFromRow';
import { escapeHtml } from './utils/escapeHtml';
import { buildProposalsListHtml } from './utils/emailListsHtml';
import { proposalStatusFromRow } from './utils/proposalStatusFromRow';

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
  selected_proposal_id?: string | null;
  quotation_proposals?: PendingApprovalProposalRow[] | null;
}

/** Linha de `quotation_proposals` (snake_case) — só o que o resumo mostra. */
export interface PendingApprovalProposalRow {
  id: string;
  supplier_name: string;
  total_amount: number;
  status: string | null;
  is_winner: boolean | null;
}

// Só o que o builder compartilhado lê; o resto do SupplierProposal fica vazio.
const toSupplierProposal = (row: PendingApprovalProposalRow): SupplierProposal => ({
  id: row.id,
  quotationId: '',
  supplierId: '',
  supplierName: row.supplier_name,
  status: proposalStatusFromRow(row),
  items: [],
  totalAmount: Number(row.total_amount),
  deliveryTime: '',
  createdAt: '',
  updatedAt: '',
});

const buildQuotationProposalsHtml = (quotation: PendingApprovalQuotationRow): string => {
  const proposalsHtml = buildProposalsListHtml({
    proposals: (quotation.quotation_proposals ?? []).map(toSupplierProposal),
    selectedProposalId: quotation.selected_proposal_id ?? undefined,
  });
  return proposalsHtml
    ? `<ul style="margin:4px 0 8px 0;padding-left:18px;font-size:13px;line-height:1.6;">${proposalsHtml}</ul>`
    : '';
};

const buildPendingListHtml = (quotations: PendingApprovalQuotationRow[]): string =>
  quotations
    .map((quotation) => {
      const amount = getQuotationAmountFromRow(quotation);
      return `<li><strong>${escapeHtml(quotation.code)}</strong> &mdash; ${escapeHtml(quotation.title)} `
        + `(${QuotationTypeLabels[quotation.quotation_type]}, solicitado por ${escapeHtml(quotation.created_by_name)}) `
        + `&mdash; ${formatCurrency(amount)}${buildQuotationProposalsHtml(quotation)}</li>`;
    })
    .join('');

/**
 * Monta uma notificação-resumo por gestor com alçada, cada uma listando só
 * as cotações que ainda estão "aguardando aprovação" dentro da alçada dele —
 * cada cotação com todas as suas propostas e a vencedora destacada (mesmo
 * builder do email de submissão).
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
