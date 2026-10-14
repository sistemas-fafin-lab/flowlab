// api/_lib/faturamento/titulosConferencia.ts
// Títulos que entram na conferência com o apLIS — lidos com o cliente do
// USUÁRIO, para respeitar o RLS. Compartilhado pela conferência
// (titulos-conferencia-aplis) e pela prévia das baixas (titulos-baixas-aplis-previa).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { TituloConferencia } from './conferenciaAplis.js';

/** Título da conferência com o id no sistema de cada lote — a prévia das glosas
 *  grava a glosa no lote (`glosas.lote_id`). */
export interface TituloParaConferir extends TituloConferencia {
  /** `aplis_id` → `lotes.id_lote`. */
  idLoteSistema: Record<number, string>;
}

/** Página do PostgREST (max-rows padrão do Supabase). */
const PAGINA_NOTAS = 1000;

/** Falha de leitura no Supabase: o handler devolve 502, não 500. */
export class ErroSupabase extends Error {}

/** numeric do Postgres pode chegar como string; nulo conta como 0. */
export function valorNumerico(bruto: unknown): number {
  const n = Number(bruto ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Títulos não cancelados cujos lotes têm todos `aplis_id`. Título com algum lote
 * sem `aplis_id` (criado fora do apLIS) fica de fora: o recebido do apLIS seria
 * só de parte dele.
 */
export async function titulosParaConferir(supabase: SupabaseClient): Promise<TituloParaConferir[]> {
  const titulos: TituloParaConferir[] = [];
  for (let offset = 0; ; offset += PAGINA_NOTAS) {
    const { data, error } = await supabase
      .from('notas')
      .select(
        'id_nota, numero_nota, status, data_emissao, valor_total, valor_recebido, valor_glosado, '
        + 'operadoras(nome), nota_lote(lotes(id_lote, aplis_id))',
      )
      .neq('status', 'cancelada')
      .order('id_nota', { ascending: true })
      .range(offset, offset + PAGINA_NOTAS - 1);
    if (error) throw new ErroSupabase(`notas: ${error.message}`);
    const pagina = (data ?? []) as unknown as {
      id_nota: string;
      numero_nota: string | null;
      status: string;
      data_emissao: string | null;
      valor_total: unknown;
      valor_recebido: unknown;
      valor_glosado: unknown;
      operadoras: { nome: string | null } | null;
      nota_lote: { lotes: { id_lote: string; aplis_id: string | null } | null }[] | null;
    }[];
    for (const nota of pagina) {
      const vinculos = nota.nota_lote ?? [];
      const idsLote: number[] = [];
      const idLoteSistema: Record<number, string> = {};
      for (const { lotes } of vinculos) {
        const id = Number(lotes?.aplis_id ?? NaN);
        if (!lotes || !Number.isInteger(id) || id <= 0) continue;
        idsLote.push(id);
        idLoteSistema[id] = lotes.id_lote;
      }
      if (vinculos.length === 0 || idsLote.length !== vinculos.length) continue;
      titulos.push({
        idNota: nota.id_nota,
        numeroNota: nota.numero_nota || null,
        operadora: nota.operadoras?.nome ?? '—',
        status: nota.status,
        dataEmissao: nota.data_emissao,
        valorTotal: valorNumerico(nota.valor_total),
        recebidoSistema: valorNumerico(nota.valor_recebido),
        glosadoSistema: valorNumerico(nota.valor_glosado),
        idsLote,
        idLoteSistema,
      });
    }
    if (pagina.length < PAGINA_NOTAS) break;
  }
  return titulos;
}
