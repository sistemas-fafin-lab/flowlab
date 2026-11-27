// Leituras da base de conhecimento (D45, issue 33): as resoluções dos chamados e os chamados
// recentes, para a triagem (parecido já resolvido, possível repetido), o chat, o WhatsApp e o
// rascunho da resolução. A busca em si é pura (src/modules/eva/domain/conhecimento.ts).
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  blocoConhecimento, maisParecidos, pareceConsultaDeSolucao, type DocConhecimento,
} from '../../../src/modules/eva/domain/conhecimento.js';

/** Quantas resoluções entram na busca: as mais recentes. Cabe em memória com folga. */
export const MAX_BASE = 600;
/** Repetido: chamados abertos (ou resolvidos) nos últimos dias. */
export const DIAS_REPETIDO = 30;

/** As resoluções escritas, das mais recentes para as mais antigas. Falha de leitura: base vazia. */
export async function lerResolucoes(db: SupabaseClient, limite = MAX_BASE): Promise<DocConhecimento[]> {
  const { data, error } = await db
    .from('it_requests')
    .select('id, codigo, title, description, resolution, resolved_at')
    .eq('status', 'resolved')
    .not('resolution', 'is', null)
    .order('resolved_at', { ascending: false })
    .limit(limite);
  if (error) {
    console.error('[EVA/conhecimento] resoluções', error.message);
    return [];
  }
  return (data ?? [])
    .filter((r) => typeof r.resolution === 'string' && r.resolution.trim())
    .map((r) => ({
      id: r.id as string, codigo: r.codigo as string, titulo: (r.title as string) ?? '', descricao: (r.description as string | null) ?? null,
      resolucao: r.resolution as string, quando: (r.resolved_at as string | null) ?? null,
    }));
}

export interface ChamadoRecente extends DocConhecimento { status: string; solicitante: string | null }

/** Os chamados de usuário dos últimos dias (abertos ou não), para achar um pedido repetido. */
export async function lerChamadosRecentes(db: SupabaseClient, agora: Date, dias = DIAS_REPETIDO): Promise<ChamadoRecente[]> {
  const desde = new Date(agora.getTime() - dias * 86_400_000).toISOString();
  const { data, error } = await db
    .from('it_requests')
    .select('id, codigo, title, description, resolution, status, created_at, solicitante:user_profiles!requested_by(name)')
    .eq('is_internal', false)
    .gte('created_at', desde)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) {
    console.error('[EVA/conhecimento] chamados recentes', error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string, codigo: r.codigo as string, titulo: (r.title as string) ?? '', descricao: (r.description as string | null) ?? null,
    resolucao: (r.resolution as string | null) ?? null, quando: (r.created_at as string | null) ?? null, status: r.status as string,
    solicitante: (r.solicitante as unknown as { name?: string } | null)?.name ?? null,
  }));
}

/**
 * O bloco <base_de_conhecimento> para o chat e o WhatsApp: só quando a mensagem parece pedir
 * uma solução ou relatar um problema, e só com o que passou do mínimo. null = nada a acrescentar.
 */
export async function conhecimentoPara(db: SupabaseClient, texto: string): Promise<string | null> {
  if (!pareceConsultaDeSolucao(texto)) return null;
  const achados = maisParecidos(texto, await lerResolucoes(db), { n: 3, minimo: 2.5 });
  return blocoConhecimento(achados);
}
