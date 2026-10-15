/**
 * API Route: /api/ti/[action]
 *
 * Dispatcher da EVA, o agente de TI (docs/plans/agente-ti) — uma Serverless Function
 * só, para caber no limite do plano Vercel (12 no Hobby). O segmento `[action]` vira
 * `req.query.action` e escolhe o handler em api/_lib/handlers/ti-*.ts.
 *
 * Autorização dentro de cada handler: os crons exigem CRON_SECRET; as ações da tela
 * exigem a sessão do usuário com canManageIT ou um dos papéis da EVA (D31); o webhook do WAHA
 * exige o token secreto na URL (WAHA_WEBHOOK_SECRET).
 *
 * Espelha api/notifications/[action].ts.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import agenteSyncCron from '../_lib/handlers/ti-agente-sync-cron.js';
import agenteSincronizar from '../_lib/handlers/ti-agente-sincronizar.js';
import agenteAnalisar from '../_lib/handlers/ti-agente-analisar.js';
import agentePerguntar from '../_lib/handlers/ti-agente-perguntar.js';
import agenteCobrancaCron from '../_lib/handlers/ti-agente-cobranca-cron.js';
import agenteAvisar from '../_lib/handlers/ti-agente-avisar.js';
import agenteCobrar from '../_lib/handlers/ti-agente-cobrar.js';
import agenteFechamentoCron from '../_lib/handlers/ti-agente-fechamento-cron.js';
import agenteTeste from '../_lib/handlers/ti-agente-teste.js';
import wahaWebhook from '../_lib/handlers/ti-waha-webhook.js';

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

// Chave = segmento do path.
const ROTAS: Record<string, Handler> = {
  'agente-sync-cron': agenteSyncCron,
  'agente-sincronizar': agenteSincronizar,
  'agente-analisar': agenteAnalisar,
  'agente-perguntar': agentePerguntar,
  'agente-cobranca-cron': agenteCobrancaCron,
  'agente-cobrar': agenteCobrar,
  'agente-avisar': agenteAvisar,
  'agente-fechamento-cron': agenteFechamentoCron,
  'agente-teste': agenteTeste,
  'waha-webhook': wahaWebhook,
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
