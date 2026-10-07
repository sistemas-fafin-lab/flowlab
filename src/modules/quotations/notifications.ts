import { Quotation, QuotationItem, QuotationTypeLabels } from './types';
import { formatCurrency } from '../../utils/paymentUtils';
import { APP_BASE_URL } from '../../utils/appUrl';
import { getQuotationAmount } from './utils/getQuotationAmount';
import { escapeHtml } from './utils/escapeHtml';
import { buildQuotationManagerApprovalsUrl, buildQuotationsUrl } from './routes';
import { buildItemsListHtml, buildProposalsListHtml } from './utils/emailListsHtml';

export interface ApproverWithEmail {
  user_email: string | null;
}

export interface EmailNotificationRequest {
  to: string;
  templateSlug: string;
  variables: Record<string, string>;
}

type QuotationForApprovalEmail = Pick<
  Quotation,
  'code' | 'title' | 'quotationType' | 'createdByName' | 'finalTotalAmount' | 'estimatedTotalAmount' | 'proposals' | 'selectedProposalId'
> & { items: Pick<QuotationItem, 'productName' | 'quantity' | 'unit'>[] };

/**
 * Variáveis comuns aos emails de aprovação (etapa do gestor e alçada): o
 * mesmo conteúdo nas duas etapas, só o link muda.
 */
function buildApprovalEmailVariables(quotation: QuotationForApprovalEmail, actionUrl: string): Record<string, string> {
  return {
    quotation_code: escapeHtml(quotation.code),
    quotation_title: escapeHtml(quotation.title),
    quotation_type_label: QuotationTypeLabels[quotation.quotationType],
    requester_name: escapeHtml(quotation.createdByName),
    total_amount: formatCurrency(getQuotationAmount(quotation)),
    action_url: actionUrl,
    proposals_list_html: buildProposalsListHtml(quotation),
    items_list_html: buildItemsListHtml(quotation.items),
  };
}

/**
 * Monta as requisições de email de "cotação aguardando aprovação" para cada
 * gestor com alçada suficiente, ignorando aprovadores sem email cadastrado.
 */
export function buildQuotationApprovalNotifications(
  quotation: QuotationForApprovalEmail,
  approvers: ApproverWithEmail[],
): EmailNotificationRequest[] {
  const variables = buildApprovalEmailVariables(quotation, buildQuotationsUrl(APP_BASE_URL, 'awaiting_approval'));

  return approvers
    .filter((approver): approver is { user_email: string } => Boolean(approver.user_email))
    .map((approver) => ({
      to: approver.user_email,
      templateSlug: 'quotation_awaiting_approval',
      variables,
    }));
}

/**
 * Monta o email da etapa do gestor do pedido — enviado quando a cotação entra
 * em awaiting_manager_approval e quando o gestor é trocado nessa etapa. Null
 * quando o gestor não tem email cadastrado.
 */
export function buildManagerApprovalNotification(
  quotation: QuotationForApprovalEmail,
  manager: ApproverWithEmail,
): EmailNotificationRequest | null {
  if (!manager.user_email) return null;

  return {
    to: manager.user_email,
    templateSlug: 'quotation_awaiting_manager_approval',
    variables: buildApprovalEmailVariables(quotation, buildQuotationManagerApprovalsUrl(APP_BASE_URL)),
  };
}

export interface ManagerRejection {
  rejectedByName: string;
  comment: string;
}

/**
 * Monta o email de rejeição na etapa do gestor — enviado ao comprador (quem
 * criou a cotação) quando o gestor do pedido, ou um admin no lugar dele,
 * rejeita e a cotação volta para "Em análise". Null quando o comprador não
 * tem email cadastrado.
 */
export function buildManagerRejectionNotification(
  quotation: Pick<Quotation, 'code' | 'title'>,
  buyer: ApproverWithEmail,
  rejection: ManagerRejection,
): EmailNotificationRequest | null {
  if (!buyer.user_email) return null;

  return {
    to: buyer.user_email,
    templateSlug: 'quotation_manager_rejected',
    variables: {
      quotation_code: escapeHtml(quotation.code),
      quotation_title: escapeHtml(quotation.title),
      rejected_by_name: escapeHtml(rejection.rejectedByName),
      rejection_comment: escapeHtml(rejection.comment),
      action_url: buildQuotationsUrl(APP_BASE_URL, 'under_review'),
    },
  };
}
