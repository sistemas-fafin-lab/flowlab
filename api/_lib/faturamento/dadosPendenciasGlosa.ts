// api/_lib/faturamento/dadosPendenciasGlosa.ts
// Leitura da foto do Supabase para as Pendências de glosa
// (.scratch/glosas-recursos-calendario-pendencias/issues/06): o card do
// Dashboard e os filtros de pendência das listas "Recursos fora de lote" e
// "Lotes de recurso" leem o mesmo universo, de todos os meses de faturamento,
// para a lista aberta pelo card bater com ele. O Aging da glosa em recurso
// (issue 07) lê os mesmos lotes. As regras são de faturamento/recursoGlosa.ts
// (pendenciasDeGlosa, agingDaGlosaEmRecurso); aqui só se lê.

import type { SupabaseClient } from '@supabase/supabase-js';
import { edicoesDaFoto, STATUS_GLOSA } from './recursoGlosa.js';
import type {
  LoteRecursoParaPendencia,
  RegraPrazo,
  RegrasPrazoLote,
  RequisicaoAging,
  RequisicaoPendenciaPrazo,
  TipoRegraPrazo,
} from './recursoGlosa.js';

/** Linhas por página do PostgREST (o teto padrão é 1000). */
const PAGINA_LEITURA = 1000;
/** Ids por `in(...)`: a lista vai na URL. */
const IDS_POR_CONSULTA = 200;

export class ErroLeituraPendencias extends Error {}

/** Filtros de pendência das listas, um por card. */
export type FiltroPendencia = 'vencidos' | 'retorno-atrasado' | 'pagamento-atrasado';

/** 'YYYY-MM-DD' de hoje no fuso do laboratório. */
export function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

