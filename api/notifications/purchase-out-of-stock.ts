/**
 * API Route: POST /api/notifications/purchase-out-of-stock
 *
 * Vercel Serverless Function — Alerta por email quando uma solicitação de
 * compra (SC) inclui produto não cadastrado no estoque. Disparado pelo client
 * (RequestManagement.tsx) logo após a criação da SC, sem bloquear o fluxo do
 * usuário caso o envio falhe.
 *
 * O destinatário fica só no servidor (nunca é enviado pelo client), ao
 * contrário de /api/notifications/email — mesmo padrão de
 * api/cron/umami-inatividade.ts.
 *
 * Variáveis de ambiente necessárias:
 *   PURCHASE_ALERT_TO        → email de destino do alerta
 *   SMTP_*, SUPABASE_*       → já usadas por api/_lib/email.ts
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendTemplatedEmail } from '../_lib/email.js';
import { escapeHtml } from '../_lib/html.js';

const TEMPLATE_SLUG = 'purchase_request_out_of_stock';

interface OutOfStockItem {
  productName: string;
  quantity: number;
}

interface RequestBody {
  requesterName: string;
  requestDate: string;
  reason: string;
  items: OutOfStockItem[];
}

function buildItemsListHtml(items: OutOfStockItem[]): string {
  return items
    .map(
      (item) =>
        `<li style="margin:0 0 8px 0;"><strong style="color:#1a1a2e;">${escapeHtml(item.productName)}</strong><br /><span style="font-size:13px;color:#6b7280;">Quantidade solicitada: ${item.quantity}</span></li>`,
    )
    .join('');
}

/**
 * Mesma sintaxe leve usada em RequestManagement.tsx (renderFormattedText):
 * **negrito**, *itálico* e quebra de linha. Aplicada sobre o texto já
 * escapado, para preservar a formatação sem reabrir injeção de HTML.
 */
function buildReasonHtml(reason: string): string {
  return escapeHtml(reason)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br />');
}

function isValidItem(item: unknown): item is OutOfStockItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as OutOfStockItem).productName === 'string' &&
    (item as OutOfStockItem).productName.trim().length > 0 &&
    Number.isFinite((item as OutOfStockItem).quantity) &&
    (item as OutOfStockItem).quantity > 0
  );
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  const to = process.env.PURCHASE_ALERT_TO;
  if (!to) {
    console.error('[notifications/purchase-out-of-stock] PURCHASE_ALERT_TO não configurada');
    res.status(500).json({ success: false, error: 'Destinatário do alerta (PURCHASE_ALERT_TO) não configurado.' });
    return;
  }

  const { requesterName, requestDate, reason, items } = (req.body ?? {}) as Partial<RequestBody>;

  if (
    !requesterName ||
    !requestDate ||
    !reason?.trim() ||
    !Array.isArray(items) ||
    items.length === 0 ||
    !items.every(isValidItem)
  ) {
    res.status(400).json({
      success: false,
      error: 'Campos obrigatórios ausentes ou inválidos: requesterName, requestDate, reason, items (não vazio)',
    });
    return;
  }

  const requestDateBR = new Date(`${requestDate}T00:00:00`).toLocaleDateString('pt-BR');

  const result = await sendTemplatedEmail({
    to,
    templateSlug: TEMPLATE_SLUG,
    variables: {
      requester_name: escapeHtml(requesterName),
      request_date: requestDateBR,
      reason: buildReasonHtml(reason),
      items_list: buildItemsListHtml(items),
    },
  });

  if (result.success) {
    res.status(200).json({ success: true, messageId: result.messageId });
    return;
  }

  const status =
    result.errorCode === 'invalid_email' ? 400 :
    result.errorCode === 'template_not_found' ? 404 : 500;

  res.status(status).json({ success: false, error: result.error });
}
