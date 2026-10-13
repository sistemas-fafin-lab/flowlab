// API Route: POST /api/ti/agente-analisar (issues 08 e 09)
//   { titulo, resumo, realizada_em? }  → cola uma reunião e analisa na hora (canManageIT ou gestor)
//   { reuniao_id }                     → reanalisa (só gestor, canApproveAgenteTI — D14)
//   ?dryRun=true                       → devolve as sugestões validadas sem gravar nada
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../supabase.js';
import { autorizar, ehFalha, tem, tokenDoHeader } from '../ti-agente/autorizacao.js';
import { analisarReuniao } from '../ti-agente/analisarReuniao.js';
import { dependenciasIA } from '../ti-agente/servicos.js';

/** Limite do resumo colado (o da reunião real de 21/09 tinha ~14,5 mil caracteres). */
const MAX_RESUMO = 60_000;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Use POST.' });
    return;
  }
  const auth = await autorizar(tokenDoHeader(req.headers.authorization), ['canManageIT', 'canApproveAgenteTI']);
  if (ehFalha(auth)) {
    res.status(auth.status).json(auth.payload);
    return;
  }
  const dryRun = String(req.query.dryRun ?? '') === 'true';
  const corpo = (req.body ?? {}) as { titulo?: string; resumo?: string; realizada_em?: string; reuniao_id?: string };
  const db = getSupabaseAdminClient();

  try {
    let reuniaoId = corpo.reuniao_id?.trim();

    if (reuniaoId) {
      if (!tem(auth, 'canApproveAgenteTI')) {
        res.status(403).json({ success: false, error: 'Só gestores reanalisam reuniões.' });
        return;
      }
    } else {
      const titulo = corpo.titulo?.trim();
      const resumo = corpo.resumo?.trim();
      if (!titulo || !resumo) {
        res.status(400).json({ success: false, error: 'Informe o título e o resumo da reunião.' });
        return;
      }
      if (resumo.length > MAX_RESUMO) {
        res.status(413).json({ success: false, error: `O resumo passa de ${MAX_RESUMO.toLocaleString('pt-BR')} caracteres.` });
        return;
      }
      const realizadaEm = corpo.realizada_em && !Number.isNaN(Date.parse(corpo.realizada_em)) ? corpo.realizada_em : new Date().toISOString();
      if (dryRun) {
        // Sem gravar: grava provisoriamente para reaproveitar o mesmo caminho e apaga em seguida.
        const { data: tmp, error } = await db.from('ti_agente_reunioes')
          .insert({ origem: 'manual', titulo, resumo_markdown: resumo, realizada_em: realizadaEm, created_by: auth.userId, status: 'pendente' })
          .select('id').single();
        if (error || !tmp) throw new Error(error?.message ?? 'Falha ao preparar a análise.');
        try {
          const r = await analisarReuniao(db, dependenciasIA(db), tmp.id as string, { dryRun: true });
          res.status(r.ok ? 200 : 502).json({ success: r.ok, dryRun: true, ...r });
        } finally {
          await db.from('ti_agente_reunioes').delete().eq('id', tmp.id);
        }
        return;
      }
      const { data: nova, error } = await db.from('ti_agente_reunioes')
        .insert({ origem: 'manual', titulo, resumo_markdown: resumo, realizada_em: realizadaEm, created_by: auth.userId, status: 'pendente' })
        .select('id').single();
      if (error || !nova) throw new Error(error?.message ?? 'Falha ao gravar a reunião.');
      reuniaoId = nova.id as string;
    }

    const r = await analisarReuniao(db, dependenciasIA(db), reuniaoId, { dryRun });
    res.status(r.ok ? 200 : 502).json({ success: r.ok, dryRun, ...r });
  } catch (e) {
    console.error('[ti/agente-analisar]', e);
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : 'Erro interno' });
  }
}
