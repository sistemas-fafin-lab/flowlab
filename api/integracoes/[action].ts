/**
 * API Route: /api/integracoes/[action]
 *
 * Dispatcher (dynamic route) — colapsa as rotas de integração server-to-server
 * (orcamento-particular, tuss-exames, lab-brain-apoio-*, lab-brain-chamado-*) numa única Serverless Function, para caber
 * no limite do plano Vercel (12 functions no Hobby). O segmento `[action]` do path
 * vira `req.query.action` e seleciona o handler.
 *
 * Cada handler vive em api/_lib/handlers/ — o prefixo `_` faz o Vercel NÃO contá-los
 * como functions. Autorização segue dentro de cada handler — cada integração tem sua
 * própria chave dedicada (TABELA_PARTICULAR_API_KEY, ADMISSAO_API_KEY, LAB_BRAIN_API_KEY, LAB_BRAIN_CHAMADOS_API_KEY).
 *
 * Espelha api/umami/[action].ts.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import integracoesOrcamentoParticular from '../_lib/handlers/integracoes-orcamento-particular.js';
import integracoesTussExames from '../_lib/handlers/integracoes-tuss-exames.js';
import labBrainApoioRequisicao from '../_lib/handlers/integracoes-lab-brain-apoio-requisicao.js';
import labBrainApoioFila from '../_lib/handlers/integracoes-lab-brain-apoio-fila.js';
import labBrainApoioExames from '../_lib/handlers/integracoes-lab-brain-apoio-exames.js';
import labBrainChamadoCriar from '../_lib/handlers/integracoes-lab-brain-chamado-criar.js';

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

// Chave = segmento do path.
const ROTAS: Record<string, Handler> = {
  'orcamento-particular': integracoesOrcamentoParticular,
  'tuss-exames': integracoesTussExames,
  // LAB-BRAIN → Envio ao Álvaro (LAB_BRAIN_API_KEY, 120/min, auditado)
  'lab-brain-apoio-requisicao': labBrainApoioRequisicao,
  'lab-brain-apoio-fila': labBrainApoioFila,
  'lab-brain-apoio-exames': labBrainApoioExames,
  // LAB-BRAIN → chamados de TI (LAB_BRAIN_CHAMADOS_API_KEY, 10/min, auditado)
  'lab-brain-chamado-criar': labBrainChamadoCriar,
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
