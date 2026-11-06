// api/_lib/faturamento/dadosFunilGlosa.ts
// Leitura dos dados do funil de glosa da aba Comparativos
// (.scratch/faturamento-comparativos/issues/04-funil-de-glosa-por-competencia.md).
// Lido com o cliente do USUÁRIO, para respeitar a RLS. O cálculo é puro, em
// src/modules/faturamento/utils/funilGlosa.ts.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GlosaFunil, LoteRef, TituloFunil } from '../../../src/modules/faturamento/utils/funilGlosa.js';
import { edicoesDaFoto } from './recursoGlosa.js';
import { classificarParaFunil } from './glosaRecuperada.js';
import { ErroSupabase, valorNumerico } from './titulosConferencia.js';

const PAGINA = 1000;
/** Ids por consulta `.in()`: a lista vai na URL do PostgREST. */
const LOTE_IN = 150;

function emBlocos<T>(itens: T[], tamanho: number): T[][] {
  const blocos: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) blocos.push(itens.slice(i, i + tamanho));
  return blocos;
}

const numeroOuNulo = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

interface LinhaNota {
  id_nota: string;
  data_emissao: string | null;
  valor_total: unknown;
  valor_recebido: unknown;
  operadoras: { is_considerada_meta: boolean | null } | null;
  nota_lote: { lotes: { id_lote: string; codigo_lote: string | null; aplis_id: string | null } | null }[] | null;
}

/**
 * Títulos não cancelados emitidos entre `desde` e `ate` (YYYY-MM-DD), de operadoras
 * consideradas na meta — o mesmo universo do Dashboard. `loteDoAplis` liga o
 * `lotes.aplis_id` de cada lote ao lote do Supabase, para casar a foto de recursos.
 */
export async function titulosParaFunil(
  supabase: SupabaseClient,
  desde: string,
  ate: string,
): Promise<{ titulos: TituloFunil[]; loteDoAplis: Map<number, LoteRef> }> {
  const titulos: TituloFunil[] = [];
  const loteDoAplis = new Map<number, LoteRef>();
  for (let offset = 0; ; offset += PAGINA) {
    const { data, error } = await supabase
      .from('notas')
      .select(
        'id_nota, data_emissao, valor_total, valor_recebido, operadoras(is_considerada_meta), '
        + 'nota_lote(lotes(id_lote, codigo_lote, aplis_id))',
      )
      .neq('status', 'cancelada')
      .gte('data_emissao', desde)
      .lte('data_emissao', ate)
      .order('id_nota', { ascending: true })
      .range(offset, offset + PAGINA - 1);
    if (error) throw new ErroSupabase(`notas: ${error.message}`);
    const pagina = (data ?? []) as unknown as LinhaNota[];
    for (const nota of pagina) {
      if (nota.operadoras?.is_considerada_meta !== true) continue;
      const lotes: LoteRef[] = [];
      for (const { lotes: lote } of nota.nota_lote ?? []) {
        if (!lote) continue;
        const ref = { id: lote.id_lote, codigo: lote.codigo_lote };
        lotes.push(ref);
        const aplisId = Number(lote.aplis_id ?? NaN);
        if (Number.isInteger(aplisId) && aplisId > 0) loteDoAplis.set(aplisId, ref);
      }
      titulos.push({
        idNota: nota.id_nota,
        dataEmissao: nota.data_emissao,
        valorTotal: valorNumerico(nota.valor_total),
        valorRecebido: valorNumerico(nota.valor_recebido),
        lotes,
      });
    }
    if (pagina.length < PAGINA) break;
  }
  return { titulos, loteDoAplis };
}

interface LinhaFoto {
  id_requisicao: number;
  id_lote_faturamento: number;
  competencia: string;
  status_aplis: number | null;
  liquido: unknown;
  recebido: unknown;
  glosa_fixada: unknown;
  recebido_fixacao: unknown;
  valor_recursado: unknown;
  valor_recursado_editado: unknown;
  valor_recebido_glosa_editado: unknown;
  id_lote_recurso: number | null;
  glosa_recurso_lotes: { data_envio_aplis: string | null; data_envio_editada: string | null } | null;
}

