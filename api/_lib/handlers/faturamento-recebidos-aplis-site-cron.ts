// API Route: GET /api/faturamento/recebidos-aplis-site-cron
// Vercel Cron — retrato do recebido dos lotes lido no site do apLIS
// (.scratch/faturamento-recebidos-aplis-site/spec.md). Agendamento em vercel.json:
// 10h, 15h e 20h UTC (07h, 12h e 17h de Brasília) — três entradas do mesmo caminho,
// porque o plano Hobby só roda cada cron uma vez por dia.
// Tempo: maxDuration de 300 s (vercel.json); para em 270 s e o resto vai na próxima.
// Segurança: Authorization: Bearer <CRON_SECRET>.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { cronAutorizado } from '../faturamento/autorizacao.js';
import { capturarRecebidosSite } from '../faturamento/recebidosAplisSite.js';
import { getSupabaseAdminClient } from '../supabase.js';

const ORCAMENTO_MS = 270_000;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (!cronAutorizado(req)) {
    res.status(401).json({ success: false, error: 'Não autorizado.' });
    return;
  }
  try {
    const resumo = await capturarRecebidosSite(getSupabaseAdminClient(), {
      origem: 'rotina',
      usuarioId: null,
      orcamentoMs: ORCAMENTO_MS,
    });
    if (resumo.erro) console.error('[faturamento/recebidos-aplis-site-cron]', resumo.erro);
    if (resumo.pendentes > 0) console.error('[faturamento/recebidos-aplis-site-cron] sem tempo para', resumo.pendentes, 'lotes');
    res.status(resumo.erro ? 502 : 200).json({ success: !resumo.erro, ...resumo });
  } catch (e) {
    console.error('[faturamento/recebidos-aplis-site-cron]', describeError(e));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
