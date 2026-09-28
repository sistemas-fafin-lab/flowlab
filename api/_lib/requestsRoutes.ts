// api/_lib/requestsRoutes.ts
// Contrato de URL da lista de solicitações (SC/SM) filtrada por status,
// reaproveitável pelo SPA (RequestManagement.tsx) e pelos e-mails disparados
// server-side. Espelha src/modules/quotations/routes.ts. Fica em api/_lib, sem
// dependências, para ser importável dos dois lados (o Vite resolve o `.js`).

export const REQUESTS_PURCHASES_PATH = '/requests/purchases';
export const REQUESTS_STATUS_QUERY_PARAM = 'status';

/** Fonte única dos status de solicitação — `Request['status']` (src/types) deriva daqui. */
export const REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'completed'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const buildRequestsUrl = (baseUrl: string, status?: RequestStatus): string => {
  if (!status) return `${baseUrl}${REQUESTS_PURCHASES_PATH}`;
  return `${baseUrl}${REQUESTS_PURCHASES_PATH}?${REQUESTS_STATUS_QUERY_PARAM}=${status}`;
};

/** Valor de `?status=` → status conhecido, ou `null` (ausente ou inválido). */
export const parseRequestStatusParam = (value: string | null): RequestStatus | null =>
  (REQUEST_STATUSES as readonly string[]).includes(value ?? '') ? (value as RequestStatus) : null;
