// API Route: GET /api/ti/agente-cobranca-cron
// Vercel Cron (dias úteis) — monta a cobrança da manhã de cada membro e grava na fila
// (issue 14, plano §10). Agendamento em vercel.json: "0 11 * * 1-5" (08h de Brasília).
// No mesmo horário, o relatório de gestão para os gestores que o marcaram (D38): o do dia e, na
// segunda, o da semana anterior. Os dois rodam separados: um não segura o outro.
// Quem envia é o script da VPS (D9). Segurança: Authorization: Bearer <CRON_SECRET>.
// Conferir antes de ligar: GET /api/ti/agente-cobranca-cron?dryRun=true devolve os textos
// sem gravar, mesmo com a cobrança desligada ou em fim de semana.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { APP_BASE_URL } from '../appUrl.js';
import { getSupabaseAdminClient } from '../supabase.js';
import { cronAutorizado } from '../ti-agente/autorizacao.js';
import { gerarCobrancasDoDia } from '../ti-agente/cobranca.js';
import { gerarRelatoriosDeGestao } from '../ti-agente/gestao.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (!cronAutorizado(req)) {
    res.status(401).json({ success: false, error: 'Não autorizado.' });
    return;
  }
  const db = getSupabaseAdminClient();
  const opcoes = { dryRun: String(req.query.dryRun ?? '') === 'true', linkInicio: `${APP_BASE_URL}/it/inicio` };
  const [cobranca, relatorio] = await Promise.allSettled([gerarCobrancasDoDia(db, opcoes), gerarRelatoriosDeGestao(db, opcoes)]);
  if (cobranca.status === 'rejected') console.error('[ti/agente-cobranca-cron] cobrança', cobranca.reason);
  if (relatorio.status === 'rejected') console.error('[ti/agente-cobranca-cron] relatório de gestão', relatorio.reason);
  const erro = (r: PromiseRejectedResult) => (r.reason instanceof Error ? r.reason.message : 'Erro interno');
  if (cobranca.status === 'rejected') {
    res.status(500).json({ success: false, error: erro(cobranca), relatorio: relatorio.status === 'fulfilled' ? relatorio.value : { erro: erro(relatorio) } });
    return;
  }
  res.status(200).json({ success: true, ...cobranca.value, relatorio: relatorio.status === 'fulfilled' ? relatorio.value : { erro: erro(relatorio) } });
}
