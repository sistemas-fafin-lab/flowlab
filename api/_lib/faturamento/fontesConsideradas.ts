/**
 * Whitelist de fontes pagadoras consideradas para meta (feedback do setor de
 * faturamento, 03/09) — lista fechada gerenciada em `operadoras.is_considerada_meta`,
 * usada para filtrar as consultas ao MySQL de backup (bdLab.ts) em cada handler
 * do módulo Faturamento.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

interface Cache { ids: number[]; ts: number }
let cache: Cache | null = null;
const TTL = 60_000;

/**
 * `aplis_id` (numérico) das operadoras marcadas `is_considerada_meta = true`.
 * Cache de 60s em memória — mesma razão de ser do cache de bdLab.ts (a
 * instância Vercel Serverless sobrevive entre requisições enquanto está
 * quente): evita bater no Supabase a cada página/paginação da mesma tela.
 */
export async function listarFontesConsideradasMeta(supabase: SupabaseClient): Promise<number[]> {
  if (cache && Date.now() - cache.ts <= TTL) return cache.ids;

  const { data, error } = await supabase
    .from('operadoras')
    .select('aplis_id')
    .eq('is_considerada_meta', true);
  if (error) throw new Error(error.message);

  const ids = (data ?? [])
    .map((linha) => Number((linha as { aplis_id: string | null }).aplis_id))
    .filter((n) => Number.isFinite(n));

  cache = { ids, ts: Date.now() };
  return ids;
}
