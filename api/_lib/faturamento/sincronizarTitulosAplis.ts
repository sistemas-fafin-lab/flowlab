/**
 * Sincronização dos títulos com o apLIS. Lê os dados de hoje dos lotes dos
 * títulos no apLIS (`dadosDosLotes`) e manda tudo para a RPC
 * fat_sincronizar_titulos_aplis, que numa transação:
 *   - regrava nos lotes o status (o status do título na aba Títulos), o envio,
 *     o protocolo, a NF-e, o RPS e quem fechou o lote;
 *   - preenche o número da nota dos títulos sem número;
 *   - aplica a emissão nova dos títulos com lote refechado.
 * As regras estão na migration 20261116160000_fat_sincronizar_titulos_aplis.sql.
 *
 * Roda junto com a foto de glosas e recursos: na rotina diária
 * (handlers/faturamento-glosas-recursos-cron) e no "Atualizar" de Glosas e
 * Recursos (handlers/faturamento-glosas-recursos-sincronizar).
 *
 * Fonte do apLIS: MySQL de backup, ~1 dia de atraso. Falha na réplica → erro,
 * sem gravar nada.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { STLOT_LABELS, dadosDosLotes } from './bdLab.js';
import type { DadosLoteTitulo } from './bdLab.js';

/** Teto de linhas por resposta do PostgREST. */
const PAGINA = 1000;

export interface RefechamentoSincronizado {
  idNota: string;
  emissaoAntiga: string;
  emissaoNova: string;
}

export interface ResumoSincronizacaoTitulos {
  /** Lotes com `aplis_id` no FlowLab. */
  lotes: number;
  /** Lotes em que algum dado mudou. */
  lotesAtualizados: number;
  statusMudaram: number;
  numerosPreenchidos: number;
  refechamentos: RefechamentoSincronizado[];
  dadoAte: string | null;
}

export type ResultadoSincronizacaoTitulos =
  | ResumoSincronizacaoTitulos
  | { erro: { status: number; mensagem: string } };

/** Um lote no formato da RPC. */
export interface LoteParaSincronizar {
  aplis_id: string;
  status_aplis: number;
  status: string;
  data_envio: string | null;
  data_fechamento: string | null;
  protocolo: string | null;
  nfe_numero: string | null;
  numero_rps: number | null;
  responsavel_fechamento: string | null;
}

async function aplisIdsDosLotes(supabase: SupabaseClient): Promise<string[]> {
  const ids: string[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await supabase
      .from('lotes')
      .select('aplis_id')
      .not('aplis_id', 'is', null)
      .order('id_lote')
      .range(inicio, inicio + PAGINA - 1);
    if (error) throw new Error(`lotes: ${error.message}`);
    const linhas = (data ?? []) as { aplis_id: string }[];
    ids.push(...linhas.map((l) => l.aplis_id));
    if (linhas.length < PAGINA) return ids;
  }
}

/** `lotes.aplis_id` é texto; só os numéricos existem no apLIS. */
export function idAplisNumerico(aplisId: string): number | null {
  const id = Number(aplisId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Os lotes do FlowLab encontrados no apLIS, no formato da RPC. Puro, para teste. */
export function lotesParaSincronizar(
  aplisIds: string[],
  noAplis: Map<number, DadosLoteTitulo>,
): LoteParaSincronizar[] {
  const lotes: LoteParaSincronizar[] = [];
  for (const aplisId of aplisIds) {
    const id = idAplisNumerico(aplisId);
    const dados = id === null ? undefined : noAplis.get(id);
    if (!dados) continue;
    lotes.push({
      aplis_id: aplisId,
      status_aplis: dados.status,
      status: STLOT_LABELS[dados.status] ?? `Status ${dados.status}`,
      data_envio: dados.dtaEnvio,
      data_fechamento: dados.dtaFechamento,
      protocolo: dados.protocolo,
      nfe_numero: dados.nfeNumero,
      numero_rps: dados.numeroRps,
      responsavel_fechamento: dados.responsavelFechamento,
    });
  }
  return lotes;
}

/** Lê os lotes no apLIS e sincroniza os títulos. Erros do Supabase sobem. */
export async function sincronizarTitulosAplis(supabase: SupabaseClient): Promise<ResultadoSincronizacaoTitulos> {
  const aplisIds = await aplisIdsDosLotes(supabase);
  const ids = aplisIds.map(idAplisNumerico).filter((id): id is number => id !== null);
  const aplis = await dadosDosLotes(ids);
  if ('erro' in aplis) return { erro: aplis.erro };

  const { data, error } = await supabase.rpc('fat_sincronizar_titulos_aplis', {
    p_lotes: lotesParaSincronizar(aplisIds, aplis.porLote),
  });
  if (error) throw new Error(`fat_sincronizar_titulos_aplis: ${error.message}`);
  const r = (data ?? {}) as Partial<Omit<ResumoSincronizacaoTitulos, 'lotes' | 'dadoAte'>>;
  return {
    lotes: aplisIds.length,
    lotesAtualizados: Number(r.lotesAtualizados ?? 0),
    statusMudaram: Number(r.statusMudaram ?? 0),
    numerosPreenchidos: Number(r.numerosPreenchidos ?? 0),
    refechamentos: r.refechamentos ?? [],
    dadoAte: aplis.dadoAte,
  };
}