/** `%` e `_` digitados são texto, não curinga do ILIKE. */
export function escaparIlike(termo: string): string {
  return termo.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function numeroOuNulo(valor: number | string | null): number | null {
  return valor === null ? null : Number(valor);
}

// ── Regras ──────────────────────────────────────────────────────────────────

interface LinhaRegraFonte {
  id_fonte_pagadora: number;
  glosa_prazo_regras: {
    glosa_recurso_tipo: TipoRegraPrazo;
    glosa_recurso_n: number | null;
    glosa_analise_tipo: TipoRegraPrazo;
    glosa_analise_n: number | null;
    glosa_pagamento_tipo: TipoRegraPrazo;
    glosa_pagamento_n: number | null;
  } | null;
}

export interface RegrasDasFontes {
  /** GLOSA – RECURSO de cada convênio com vínculo. */
  recurso: Map<number, RegraPrazo>;
  /** GLOSA – ANÁLISE e GLOSA – PAGAMENTO de cada convênio com vínculo. */
  lote: Map<number, RegrasPrazoLote>;
}

/** Regras de prazo dos convênios, lidas a cada consulta: uma regra alterada vale na próxima leitura. */
export async function lerRegrasDasFontes(supabase: SupabaseClient, fontes: number[]): Promise<RegrasDasFontes> {
  const regras: RegrasDasFontes = { recurso: new Map(), lote: new Map() };
  for (let i = 0; i < fontes.length; i += IDS_POR_CONSULTA) {
    const { data, error } = await supabase
      .from('glosa_prazo_regra_fontes')
      .select('id_fonte_pagadora, glosa_prazo_regras(glosa_recurso_tipo, glosa_recurso_n, glosa_analise_tipo, glosa_analise_n, glosa_pagamento_tipo, glosa_pagamento_n)')
      .in('id_fonte_pagadora', fontes.slice(i, i + IDS_POR_CONSULTA));
    if (error) throw new ErroLeituraPendencias(error.message);
    for (const f of (data ?? []) as unknown as LinhaRegraFonte[]) {
      const r = f.glosa_prazo_regras;
      if (!r) continue;
      regras.recurso.set(f.id_fonte_pagadora, { tipo: r.glosa_recurso_tipo, n: r.glosa_recurso_n });
      regras.lote.set(f.id_fonte_pagadora, {
        glosaAnalise: { tipo: r.glosa_analise_tipo, n: r.glosa_analise_n },
        glosaPagamento: { tipo: r.glosa_pagamento_tipo, n: r.glosa_pagamento_n },
      });
    }
  }
  return regras;
}

// ── Glosadas sem recurso fora de lote ───────────────────────────────────────

/** Linha da view glosa_recurso_requisicoes_lista como a sub-aba "Recursos fora de lote" a mostra. */
export interface LinhaForaDeLote {
  id_requisicao: number;
  cod_requisicao: string | null;
  num_guia: string | null;
  paciente: string | null;
  competencia: string;
  id_fonte_pagadora: number | null;
  fonte_pagadora_nome: string | null;
  status_aplis: number;
  glosa_fixada: number | string | null;
  valor_inicial_estimado: boolean;
  data_recebimento: string | null;
  procedimentos: string[] | null;
  motivos: string[] | null;
}

export const COLUNAS_FORA_DE_LOTE =
  'id_requisicao, cod_requisicao, num_guia, paciente, competencia, id_fonte_pagadora, fonte_pagadora_nome, status_aplis, glosa_fixada, valor_inicial_estimado, data_recebimento, procedimentos, motivos';

export interface RequisicaoForaDeLotePendencia extends RequisicaoPendenciaPrazo {
  linha: LinhaForaDeLote;
}

/**
 * Glosadas sem recurso (6) fora de qualquer lote de recurso, de todos os meses
 * de faturamento: o universo do card "Glosas sem recurso com prazo vencido".
 */
export async function lerGlosadasForaDeLote(
  supabase: SupabaseClient,
  filtros: { fontePagadoraId?: number; busca?: string },
): Promise<RequisicaoForaDeLotePendencia[]> {
  const requisicoes: RequisicaoForaDeLotePendencia[] = [];
  for (let de = 0; ; de += PAGINA_LEITURA) {
    let consulta = supabase
      .from('glosa_recurso_requisicoes_lista')
      .select(COLUNAS_FORA_DE_LOTE)
      .eq('status_aplis', STATUS_GLOSA.glosadoSemRecurso)
      .is('id_lote_recurso', null);
    if (filtros.fontePagadoraId !== undefined) consulta = consulta.eq('id_fonte_pagadora', filtros.fontePagadoraId);
    if (filtros.busca !== undefined) consulta = consulta.ilike('busca', `%${escaparIlike(filtros.busca)}%`);
    const { data, error } = await consulta.order('id_requisicao').range(de, de + PAGINA_LEITURA - 1);
    if (error) throw new ErroLeituraPendencias(error.message);
    const pagina = (data ?? []) as unknown as LinhaForaDeLote[];
    for (const l of pagina) {
      requisicoes.push({
        linha: l,
        fontePagadora: { id: l.id_fonte_pagadora },
        status: l.status_aplis,
        dataRecebimento: l.data_recebimento,
        glosaFixada: numeroOuNulo(l.glosa_fixada),
        emLoteRecurso: false,
      });
    }
    if (pagina.length < PAGINA_LEITURA) return requisicoes;
  }
}

// ── Lotes de recurso ────────────────────────────────────────────────────────

/** Linha da view glosa_recurso_lotes_lista como a lista "Lotes de recurso" a mostra. */
export interface LinhaLoteRecurso {
  id_lote_recurso: number;
  status_label: string;
  protocolo: string | null;
  protocolo_faturamento: string | null;
  id_fonte_pagadora: number | null;
  fonte_pagadora_nome: string | null;
  data_criacao_aplis: string | null;
  data_envio_aplis: string | null;
  /** Editada (lápis) ou do apLIS. */
  data_envio: string | null;
  data_envio_editada: boolean;
  data_retorno_real: string | null;
  data_pagamento_real: string | null;
  fontes_requisicoes: (number | null)[] | null;
  qtd_requisicoes: number;
  valor_glosado: number | string;
  valor_recorrido: number | string;
}

export const COLUNAS_LOTE_RECURSO =
  'id_lote_recurso, status_label, protocolo, protocolo_faturamento, id_fonte_pagadora, fonte_pagadora_nome, data_criacao_aplis, data_envio_aplis, data_envio, data_envio_editada, data_retorno_real, data_pagamento_real, fontes_requisicoes, qtd_requisicoes, valor_glosado, valor_recorrido';

/** Requisição de um lote, em qualquer mês: o selo e os prazos olham o lote inteiro. */
interface LinhaRequisicaoLote {
  id_lote_recurso: number;
  id_fonte_pagadora: number | null;
  fonte_pagadora_nome: string | null;
  status_aplis: number | null;
  liquido: number | string;
  recebido: number | string;
  recebido_fixacao: number | string | null;
  valor_recursado: number | string | null;
  valor_recursado_editado: number | string | null;
  valor_recebido_glosa_editado: number | string | null;
}

/**
 * Fontes que podem dar a regra do lote: a do lote e, depois, as das
 * requisições (os dois cadastros do Bradesco podem divergir entre lote e
 * requisição, e só um deles estar ligado à regra).
 */
export function fontesDoLote(l: LinhaLoteRecurso): number[] {
  return [l.id_fonte_pagadora, ...(l.fontes_requisicoes ?? [])].filter((f): f is number => f !== null);
}

/** A regra da primeira fonte do lote que tem regra ligada; null: nenhuma. */
export function regrasDoLote(l: LinhaLoteRecurso, regras: Map<number, RegrasPrazoLote>): RegrasPrazoLote | null {
  const fonte = fontesDoLote(l).find((f) => regras.has(f));
  return fonte === undefined ? null : regras.get(fonte) ?? null;
}

/**
 * Requisições dos lotes, classificáveis (edições do lápis valendo acima do
 * apLIS), com a fonte pagadora, agrupadas por lote. `enviados`: lotes com data de envio.
 */
export async function requisicoesDosLotes(
  supabase: SupabaseClient,
  idsLotes: number[],
  enviados: Set<number>,
): Promise<Map<number, RequisicaoAging[]>> {
  const porLote = new Map<number, RequisicaoAging[]>();
  for (let i = 0; i < idsLotes.length; i += IDS_POR_CONSULTA) {
    const ids = idsLotes.slice(i, i + IDS_POR_CONSULTA);
    for (let de = 0; ; de += PAGINA_LEITURA) {
      const { data, error } = await supabase
        .from('glosa_recurso_requisicoes')
        .select('id_lote_recurso, id_fonte_pagadora, fonte_pagadora_nome, status_aplis, liquido, recebido, recebido_fixacao, valor_recursado, valor_recursado_editado, valor_recebido_glosa_editado')
        .in('id_lote_recurso', ids)
        .order('id_requisicao')
        .range(de, de + PAGINA_LEITURA - 1);
      if (error) throw new ErroLeituraPendencias(error.message);
      const pagina = (data ?? []) as LinhaRequisicaoLote[];
      for (const r of pagina) {
        const lista = porLote.get(r.id_lote_recurso) ?? [];
        lista.push({
          fontePagadora: { id: r.id_fonte_pagadora, nome: r.fonte_pagadora_nome },
          foto: {
            status: r.status_aplis,
            liquido: Number(r.liquido),
            recebido: Number(r.recebido),
            recebidoFixacao: numeroOuNulo(r.recebido_fixacao),
            valorRecursado: numeroOuNulo(r.valor_recursado),
            emLoteRecurso: true,
            loteEnviado: enviados.has(r.id_lote_recurso),
          },
          edicoes: edicoesDaFoto({
            valorRecursado: numeroOuNulo(r.valor_recursado_editado),
            valorRecebidoGlosa: numeroOuNulo(r.valor_recebido_glosa_editado),
          }),
        });
        porLote.set(r.id_lote_recurso, lista);
      }
      if (pagina.length < PAGINA_LEITURA) break;
    }
  }
  return porLote;
}

export interface LoteRecursoPendencia extends LoteRecursoParaPendencia<RequisicaoAging> {
  linha: LinhaLoteRecurso;
}

/**
 * Lotes de recurso enviados, de todos os meses de faturamento, com as
 * requisições e as regras do convênio: o universo dos cards de retorno e de
 * pagamento atrasado. Lote sem data de envio não entra, salvo com
 * `incluirNaoEnviados` (o Aging da glosa em recurso, que o põe fora das faixas).
 */
export async function lerLotesEnviados(
  supabase: SupabaseClient,
  filtros: { fontePagadoraId?: number; status?: string; busca?: string; incluirNaoEnviados?: boolean },
): Promise<LoteRecursoPendencia[]> {
  const linhas: LinhaLoteRecurso[] = [];
  for (let de = 0; ; de += PAGINA_LEITURA) {
    let consulta = supabase
      .from('glosa_recurso_lotes_lista')
      .select(COLUNAS_LOTE_RECURSO);
    if (!filtros.incluirNaoEnviados) consulta = consulta.not('data_envio', 'is', null);
    // Fonte da requisição, não do lote: é o mesmo recorte da lista de lotes.
    if (filtros.fontePagadoraId !== undefined) consulta = consulta.contains('fontes_requisicoes', [filtros.fontePagadoraId]);
    if (filtros.status !== undefined) consulta = consulta.eq('status_label', filtros.status);
    if (filtros.busca !== undefined) consulta = consulta.ilike('busca', `%${escaparIlike(filtros.busca)}%`);
    const { data, error } = await consulta.order('id_lote_recurso').range(de, de + PAGINA_LEITURA - 1);
    if (error) throw new ErroLeituraPendencias(error.message);
    const pagina = (data ?? []) as unknown as LinhaLoteRecurso[];
    linhas.push(...pagina);
    if (pagina.length < PAGINA_LEITURA) break;
  }

  const ids = linhas.map((l) => l.id_lote_recurso);
  const [porLote, regras] = await Promise.all([
    requisicoesDosLotes(supabase, ids, new Set(linhas.filter((l) => l.data_envio !== null).map((l) => l.id_lote_recurso))),
    lerRegrasDasFontes(supabase, [...new Set(linhas.flatMap(fontesDoLote))]),
  ]);
  return linhas.map((linha) => ({
    linha,
    dataEnvio: linha.data_envio,
    dataRetornoReal: linha.data_retorno_real,
    regras: regrasDoLote(linha, regras.lote),
    requisicoes: porLote.get(linha.id_lote_recurso) ?? [],
  }));
}

