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
