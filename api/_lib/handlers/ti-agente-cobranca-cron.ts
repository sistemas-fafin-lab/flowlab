// API Route: GET /api/ti/agente-cobranca-cron
// Vercel Cron (dias úteis) — monta a cobrança da manhã de cada membro e grava na fila
// (issue 14, plano §10). Agendamento em vercel.json: "0 11 * * 1-5" (08h de Brasília).
// Quem envia é o script da VPS (D9). Segurança: Authorization: Bearer <CRON_SECRET>.
// Conferir antes de ligar: GET /api/ti/agente-cobranca-cron?dryRun=true devolve os textos
// sem gravar, mesmo com a cobrança desligada ou em fim de semana.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { APP_BASE_URL } from '../appUrl.js';
import { getSupabaseAdminClient } from '../supabase.js';
import { cronAutorizado } from '../ti-agente/autorizacao.js';
import { gerarCobrancasDoDia } from '../ti-agente/cobranca.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (!cronAutorizado(req)) {
    res.status(401).json({ success: false, error: 'Não autorizado.' });
    return;
  }
  try {
    const r = await gerarCobrancasDoDia(getSupabaseAdminClient(), {
      dryRun: String(req.query.dryRun ?? '') === 'true',
      linkInicio: `${APP_BASE_URL}/it/inicio`,
    });
    res.status(200).json({ success: true, ...r });
  } catch (e) {
    console.error('[ti/agente-cobranca-cron]', e);
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : 'Erro interno' });
  }
}
