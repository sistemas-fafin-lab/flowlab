/**
 * API Route: /api/atendimento/[action]
 *
 * Dispatcher (dynamic route) da área Atendimento — mesmo padrão de
 * api/faturamento/[action].ts: uma única Serverless Function para o módulo,
 * para caber no limite do plano Vercel (12 no Hobby). Hoje só o Gerador de
 * Orçamento; a leitura do pedido médico por IA (fase 2) entra aqui como mais
 * uma action, sem custar function nova. Autorização/parsing/validação ficam
 * dentro de cada handler (este dispatcher NÃO autoriza nada).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import geradorOrcamentoPrecos from '../_lib/handlers/atendimento-gerador-orcamento-precos.js';

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

const ROTAS: Record<string, Handler> = {
  'gerador-orcamento-precos': geradorOrcamentoPrecos,
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
