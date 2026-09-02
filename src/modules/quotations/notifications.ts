import { Quotation, QuotationItem, QuotationTypeLabels } from './types';
import { formatCurrency } from '../../utils/paymentUtils';
import { APP_BASE_URL } from '../../utils/appUrl';
import { getQuotationAmount } from './utils/getQuotationAmount';
import { escapeHtml } from './utils/escapeHtml';
import { buildQuotationsUrl } from './routes';
import { annotateProposals, AnnotateProposalsOptions } from './utils/annotateProposals';

export interface ApproverWithEmail {
  user_email: string | null;
}

export interface EmailNotificationRequest {
  to: string;
  templateSlug: string;
  variables: Record<string, string>;
}

const buildItemsListHtml = (items: Pick<QuotationItem, 'productName' | 'quantity' | 'unit'>[]): string =>
  items
    .map((item) => `<li>${escapeHtml(String(item.quantity))} ${escapeHtml(item.unit)} &mdash; ${escapeHtml(item.productName)}</li>`)
    .join('');

/**
 * Lista todas as propostas recebidas, destacando a vencedora atual — reaproveita
 * annotateProposals (mesma regra usada no modal de aprovação) em vez de duplicar
 * "quem venceu".
 */
const buildProposalsListHtml = (quotation: Parameters<typeof annotateProposals>[0], options?: AnnotateProposalsOptions): string =>
  annotateProposals(quotation, { includeRejected: true, ...options })
    .map((proposal) => {
      const isWinner = proposal.proposalId === quotation.selectedProposalId;
      const label = `${escapeHtml(proposal.supplierName)} &mdash; ${formatCurrency(proposal.totalAmount)}`;
      return isWinner
        ? `<li style="margin-bottom:4px;"><strong>${label}</strong> `
          + '<span style="display:inline-block;padding:1px 8px;font-size:10px;font-weight:700;color:#047857;'
          + 'background-color:#d1fae5;border-radius:9999px;letter-spacing:0.3px;">VENCEDORA</span></li>'
        : `<li style="margin-bottom:4px;">${label}</li>`;
    })
    .join('');

/**
 * Monta as requisições de email de "cotação aguardando aprovação" para cada
 * gestor com alçada suficiente, ignorando aprovadores sem email cadastrado.
 */
export function buildQuotationApprovalNotifications(
  quotation: Pick<
    Quotation,
    'code' | 'title' | 'quotationType' | 'createdByName' | 'finalTotalAmount' | 'estimatedTotalAmount' | 'proposals' | 'selectedProposalId'
  > & { items: Pick<QuotationItem, 'productName' | 'quantity' | 'unit'>[] },
  approvers: ApproverWithEmail[],
): EmailNotificationRequest[] {
  const amount = getQuotationAmount(quotation);
  const variables = {
    quotation_code: escapeHtml(quotation.code),
    quotation_title: escapeHtml(quotation.title),
    quotation_type_label: QuotationTypeLabels[quotation.quotationType],
    requester_name: escapeHtml(quotation.createdByName),
    total_amount: formatCurrency(amount),
    action_url: buildQuotationsUrl(APP_BASE_URL, 'awaiting_approval'),
    proposals_list_html: buildProposalsListHtml(quotation),
    items_list_html: buildItemsListHtml(quotation.items),
  };

  return approvers
    .filter((approver): approver is { user_email: string } => Boolean(approver.user_email))
    .map((approver) => ({
      to: approver.user_email,
      templateSlug: 'quotation_awaiting_approval',
      variables,
    }));
}
