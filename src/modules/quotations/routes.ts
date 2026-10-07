import { QuotationStatus } from './types';

/**
 * Contrato de URL da lista de cotações filtrada por status, reaproveitável
 * por qualquer ponto de entrada (card da Home, e-mails de notificação etc).
 */
export const QUOTATIONS_PATH = '/quotations';
export const QUOTATIONS_STATUS_QUERY_PARAM = 'status';

export const buildQuotationsUrl = (
  baseUrl: string,
  status?: QuotationStatus,
): string => {
  if (!status) return `${baseUrl}${QUOTATIONS_PATH}`;
  return `${baseUrl}${QUOTATIONS_PATH}?${QUOTATIONS_STATUS_QUERY_PARAM}=${status}`;
};

/**
 * Tela "Minhas aprovações de cotação": as cotações na etapa do gestor em que
 * o usuário logado é o gestor do pedido. Aberta a qualquer usuário logado
 * (sem canManageQuotations) — ponto de entrada do card da Home e do e-mail
 * da etapa do gestor.
 */
export const QUOTATIONS_MANAGER_APPROVALS_PATH = `${QUOTATIONS_PATH}/aprovacoes`;

export const buildQuotationManagerApprovalsUrl = (baseUrl: string): string =>
  `${baseUrl}${QUOTATIONS_MANAGER_APPROVALS_PATH}`;
