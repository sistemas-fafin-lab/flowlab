// API Route: GET /api/ti/agente-fechamento-cron
// Vercel Cron (dias úteis) — monta o fechamento do dia e grava na fila para o grupo da equipe
// (issue 18, D29). Agendamento em vercel.json: "0 21 * * 1-5" (18h de Brasília).
// Quem envia é o script da VPS (D9). Segurança: Authorization: Bearer <CRON_SECRET>.
// Conferir antes de ligar: GET /api/ti/agente-fechamento-cron?dryRun=true devolve o texto
// sem gravar, mesmo com o fechamento desligado ou sem grupo escolhido.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { APP_BASE_URL } from '../appUrl.js';
import { getSupabaseAdminClient } from '../supabase.js';
import { cronAutorizado } from '../ti-agente/autorizacao.js';
import { gerarFechamentoDoDia } from '../ti-agente/grupo.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (!cronAutorizado(req)) {
    res.status(401).json({ success: false, error: 'Não autorizado.' });
    return;
  }
  try {
    const r = await gerarFechamentoDoDia(getSupabaseAdminClient(), {
      dryRun: String(req.query.dryRun ?? '') === 'true',
      linkInicio: `${APP_BASE_URL}/it/inicio`,
    });
    res.status(200).json({ success: true, ...r });
  } catch (e) {
    console.error('[ti/agente-fechamento-cron]', e);
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : 'Erro interno' });
  }
}
