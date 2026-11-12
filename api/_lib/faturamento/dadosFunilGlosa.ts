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
/** Ids inteiros (lote do apLIS) por consulta `.in()`: a lista vai na URL do PostgREST. */
const IDS_POR_IN = 300;
/** UUIDs (36 caracteres) por consulta `.in()`, pelo mesmo limite de URL. */
const UUIDS_POR_IN = 100;

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
  valor_glosa_acatada: unknown;
  operadoras: { is_considerada_meta: boolean | null } | null;
  nota_lote: { lotes: { id_lote: string; codigo_lote: string | null; aplis_id: string | null } | null }[] | null;
}

/**
 * Títulos não cancelados emitidos entre `desde` e `ate` (YYYY-MM-DD), de operadoras
 * consideradas na meta — o mesmo universo do Dashboard. `operadoraIds` (`notas.operadora_id`)
 * recorta pelas operadoras do filtro do Dashboard; vazio = todas. `loteDoAplis` liga o
 * `lotes.aplis_id` de cada lote ao lote do Supabase, para casar a foto de recursos.
 */
export async function titulosParaFunil(
  supabase: SupabaseClient,
  desde: string,
  ate: string,
  operadoraIds: string[] = [],
): Promise<{ titulos: TituloFunil[]; loteDoAplis: Map<number, LoteRef> }> {
  const titulos: TituloFunil[] = [];
  const loteDoAplis = new Map<number, LoteRef>();
  for (let offset = 0; ; offset += PAGINA) {
    let consulta = supabase
      .from('notas')
      .select(
        'id_nota, data_emissao, valor_total, valor_recebido, valor_glosa_acatada, operadoras(is_considerada_meta), '
        + 'nota_lote(lotes(id_lote, codigo_lote, aplis_id))',
      )
      .neq('status', 'cancelada')
      .gte('data_emissao', desde)
      .lte('data_emissao', ate);
    if (operadoraIds.length > 0) consulta = consulta.in('operadora_id', operadoraIds);
    const { data, error } = await consulta
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
        valorGlosaAcatada: valorNumerico(nota.valor_glosa_acatada),
        lotes,
      });
    }
    if (pagina.length < PAGINA) break;
  }
  return { titulos, loteDoAplis };
}

interface LinhaFoto {
  id_requisicao: number;
  cod_requisicao?: string | null;
  num_guia?: string | null;
  fonte_pagadora_nome?: string | null;
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
  id_fonte_pagadora: number | null;
  id_lote_recurso: number | null;
  glosa_recurso_lotes: { data_envio_aplis: string | null; data_envio_editada: string | null } | null;
}

// Sem `paciente`: nenhuma tela dos Comparativos mostra nome de paciente.
const COLUNAS_FOTO =
  'id_requisicao, cod_requisicao, num_guia, fonte_pagadora_nome, id_lote_faturamento, competencia, '
  + 'status_aplis, liquido, recebido, glosa_fixada, '
  + 'recebido_fixacao, valor_recursado, valor_recursado_editado, valor_recebido_glosa_editado, '
  + 'id_fonte_pagadora, id_lote_recurso, glosa_recurso_lotes(data_envio_aplis, data_envio_editada)';

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

interface LinhaLote {
  id_lote: string;
  codigo_lote: string | null;
  aplis_id: string | null;
  nota_lote: { notas: { data_emissao: string | null; status: string | null } | null }[] | null;
}

/** Lotes do Supabase com a data de emissão de todos os títulos deles, de qualquer mês. */
async function lerLotes(supabase: SupabaseClient, coluna: 'id_lote' | 'aplis_id', valores: string[]): Promise<LinhaLote[]> {
  const linhas: LinhaLote[] = [];
  for (const bloco of emBlocos(valores, coluna === 'id_lote' ? UUIDS_POR_IN : IDS_POR_IN)) {
    const { data, error } = await supabase
      .from('lotes')
      .select('id_lote, codigo_lote, aplis_id, nota_lote(notas(data_emissao, status))')
      .in(coluna, bloco);
    if (error) throw new ErroSupabase(`lotes: ${error.message}`);
    linhas.push(...((data ?? []) as unknown as LinhaLote[]));
  }
  return linhas;
}

/** Emissão (YYYY-MM-DD) do título não cancelado mais antigo do lote; null sem título. */
function primeiraEmissao(lote: LinhaLote): string | null {
  let maisAntiga: string | null = null;
  for (const { notas } of lote.nota_lote ?? []) {
    if (!notas?.data_emissao || notas.status === 'cancelada') continue;
    if (maisAntiga === null || notas.data_emissao < maisAntiga) maisAntiga = notas.data_emissao;
  }
  return maisAntiga;
}

