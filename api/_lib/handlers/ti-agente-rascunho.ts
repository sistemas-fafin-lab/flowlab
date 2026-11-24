// API Route: POST /api/ti/agente-rascunho — o rascunho da resolução de um chamado (D45, issue 33).
// Corpo: { "chamadoId": "<uuid>" }. Quem resolve chamados (canManageIT) e os papéis da EVA.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../supabase.js';
import { autorizar, ehFalha, tokenDoHeader } from '../ti-agente/autorizacao.js';
import { rascunharResolucao } from '../ti-agente/rascunho.js';
import { dependenciasIA } from '../ti-agente/servicos.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Use POST.' });
    return;
  }
  const auth = await autorizar(tokenDoHeader(req.headers.authorization), ['canManageIT', 'canApproveAgenteTI', 'canManageAgenteTI']);
  if (ehFalha(auth)) {
    res.status(auth.status).json(auth.payload);
    return;
  }
  const chamadoId = (req.body as { chamadoId?: unknown } | null)?.chamadoId;
  if (typeof chamadoId !== 'string' || !UUID.test(chamadoId)) {
    res.status(400).json({ success: false, error: 'Informe o chamado.' });
    return;
  }
  const db = getSupabaseAdminClient();
  try {
    const r = await rascunharResolucao(db, dependenciasIA(db), { chamadoId, userId: auth.userId });
    if ('erro' in r) {
      res.status(r.status).json({ success: false, error: r.erro });
      return;
    }
    res.status(200).json({ success: true, rascunho: r.rascunho });
  } catch (e) {
    console.error('[ti/agente-rascunho]', e);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
