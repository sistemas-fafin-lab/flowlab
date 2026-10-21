/**
 * API Route: /api/integracoes/[action]
 *
 * Dispatcher (dynamic route) — colapsa as rotas de integração server-to-server
 * (orcamento-particular, tuss-exames) numa única Serverless Function, para caber
 * no limite do plano Vercel (12 functions no Hobby). O segmento `[action]` do path
 * vira `req.query.action` e seleciona o handler.
 *
 * Cada handler vive em api/_lib/handlers/ — o prefixo `_` faz o Vercel NÃO contá-los
 * como functions. Autorização segue dentro de cada handler — cada integração tem sua
 * própria chave dedicada (TABELA_PARTICULAR_API_KEY vs. ADMISSAO_API_KEY).
 *
 * Espelha api/umami/[action].ts.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import integracoesOrcamentoParticular from '../_lib/handlers/integracoes-orcamento-particular.js';
import integracoesTussExames from '../_lib/handlers/integracoes-tuss-exames.js';

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

// Chave = segmento do path.
const ROTAS: Record<string, Handler> = {
  'orcamento-particular': integracoesOrcamentoParticular,
  'tuss-exames': integracoesTussExames,
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
