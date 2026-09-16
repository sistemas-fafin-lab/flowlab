/**
 * API Route: /api/rh/[action]
 *
 * Dispatcher (dynamic route) — mesmo padrão de api/qualidade/[action].ts:
 * colapsa as rotas do módulo de RH numa única Serverless Function, para caber
 * no limite do plano Vercel. Autorização/parsing/validação ficam dentro de
 * cada handler (este dispatcher NÃO autoriza nada).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import rhHoleritesPreview from '../_lib/handlers/rh-holerites-preview.js';
import rhHoleritesConfirmar from '../_lib/handlers/rh-holerites-confirmar.js';

// Parsing do PDF consolidado (dezenas de colaboradores) pode passar do teto
// padrão de 10s — mesmo raciocínio de api/qualidade/[action].ts.
export const config = { maxDuration: 60 };

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

const ROTAS: Record<string, Handler> = {
  'holerites-preview': rhHoleritesPreview,
  'holerites-confirmar': rhHoleritesConfirmar,
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