const COLUNAS_FOTO =
  'id_requisicao, id_lote_faturamento, competencia, status_aplis, liquido, recebido, glosa_fixada, '
  + 'recebido_fixacao, valor_recursado, valor_recursado_editado, valor_recebido_glosa_editado, '
  + 'id_lote_recurso, glosa_recurso_lotes(data_envio_aplis, data_envio_editada)';

async function lerFoto(supabase: SupabaseClient, coluna: string, valores: (string | number)[]): Promise<LinhaFoto[]> {
  const linhas: LinhaFoto[] = [];
  for (let offset = 0; ; offset += PAGINA) {
    const { data, error } = await supabase
      .from('glosa_recurso_requisicoes')
      .select(COLUNAS_FOTO)
      .in(coluna, valores)
      .order('id_requisicao', { ascending: true })
      .range(offset, offset + PAGINA - 1);
    if (error) throw new ErroSupabase(`glosa_recurso_requisicoes: ${error.message}`);
    const pagina = (data ?? []) as unknown as LinhaFoto[];
    linhas.push(...pagina);
    if (pagina.length < PAGINA) return linhas;
  }
}

/**
 * Acatada, em disputa e recuperada da foto de recursos do apLIS, uma entrada por requisição
 * (classificação em glosaRecuperada.ts). Lê as requisições dos lotes dos títulos e, à parte, as
 * dos meses comparados (`competencias`, YYYY-MM do lote no apLIS) cujo lote não tem título aqui:
 * essas vão para "Fora de lote".
 */
export async function glosasParaFunil(
  supabase: SupabaseClient,
  loteDoAplis: Map<number, LoteRef>,
  competencias: string[],
): Promise<GlosaFunil[]> {
  const porRequisicao = new Map<number, LinhaFoto>();
  for (const bloco of emBlocos([...loteDoAplis.keys()], LOTE_IN * 2)) {
    for (const l of await lerFoto(supabase, 'id_lote_faturamento', bloco)) porRequisicao.set(l.id_requisicao, l);
  }
  for (const l of await lerFoto(supabase, 'competencia', competencias)) {
    if (!loteDoAplis.has(l.id_lote_faturamento)) porRequisicao.set(l.id_requisicao, l);
  }

  const glosas: GlosaFunil[] = [];
  for (const l of porRequisicao.values()) {
    const classificada = classificarParaFunil(
      {
        foto: {
          status: l.status_aplis,
          liquido: valorNumerico(l.liquido),
          recebido: valorNumerico(l.recebido),
          recebidoFixacao: numeroOuNulo(l.recebido_fixacao),
          valorRecursado: numeroOuNulo(l.valor_recursado),
          emLoteRecurso: l.id_lote_recurso !== null,
          loteEnviado: Boolean(l.glosa_recurso_lotes?.data_envio_editada ?? l.glosa_recurso_lotes?.data_envio_aplis),
        },
        edicoes: edicoesDaFoto({
          valorRecursado: numeroOuNulo(l.valor_recursado_editado),
          valorRecebidoGlosa: numeroOuNulo(l.valor_recebido_glosa_editado),
        }),
      },
      numeroOuNulo(l.glosa_fixada),
    );
    if (!classificada || classificada.valor === 0) continue;
    glosas.push({ lote: loteDoAplis.get(l.id_lote_faturamento) ?? null, competencia: l.competencia, ...classificada });
  }
  return glosas;
}

/** `operadoras.aplis_id` (= `IdFontePagadora`) das operadoras consideradas na meta, para o caixa. */
export async function fontesDaMeta(supabase: SupabaseClient): Promise<Set<number>> {
  const { data, error } = await supabase.from('operadoras').select('aplis_id').eq('is_considerada_meta', true);
  if (error) throw new ErroSupabase(`operadoras: ${error.message}`);
  const ids = new Set<number>();
  for (const { aplis_id: bruto } of (data ?? []) as { aplis_id: string | number | null }[]) {
    const id = Number(bruto ?? NaN);
    if (Number.isInteger(id) && id > 0) ids.add(id);
  }
  return ids;
}
