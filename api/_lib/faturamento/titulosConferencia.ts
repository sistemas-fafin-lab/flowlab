// api/_lib/faturamento/titulosConferencia.ts
// Títulos que entram na conferência com o apLIS — lidos com o cliente do
// USUÁRIO, para respeitar o RLS. Compartilhado pela conferência
// (titulos-conferencia-aplis) e pela prévia das baixas (titulos-baixas-aplis-previa).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DispensaConferencia, TipoDivergenciaAplis, TituloConferencia } from './conferenciaAplis.js';
import type { TituloSaldo } from './saldoOperadoras.js';
import { EMBED_ENVIO_LOTE, ALIAS_ENVIO_LOTE, mesesDoPeriodo } from '../../../src/modules/faturamento/utils/basePeriodoTitulos.js';
import type { BasePeriodoTitulos } from '../../../src/modules/faturamento/utils/basePeriodoTitulos.js';

/** Título da conferência com o saldo, que a prévia das baixas mostra. */
export interface TituloParaConferir extends TituloConferencia {
  /** `notas.valor_saldo`: total − recebido − glosa acatada do apLIS. */
  saldoSistema: number;
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
        'id_nota, numero_nota, status, data_emissao, valor_total, valor_recebido, valor_glosado, valor_saldo, '
        + 'operadoras(nome), nota_lote(lotes(aplis_id))',
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
      valor_saldo: unknown;
      operadoras: { nome: string | null } | null;
      nota_lote: { lotes: { aplis_id: string | null } | null }[] | null;
    }[];
    for (const nota of pagina) {
      const vinculos = nota.nota_lote ?? [];
      const idsLote: number[] = [];
      for (const { lotes } of vinculos) {
        const id = Number(lotes?.aplis_id ?? NaN);
        if (!lotes || !Number.isInteger(id) || id <= 0) continue;
        idsLote.push(id);
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
        saldoSistema: valorNumerico(nota.valor_saldo),
        idsLote,
      });
    }
    if (pagina.length < PAGINA_NOTAS) break;
  }
  return titulos;
}

/** Dispensas ativas da conferência com o apLIS (fat_conferencia_aplis_dispensas). */
export async function dispensasAtivas(supabase: SupabaseClient): Promise<DispensaConferencia[]> {
  const dispensas: DispensaConferencia[] = [];
  for (let offset = 0; ; offset += PAGINA_NOTAS) {
    const { data, error } = await supabase
      .from('fat_conferencia_aplis_dispensas')
      .select('id_nota, tipo, recebido_sistema, recebido_aplis, lotes, justificativa, dispensado_por_nome, dispensado_em')
      .is('encerrada_em', null)
      .order('id_nota', { ascending: true })
      .range(offset, offset + PAGINA_NOTAS - 1);
    if (error) throw new ErroSupabase(`dispensas: ${error.message}`);
    const pagina = (data ?? []) as unknown as {
      id_nota: string;
      tipo: TipoDivergenciaAplis;
      recebido_sistema: unknown;
      recebido_aplis: unknown;
      lotes: number[] | null;
      justificativa: string;
      dispensado_por_nome: string | null;
      dispensado_em: string;
    }[];
    for (const d of pagina) {
      dispensas.push({
        idNota: d.id_nota,
        tipo: d.tipo,
        recebidoSistema: valorNumerico(d.recebido_sistema),
        recebidoAplis: d.recebido_aplis === null || d.recebido_aplis === undefined ? null : valorNumerico(d.recebido_aplis),
        lotes: (d.lotes ?? []).map(Number),
        justificativa: d.justificativa,
        dispensadoPorNome: d.dispensado_por_nome,
        dispensadoEm: d.dispensado_em,
      });
    }
    if (pagina.length < PAGINA_NOTAS) break;
  }
  return dispensas;
}

/**
 * Ids no apLIS dos lotes dos títulos do período (`desde`/`ate`, YYYY-MM-DD,
 * inclusivos, sobre a `base` da tela — ver utils/basePeriodoTitulos.ts) — o
 * universo do filtro "Status do lote (apLIS)" da aba Títulos. Lote sem
 * `aplis_id` (criado fora do apLIS) fica de fora.
 */
