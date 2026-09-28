// api/_lib/requestCreatedEmail.ts
// Variáveis do e-mail `purchase_request_created`, enviado ao estoque a cada SC/SM
// nova (api/_lib/handlers/notifications-request-created.ts). Função pura — o
// handler lê a solicitação e o estoque atual no Supabase e só repassa aqui.

import { escapeHtml } from './html.js';

export interface RequestCreatedItem {
  productId: string | null;
  productName: string;
  quantity: number;
}

/** Linha de `requests` (snake_case), só com as colunas usadas no e-mail. */
export interface RequestCreatedRow {
  type: 'SC' | 'SM';
  items: RequestCreatedItem[];
  reason: string | null;
  priority: 'standard' | 'priority' | 'urgent';
  requested_by: string | null;
  request_date: string | null;
  department: string | null;
  supplier_name: string | null;
}

export type RequestCreatedEmailVariables = Record<
  | 'subject'
  | 'request_type_label'
  | 'requester_name'
  | 'department'
  | 'priority_label'
  | 'request_date'
  | 'reason_html'
  | 'supplier_row_html'
  | 'items_list_html'
  | 'out_of_stock_count'
  | 'action_url',
  string
>;

const TYPE_LABELS: Record<RequestCreatedRow['type'], string> = {
  SC: 'Solicitação de Compra (SC)',
  SM: 'Solicitação de Material (SM)',
};

// Mesmos rótulos de RequestManagement.tsx.
const PRIORITY_LABELS: Record<RequestCreatedRow['priority'], string> = {
  standard: 'Padrão',
  priority: 'Prioritário',
  urgent: 'Urgente',
};

// Espelha DepartmentLabels (src/types/index.ts) — `requests.department` guarda o
// código do departamento do solicitante; valores fora do mapa saem como estão.
export const DEPARTMENT_LABELS: Record<string, string> = {
  TRANSPORTE: 'Transporte',
  ESTOQUE: 'Estoque',
  FINANCEIRO: 'Financeiro',
  FATURAMENTO: 'Faturamento',
  AREA_TECNICA: 'Área técnica',
  RH: 'RH',
  COMERCIAL: 'Comercial',
  TI: 'TI',
  MARKETING: 'Marketing',
  QUALIDADE: 'Qualidade',
  COPA_LIMPEZA: 'Copa/Limpeza',
  ATENDIMENTO: 'Atendimento',
  DIRETORIA: 'Diretoria',
  BIOLOGIA_MOLECULAR: 'Biologia Molecular',
  EQUIPE_MEDICA: 'Equipe Médica',
};

const OUT_OF_STOCK_BADGE =
  '<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:4px;background-color:#fee2e2;color:#b91c1c;font-size:11px;font-weight:600;">sem estoque</span>';

/** Sem produto cadastrado, produto não encontrado ou saldo ≤ 0 em `products.quantity`. */
const isOutOfStock = (item: RequestCreatedItem, stockByProductId: Record<string, number>): boolean =>
  item.productId === null || (stockByProductId[item.productId] ?? 0) <= 0;

const formatDateBR = (isoDate: string | null): string => {
  const match = isoDate?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
};

const buildItemsListHtml = (
  items: RequestCreatedItem[],
  stockByProductId: Record<string, number>,
): string =>
  items
    .map(
      (item) =>
        `<li style="margin:0 0 8px 0;"><strong style="color:#1a1a2e;">${escapeHtml(item.productName)}</strong>`
        + (isOutOfStock(item, stockByProductId) ? OUT_OF_STOCK_BADGE : '')
        + `<br /><span style="font-size:13px;color:#6b7280;">Quantidade: ${item.quantity}</span></li>`,
    )
    .join('');

const buildSupplierRowHtml = (row: RequestCreatedRow): string => {
  const supplier = row.supplier_name?.trim();
  if (row.type !== 'SC' || !supplier) return '';
  return '<tr><td style="padding:4px 0;color:#6b7280;width:140px;">Fornecedor</td>'
    + `<td style="padding:4px 0;color:#1a1a2e;font-weight:600;">${escapeHtml(supplier)}</td></tr>`;
};

export function buildRequestCreatedEmailVariables(
  row: RequestCreatedRow,
  stockByProductId: Record<string, number>,
  actionUrl: string,
): RequestCreatedEmailVariables {
  const typeLabel = TYPE_LABELS[row.type];
  const requester = row.requested_by ?? '';
  const department = row.department ?? '';
  const items = row.items ?? [];

  // Assunto vai no header do e-mail (texto puro), por isso sem escape de HTML.
  const nonStandardPriorityPrefix = row.priority !== 'standard' ? '[URGENTE] ' : '';

  return {
    subject: `${nonStandardPriorityPrefix}[FlowLAB] Nova ${typeLabel} de ${requester}`,
    request_type_label: typeLabel,
    requester_name: escapeHtml(requester),
    department: escapeHtml(DEPARTMENT_LABELS[department] ?? department),
    priority_label: PRIORITY_LABELS[row.priority] ?? row.priority,
    request_date: formatDateBR(row.request_date),
    reason_html: escapeHtml(row.reason ?? '').replace(/\n/g, '<br />'),
    supplier_row_html: buildSupplierRowHtml(row),
    items_list_html: buildItemsListHtml(items, stockByProductId),
    out_of_stock_count: String(items.filter((item) => isOutOfStock(item, stockByProductId)).length),
    action_url: actionUrl,
  };
}

/** `REQUESTS_STOCK_ALERT_TO` aceita mais de um endereço separado por vírgula. */
export const parseRecipientList = (raw: string | undefined): string[] =>
  (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
