// API Route: GET /api/faturamento/glosas-recursos-cron
// Vercel Cron (diário) — sincroniza com o apLIS a foto de glosas e recursos de cada mês de
// faturamento de 2026, todos os convênios (.scratch/glosas-recursos-dashboard, issue 08).
// Mesma função do botão "Atualizar" (faturamento/sincronizarGlosasRecursos.ts), mês a mês.
// Agendamento em vercel.json: "0 9 * * *" (06h de Brasília).
// Tempo: maxDuration de 300 s (vercel.json). Um mês só começa se, pelo mais lento até
// agora, ainda couber antes do limite; os que não cabem ficam em `pulados` e no log.
// Ordem: primeiro os meses sincronizados há mais tempo (todos os convênios), então
// um mês pulado hoje vai para o começo da fila amanhã.
// Segurança: Authorization: Bearer <CRON_SECRET>.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { cronAutorizado } from '../faturamento/autorizacao.js';
import { sincronizarRecorte } from '../faturamento/sincronizarGlosasRecursos.js';
import { getSupabaseAdminClient } from '../supabase.js';

/** Recursos anteriores a 2026 não foram organizados em lotes no apLIS. */
const ANO_SINCRONIZADO = 2026;

/** maxDuration da função (300 s) menos uma folga para responder. */
const ORCAMENTO_MS = 280_000;

interface ResultadoMes {
  competencia: string;
  ok: boolean;
  requisicoes?: number;
  lotes?: number;
  erro?: string;
}

/** Meses de 2026 até o atual (de Brasília), do mais recente ao mais antigo. */
function mesesDoAno(agora: Date): string[] {
  // en-CA: YYYY-MM-DD.
  const hoje = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const ano = Number(hoje.slice(0, 4));
  if (ano < ANO_SINCRONIZADO) return [];
  const ultimo = ano > ANO_SINCRONIZADO ? 12 : Number(hoje.slice(5, 7));
  const meses: string[] = [];
  for (let mes = ultimo; mes >= 1; mes--) meses.push(`${ANO_SINCRONIZADO}-${String(mes).padStart(2, '0')}`);
  return meses;
}

/**
 * Os meses na ordem da rotina: nunca sincronizados primeiro, depois do sincronizado há
 * mais tempo ao mais recente; empate fica do mês mais recente ao mais antigo.
 */
async function mesesASincronizar(supabase: SupabaseClient, agora: Date): Promise<string[]> {
  const meses = mesesDoAno(agora);
  if (meses.length === 0) return [];
  const { data, error } = await supabase
    .from('glosa_recurso_sincronizacoes')
    .select('competencia, sincronizado_em')
    .is('id_fonte_pagadora', null)
    .in('competencia', meses);
  if (error) throw new Error(`sincronizações: ${error.message}`);

  const ultima = new Map<string, string>();
  for (const linha of (data ?? []) as { competencia: string; sincronizado_em: string }[]) {
    const atual = ultima.get(linha.competencia);
    if (!atual || linha.sincronizado_em > atual) ultima.set(linha.competencia, linha.sincronizado_em);
  }
  // sort é estável: o empate mantém a ordem de mesesDoAno.
  return [...meses].sort((a, b) => (ultima.get(a) ?? '').localeCompare(ultima.get(b) ?? ''));
}

/** Um mês; a falha fica no log e no resultado, sem interromper os outros. */
async function sincronizarMes(supabase: SupabaseClient, competencia: string): Promise<ResultadoMes> {
  try {
    const r = await sincronizarRecorte(supabase, { competencia, usuarioId: null });
    if (!('erro' in r)) return { competencia, ok: true, requisicoes: r.requisicoes, lotes: r.lotes };
    console.error(`[faturamento/glosas-recursos-cron] ${competencia}:`, r.erro.mensagem);
    return { competencia, ok: false, erro: r.erro.mensagem };
  } catch (err) {
    const erro = describeError(err);
    console.error(`[faturamento/glosas-recursos-cron] ${competencia}:`, erro);
    return { competencia, ok: false, erro };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (!cronAutorizado(req)) {
    res.status(401).json({ success: false, error: 'Não autorizado.' });
    return;
  }

  try {
    const inicio = Date.now();
    const supabase = getSupabaseAdminClient();
    const meses: ResultadoMes[] = [];
    const pulados: string[] = [];
    let maisLentoMs = 0;
    for (const competencia of await mesesASincronizar(supabase, new Date(inicio))) {
      const antes = Date.now();
      if (antes - inicio + maisLentoMs > ORCAMENTO_MS) {
        pulados.push(competencia);
        continue;
      }
      meses.push(await sincronizarMes(supabase, competencia));
      maisLentoMs = Math.max(maisLentoMs, Date.now() - antes);
    }
    if (pulados.length > 0) {
      console.error('[faturamento/glosas-recursos-cron] sem tempo para:', pulados.join(', '));
    }

    const ok = meses.every((m) => m.ok) && pulados.length === 0;
    res.status(ok ? 200 : 502).json({ success: ok, meses, pulados });
  } catch (e) {
    console.error('[faturamento/glosas-recursos-cron]', describeError(e));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