export async function lotesAplisDosTitulos(
  supabase: SupabaseClient,
  desde: string,
  ate: string,
  base: BasePeriodoTitulos = 'emissao',
): Promise<number[]> {
  const ids = new Set<number>();
  const meses = mesesDoPeriodo(desde, ate);
  for (let offset = 0; ; offset += PAGINA_NOTAS) {
    let consulta = supabase
      .from('notas')
      .select(`id_nota, nota_lote(lotes(aplis_id))${base === 'envio' ? `, ${EMBED_ENVIO_LOTE}` : ''}`);
    if (base === 'competencia') {
      consulta = consulta.gte('competencia', meses.de).lte('competencia', meses.ate);
    } else if (base === 'envio') {
      consulta = consulta.gte(`${ALIAS_ENVIO_LOTE}.lotes.data_envio`, desde).lte(`${ALIAS_ENVIO_LOTE}.lotes.data_envio`, ate);
    } else {
      consulta = consulta.gte('data_emissao', desde).lte('data_emissao', ate);
    }
    const { data, error } = await consulta
      .order('id_nota', { ascending: true })
      .range(offset, offset + PAGINA_NOTAS - 1);
    if (error) throw new ErroSupabase(`notas: ${error.message}`);
    const pagina = (data ?? []) as unknown as {
      nota_lote: { lotes: { aplis_id: string | null } | null }[] | null;
    }[];
    for (const nota of pagina) {
      for (const { lotes } of nota.nota_lote ?? []) {
        const id = Number(lotes?.aplis_id ?? NaN);
        if (Number.isInteger(id) && id > 0) ids.add(id);
      }
    }
    if (pagina.length < PAGINA_NOTAS) break;
  }
  return [...ids];
}

/**
 * Títulos não cancelados com operadora, saldo e lotes, para o saldo por
 * operadora do Dashboard. Os filtros da tela são aplicados depois, em
 * `filtrarUniverso` (mesma regra da RPC). Lidos com o cliente do usuário (RLS).
 */
export async function titulosParaSaldo(supabase: SupabaseClient): Promise<TituloSaldo[]> {
  const titulos: TituloSaldo[] = [];
  for (let offset = 0; ; offset += PAGINA_NOTAS) {
    const { data, error } = await supabase
      .from('notas')
      .select(
        'id_nota, numero_nota, operadora_id, data_emissao, valor_saldo, '
        + 'operadoras(nome, is_considerada_meta), nota_lote(lotes(aplis_id, codigo_lote))',
      )
      .neq('status', 'cancelada')
      .order('id_nota', { ascending: true })
      .range(offset, offset + PAGINA_NOTAS - 1);
    if (error) throw new ErroSupabase(`notas: ${error.message}`);
    const pagina = (data ?? []) as unknown as {
      id_nota: string;
      numero_nota: string | null;
      operadora_id: string;
      data_emissao: string | null;
      valor_saldo: unknown;
      operadoras: { nome: string | null; is_considerada_meta: boolean | null } | null;
      nota_lote: { lotes: { aplis_id: string | null; codigo_lote: string | null } | null }[] | null;
    }[];
    for (const nota of pagina) {
      titulos.push({
        idNota: nota.id_nota,
        numeroNota: nota.numero_nota || null,
        operadoraId: nota.operadora_id,
        operadora: nota.operadoras?.nome ?? '—',
        consideradaMeta: nota.operadoras?.is_considerada_meta === true,
        dataEmissao: nota.data_emissao,
        saldoSistema: valorNumerico(nota.valor_saldo),
        lotes: (nota.nota_lote ?? []).flatMap(({ lotes }) => {
          if (!lotes) return [];
          const id = Number(lotes.aplis_id ?? NaN);
          return [{ aplisId: Number.isInteger(id) && id > 0 ? id : null, codigo: lotes.codigo_lote }];
        }),
      });
    }
    if (pagina.length < PAGINA_NOTAS) break;
  }
  return titulos;
}
