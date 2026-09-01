import { Quotation, QuotationItem, QuotationTypeLabels } from './types';
import { formatCurrency } from '../../utils/paymentUtils';
import { APP_BASE_URL } from '../../utils/appUrl';
import { getQuotationAmount } from './utils/getQuotationAmount';
import { buildQuotationsUrl } from './routes';

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
  const amount = getQuotationAmount(quotation);
  const variables = {
    quotation_code: escapeHtml(quotation.code),
    quotation_title: escapeHtml(quotation.title),
    quotation_type_label: QuotationTypeLabels[quotation.quotationType],
    requester_name: escapeHtml(quotation.createdByName),
    total_amount: formatCurrency(amount),
    action_url: buildQuotationsUrl(APP_BASE_URL, 'awaiting_approval'),
    supplier_name: escapeHtml(quotation.selectedSupplierName || 'Não informado'),
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
