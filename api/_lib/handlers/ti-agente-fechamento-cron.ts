// API Route: GET /api/ti/agente-fechamento-cron
// Vercel Cron (dias úteis) — monta o fechamento do dia e grava na fila para o grupo da equipe
// (issue 18, D29). Agendamento em vercel.json: "0 21 * * 1-5" (18h de Brasília).
// Depois, confere a saúde das integrações (D39) e grava a foto do dia do painel de gestão (D42).
// Quem envia é o script da VPS (D9). Segurança: Authorization: Bearer <CRON_SECRET>.
// Conferir antes de ligar: GET /api/ti/agente-fechamento-cron?dryRun=true devolve o texto
// sem gravar, mesmo com o fechamento desligado ou sem grupo escolhido.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { APP_BASE_URL } from '../appUrl.js';
import { getSupabaseAdminClient } from '../supabase.js';
import { cronAutorizado } from '../ti-agente/autorizacao.js';
import { gravarFotoDoDia } from '../ti-agente/gestao.js';
import { gerarFechamentoDoDia } from '../ti-agente/grupo.js';
import { verificarSaudeSemFalhar } from '../ti-agente/saude.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (!cronAutorizado(req)) {
    res.status(401).json({ success: false, error: 'Não autorizado.' });
    return;
  }
  const db = getSupabaseAdminClient();
  const dryRun = String(req.query.dryRun ?? '') === 'true';
  // D42: a foto do fim do dia vai junto, separada (o dryRun não grava).
  const extras = async () => ({
    saude: await verificarSaudeSemFalhar(db, dryRun, 'ti/agente-fechamento-cron'),
    foto: dryRun ? null : await gravarFotoDoDia(db).then(() => 'gravada').catch((e) => {
      console.error('[ti/agente-fechamento-cron] foto do dia', e);
      return { erro: e instanceof Error ? e.message : 'Erro interno' };
    }),
  });
  try {
    const r = await gerarFechamentoDoDia(db, { dryRun, linkInicio: `${APP_BASE_URL}/it/inicio` });
    res.status(200).json({ success: true, ...r, ...(await extras()) });
  } catch (e) {
    console.error('[ti/agente-fechamento-cron]', e);
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : 'Erro interno', ...(await extras()) });
  }
}
