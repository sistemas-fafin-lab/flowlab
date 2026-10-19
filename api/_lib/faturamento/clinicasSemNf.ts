/**
 * Locais de origem (clínicas) para os quais o laboratório não emite NF —
 * lista gerenciada em `clinicas_sem_nf` (migration 20261019170000), usada para
 * tirar essas requisições de Pendências → Particulares (bdLab.ts,
 * listarParticularesPendentes). Mesmo padrão de fontesConsideradas.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

interface Cache { ids: number[]; ts: number }
let cache: Cache | null = null;
const TTL = 60_000;

/**
 * `aplis_id` (fatinstituicao.IdInstituicao) dos locais de origem sem NF.
 * Cache de 60s em memória, pelo mesmo motivo de listarFontesConsideradasMeta.
 * A lista é a mesma para todo leitor (a RLS só decide quem lê), então o cache
 * não precisa ser por usuário.
 *
 * Lança em caso de erro: devolver lista vazia mostraria as clínicas sem NF
 * como pendência real, sem ninguém perceber.
 */
export async function listarClinicasSemNf(
  supabase: SupabaseClient,
  opcoes: { ignorarCache?: boolean } = {},
): Promise<number[]> {
  if (!opcoes.ignorarCache && cache && Date.now() - cache.ts <= TTL) return cache.ids;

  const { data, error } = await supabase.from('clinicas_sem_nf').select('aplis_id');
  if (error) throw new Error(error.message);

  const ids = (data ?? [])
    .map((linha) => Number((linha as { aplis_id: number | string }).aplis_id))
    .filter((n) => Number.isInteger(n))
    // Ordem estável: os ids entram na chave do cache de bdLab.ts.
    .sort((a, b) => a - b);

  cache = { ids, ts: Date.now() };
  return ids;
}

/** Só para testes: descarta o cache entre cenários. */
export function limparCacheClinicasSemNf(): void {
  cache = null;
}
