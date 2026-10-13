// API Route: POST /api/ti/agente-sincronizar
// Botão "Buscar reuniões agora" (issue 10): a mesma rotina do cron, com a sessão do
// usuário. Exige canManageIT ou canApproveAgenteTI.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../supabase.js';
import { autorizar, ehFalha, tokenDoHeader } from '../ti-agente/autorizacao.js';
import { sincronizarGranola } from '../ti-agente/sincronizar.js';
import { clienteGranola, dependenciasIA } from '../ti-agente/servicos.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  const inicio = Date.now();
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Use POST.' });
    return;
  }
  const auth = await autorizar(tokenDoHeader(req.headers.authorization), ['canManageIT', 'canApproveAgenteTI']);
  if (ehFalha(auth)) {
    res.status(auth.status).json(auth.payload);
    return;
  }
  try {
    const db = getSupabaseAdminClient();
    const r = await sincronizarGranola(db, clienteGranola(), dependenciasIA(db), { inicio });
    res.status(r.ok ? 200 : 502).json({ success: r.ok, ...r });
  } catch (e) {
    console.error('[ti/agente-sincronizar]', e);
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : 'Erro interno' });
  }
}
