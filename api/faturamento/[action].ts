/**
 * API Route: /api/faturamento/[action]
 *
 * Dispatcher (dynamic route) — colapsa as rotas de faturamento numa única Serverless
 * Function, para caber no limite do plano Vercel (12 functions no Hobby). O segmento
 * `[action]` do path vira `req.query.action` e seleciona o handler, então as URLs
 * públicas ficam idênticas (ex.: /api/faturamento/lotes) e novas actions não custam
 * function nova.
 *
 * Cada handler vive em api/_lib/handlers/ — o prefixo `_` faz o Vercel NÃO contá-los
 * como functions. Autorização, parsing e validação seguem dentro de cada handler.
 *
 * Espelha api/analises-clinicas/[action].ts.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import faturamentoLotes from '../_lib/handlers/faturamento-lotes.js';
import faturamentoLoteDetalhe from '../_lib/handlers/faturamento-lote-detalhe.js';
import faturamentoTituloCriar from '../_lib/handlers/faturamento-titulo-criar.js';
import faturamentoOperadorasSync from '../_lib/handlers/faturamento-operadoras-sync.js';

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

// Chave = segmento do path.
const ROTAS: Record<string, Handler> = {
  lotes: faturamentoLotes,
  'lote-detalhe': faturamentoLoteDetalhe,
  'titulo-criar': faturamentoTituloCriar,
  'operadoras-sync': faturamentoOperadorasSync,
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
