/**
 * API Route: /api/umami/[action]
 *
 * Dispatcher (dynamic route) — colapsa as rotas de umami (dashboard consumido pelo SPA
 * + cron de alerta de inatividade) numa única Serverless Function, para caber no limite
 * do plano Vercel (12 functions no Hobby). O segmento `[action]` do path vira
 * `req.query.action` e seleciona o handler.
 *
 * Cada handler vive em api/_lib/handlers/ — o prefixo `_` faz o Vercel NÃO contá-los
 * como functions. Autorização, parsing e validação seguem dentro de cada handler —
 * repare que dashboard e inatividade-cron usam modelos de auth DIFERENTES (sessão de
 * usuário vs. CRON_SECRET), cada um checado só dentro do seu próprio handler.
 *
 * Espelha api/faturamento/[action].ts.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import umamiDashboard from '../_lib/handlers/umami-dashboard.js';
import umamiInatividadeCron from '../_lib/handlers/umami-inatividade-cron.js';

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

// Chave = segmento do path.
const ROTAS: Record<string, Handler> = {
  dashboard: umamiDashboard,
  'inatividade-cron': umamiInatividadeCron,
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