/** Glosa do funil com a identificação da requisição, para o ranking de códigos (issue 05). */
export interface GlosaFunilDetalhada extends GlosaFunil {
  idRequisicao: number;
  codRequisicao: string | null;
  numGuia: string | null;
  convenio: string | null;
  statusAplis: number | null;
  /** `id_lote_faturamento` do apLIS; mostrado quando o lote não tem título no Supabase. */
  idLoteFaturamento: number;
}

/**
 * Acatada, em disputa e recuperada da foto de recursos do apLIS, uma entrada por requisição
 * (classificação em glosaRecuperada.ts). Lê as requisições dos lotes dos títulos e, à parte, as
 * dos meses comparados (`competencias`, YYYY-MM do lote no apLIS) das operadoras da meta
 * (`fontesMeta`) cujo lote não veio com os títulos. Dessas, o lote que tem título (não
 * cancelado) em outro mês fica com o lote; só o que não tem título vai para "Fora de lote".
 *
 * Devolve também a emissão mais antiga de cada lote, em qualquer data: a glosa vai para o mês
 * dela, mesmo quando o título mais antigo está fora dos 3 meses.
 */
export async function glosasParaFunil(
  supabase: SupabaseClient,
  titulos: TituloFunil[],
  loteDoAplis: Map<number, LoteRef>,
  competencias: string[],
  fontesMeta: Set<number>,
): Promise<{ glosas: GlosaFunilDetalhada[]; primeiraEmissaoDoLote: Map<string, string> }> {
  const primeiraEmissaoDoLote = new Map<string, string>();
  const idsDosTitulos = [...new Set(titulos.flatMap((t) => t.lotes.map((l) => l.id)))];
  for (const lote of await lerLotes(supabase, 'id_lote', idsDosTitulos)) {
    const emissao = primeiraEmissao(lote);
    if (emissao) primeiraEmissaoDoLote.set(lote.id_lote, emissao);
  }

  const porRequisicao = new Map<number, LinhaFoto>();
  for (const bloco of emBlocos([...loteDoAplis.keys()], IDS_POR_IN)) {
    for (const l of await lerFoto(supabase, 'id_lote_faturamento', bloco)) porRequisicao.set(l.id_requisicao, l);
  }
  const loteDaFoto = new Map(loteDoAplis);
  const avulsas = (await lerFoto(supabase, 'competencia', competencias)).filter(
    (l) => !loteDoAplis.has(l.id_lote_faturamento) && l.id_fonte_pagadora !== null && fontesMeta.has(l.id_fonte_pagadora),
  );
  const semTitulo = [...new Set(avulsas.map((l) => String(l.id_lote_faturamento)))];
  for (const lote of await lerLotes(supabase, 'aplis_id', semTitulo)) {
    const emissao = primeiraEmissao(lote);
    const aplisId = Number(lote.aplis_id ?? NaN);
    if (!emissao || !Number.isInteger(aplisId)) continue;
    loteDaFoto.set(aplisId, { id: lote.id_lote, codigo: lote.codigo_lote });
    primeiraEmissaoDoLote.set(lote.id_lote, emissao);
  }
  for (const l of avulsas) porRequisicao.set(l.id_requisicao, l);

  const glosas: GlosaFunilDetalhada[] = [];
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
    glosas.push({
      lote: loteDaFoto.get(l.id_lote_faturamento) ?? null,
      competencia: l.competencia,
      ...classificada,
      idRequisicao: l.id_requisicao,
      codRequisicao: l.cod_requisicao ?? null,
      numGuia: l.num_guia ?? null,
      convenio: l.fonte_pagadora_nome ?? null,
      statusAplis: l.status_aplis,
      idLoteFaturamento: l.id_lote_faturamento,
    });
  }
  return { glosas, primeiraEmissaoDoLote };
}

/**
 * `operadoras.aplis_id` (= `IdFontePagadora`) das operadoras consideradas na meta, para o caixa.
 * `operadoraIds` (`operadoras.id_operadora`) recorta pelo filtro do Dashboard; vazio = todas.
 */
export async function fontesDaMeta(supabase: SupabaseClient, operadoraIds: string[] = []): Promise<Set<number>> {
  let consulta = supabase.from('operadoras').select('aplis_id').eq('is_considerada_meta', true);
  if (operadoraIds.length > 0) consulta = consulta.in('id_operadora', operadoraIds);
  const { data, error } = await consulta;
  if (error) throw new ErroSupabase(`operadoras: ${error.message}`);
  const ids = new Set<number>();
  for (const { aplis_id: bruto } of (data ?? []) as { aplis_id: string | number | null }[]) {
    const id = Number(bruto ?? NaN);
    if (Number.isInteger(id) && id > 0) ids.add(id);
  }
  return ids;
}
