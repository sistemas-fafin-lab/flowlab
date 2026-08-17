import { Quotation, QuotationItem, QuotationTypeLabels } from './types';
import { formatCurrency } from '../../utils/paymentUtils';
import { APP_BASE_URL } from '../../utils/appUrl';

export interface ApproverWithEmail {
  user_email: string | null;
}

export interface EmailNotificationRequest {
  to: string;
  templateSlug: string;
  variables: Record<string, string>;
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] as string));

const buildItemsListHtml = (items: Pick<QuotationItem, 'productName' | 'quantity' | 'unit'>[]): string =>
  items
    .map((item) => `<li>${escapeHtml(String(item.quantity))} ${escapeHtml(item.unit)} &mdash; ${escapeHtml(item.productName)}</li>`)
    .join('');

/**
 * Monta as requisições de email de "cotação aguardando aprovação" para cada
 * gestor com alçada suficiente, ignorando aprovadores sem email cadastrado.
 */
export function buildQuotationApprovalNotifications(
  quotation: Pick<
    Quotation,
    'code' | 'title' | 'quotationType' | 'createdByName' | 'finalTotalAmount' | 'estimatedTotalAmount' | 'selectedSupplierName'
  > & { items: Pick<QuotationItem, 'productName' | 'quantity' | 'unit'>[] },
  approvers: ApproverWithEmail[],
): EmailNotificationRequest[] {
  const amount = quotation.finalTotalAmount || quotation.estimatedTotalAmount;
  const variables = {
    quotation_code: quotation.code,
    quotation_title: quotation.title,
    quotation_type_label: QuotationTypeLabels[quotation.quotationType],
    requester_name: quotation.createdByName,
    total_amount: formatCurrency(amount),
    action_url: `${APP_BASE_URL}/quotations`,
    supplier_name: quotation.selectedSupplierName || 'Não informado',
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
