/**
 * API Route: /api/notifications/[action]
 *
 * Dispatcher (dynamic route) — colapsa as rotas de notificação numa única
 * Serverless Function, para caber no limite do plano Vercel (12 functions no
 * Hobby). O segmento `[action]` do path vira `req.query.action` e seleciona o
 * handler.
 *
 * Cada handler vive em api/_lib/handlers/ — o prefixo `_` faz o Vercel NÃO
 * contá-los como functions. Autorização, parsing e validação seguem dentro de
 * cada handler: `email` é público (contrato histórico, usado por scripts
 * externos), `request-created` e `payment-request` exigem a sessão do usuário e
 * `requests-digest-cron` (Vercel Cron) exige o CRON_SECRET. `sc-rejected` exige
 * a sessão de quem rejeitou; `sc-awaiting-approval` é chamada pelo banco
 * (pg_net) com o CRON_SECRET.
 *
 * Espelha api/umami/[action].ts.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import notificationsEmail from '../_lib/handlers/notifications-email.js';
import notificationsRequestCreated from '../_lib/handlers/notifications-request-created.js';
import notificationsPaymentRequest from '../_lib/handlers/notifications-payment-request.js';
import notificationsRequestsDigestCron from '../_lib/handlers/notifications-requests-digest-cron.js';
import notificationsScAwaitingApproval from '../_lib/handlers/notifications-sc-awaiting-approval.js';
import notificationsScRejected from '../_lib/handlers/notifications-sc-rejected.js';

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

// Chave = segmento do path.
const ROTAS: Record<string, Handler> = {
  email: notificationsEmail,
  'request-created': notificationsRequestCreated,
  'payment-request': notificationsPaymentRequest,
  'requests-digest-cron': notificationsRequestsDigestCron,
  'sc-awaiting-approval': notificationsScAwaitingApproval,
  'sc-rejected': notificationsScRejected,
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const raw = req.query.action;
  const action = Array.isArray(raw) ? raw[0] : raw;
  const rota = action ? ROTAS[action] : undefined;

  if (!rota) {
    res.status(404).json({ success: false, error: 'Rota não encontrada.' });
    return;
  }

  await rota(req, res);
}
