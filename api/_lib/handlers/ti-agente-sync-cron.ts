// API Route: GET /api/ti/agente-sync-cron
// Vercel Cron (dias úteis) — busca as reuniões novas da pasta do Granola e analisa as
// pendentes (issue 10). Agendamento em vercel.json: "0 12 * * 1-5" (09h de Brasília).
// Segurança: Authorization: Bearer <CRON_SECRET>.
// Teste sem gravar: GET /api/ti/agente-sync-cron?dryRun=true (lista as notas da pasta).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../supabase.js';
import { cronAutorizado } from '../ti-agente/autorizacao.js';
import { sincronizarGranola } from '../ti-agente/sincronizar.js';
import { clienteGranola, dependenciasIA } from '../ti-agente/servicos.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  const inicio = Date.now();
  if (!cronAutorizado(req)) {
    res.status(401).json({ success: false, error: 'Não autorizado.' });
    return;
  }
  try {
    const db = getSupabaseAdminClient();
    const r = await sincronizarGranola(db, clienteGranola(), dependenciasIA(db), {
      dryRun: String(req.query.dryRun ?? '') === 'true',
      inicio,
    });
    res.status(r.ok ? 200 : 502).json({ success: r.ok, ...r });
  } catch (e) {
    console.error('[ti/agente-sync-cron]', e);
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : 'Erro interno' });
  }
}
