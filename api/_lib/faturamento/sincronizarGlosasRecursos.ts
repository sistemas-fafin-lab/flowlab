/**
 * Sincronização da foto de glosas e recursos com o apLIS
 * (.scratch/glosas-recursos-dashboard/spec.md), de um mês de faturamento e,
 * opcionalmente, de um convênio. Usada pelo botão "Atualizar"
 * (handlers/faturamento-glosas-recursos-sincronizar) e pela rotina diária
 * (handlers/faturamento-glosas-recursos-cron).
 *
 * Carga inicial: a requisição que entra na foto sem nenhuma sincronização
 * anterior do mesmo mês que cubra o convênio dela (todos ou o dela) ganha a
 * marca de "valor inicial estimado" — a foto pode ter sido tirada depois do
 * envio do recurso. A mesma marca vale para a requisição que entra já num
 * lote de recurso enviado.
 *
 * Histórico: a foto anterior de cada requisição e de cada lote é comparada
 * com a nova (recursoGlosa.eventosDaRequisicao / eventosDoLote) e os eventos
 * vão para glosa_recurso_historico, antes da foto: uma falha no meio repete
 * eventos na próxima sincronização em vez de perdê-los.
 *
 * Edições manuais (lápis, glosas-recursos-editar): moram em colunas próprias
 * da foto (`*_editada`, `*_editado`) que o upsert não manda, então a
 * sincronização não as sobrescreve. O campo editado também não gera evento —
 * o valor do apLIS é ignorado nele.
 *
 * Fonte do apLIS: MySQL de backup, ~1 dia de atraso; `dadoAte` diz até
 * quando. Falha na réplica → erro, sem gravar nada.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { glosasRecursosDoPeriodo } from './bdLab.js';
import type { LoteRecursoAplis, RequisicaoGlosaRecursoAplis } from './bdLab.js';
import { eventosDaRequisicao, eventosDoLote, fixarGlosa } from './recursoGlosa.js';
import type {
  EventoHistorico,
  FotoHistoricoLote,
  FotoHistoricoRequisicao,
  GlosaFixada,
} from './recursoGlosa.js';

/** Ids por `.in()` / linhas por upsert: o maior mês de 2026 tem ~700 requisições. */
const BLOCO = 500;

interface RequisicaoGravada {
  id_requisicao: number;
  status_aplis: number | null;
  recebido: number | string;
  id_lote_recurso: number | null;
  glosa_fixada: number | string | null;
  recebido_fixacao: number | string | null;
  valor_inicial_estimado: boolean;
  valor_recebido_glosa_editado: number | string | null;
}

class ErroGravacao extends Error {}

function blocos<T>(itens: T[]): T[][] {
  const saida: T[][] = [];
  for (let i = 0; i < itens.length; i += BLOCO) saida.push(itens.slice(i, i + BLOCO));
  return saida;
}

/** DECIMAL volta como string do PostgREST. */
function numeroOuNulo(valor: number | string | null): number | null {
  return valor === null ? null : Number(valor);
}

interface RequisicaoAnterior {
  fixacao: GlosaFixada;
  historico: FotoHistoricoRequisicao;
  recebidoGlosaEditado: boolean;
}

interface LoteAnterior {
  historico: FotoHistoricoLote;
  /** Data de envio corrigida pelo lápis; null sem edição. */
  envioEditado: string | null;
}

async function requisicoesGravadas(
  supabase: SupabaseClient,
  ids: number[],
): Promise<Map<number, RequisicaoAnterior>> {
  const porId = new Map<number, RequisicaoAnterior>();
  for (const bloco of blocos(ids)) {
    const { data, error } = await supabase
      .from('glosa_recurso_requisicoes')
      .select('id_requisicao, status_aplis, recebido, id_lote_recurso, glosa_fixada, recebido_fixacao, valor_inicial_estimado, valor_recebido_glosa_editado')
      .in('id_requisicao', bloco);
    if (error) throw new ErroGravacao(`foto das requisições: ${error.message}`);
    for (const linha of (data ?? []) as RequisicaoGravada[]) {
      porId.set(Number(linha.id_requisicao), {
        fixacao: {
          glosaFixada: numeroOuNulo(linha.glosa_fixada),
          recebidoFixacao: numeroOuNulo(linha.recebido_fixacao),
          valorInicialEstimado: Boolean(linha.valor_inicial_estimado),
        },
        historico: {
          status: linha.status_aplis,
          recebido: Number(linha.recebido),
          idLoteRecurso: linha.id_lote_recurso,
        },
        recebidoGlosaEditado: (linha.valor_recebido_glosa_editado ?? null) !== null,
      });
    }
  }
  return porId;
}

async function lotesGravados(
  supabase: SupabaseClient,
  ids: number[],
): Promise<Map<number, LoteAnterior>> {
  const porId = new Map<number, LoteAnterior>();
  for (const bloco of blocos(ids)) {
    const { data, error } = await supabase
      .from('glosa_recurso_lotes')
      .select('id_lote_recurso, data_envio_aplis, data_envio_editada')
      .in('id_lote_recurso', bloco);
    if (error) throw new ErroGravacao(`foto dos lotes: ${error.message}`);
    type Linha = { id_lote_recurso: number; data_envio_aplis: string | null; data_envio_editada?: string | null };
    for (const linha of (data ?? []) as Linha[]) {
      porId.set(Number(linha.id_lote_recurso), {
        historico: { idLoteRecurso: Number(linha.id_lote_recurso), dataEnvio: linha.data_envio_aplis },
        envioEditado: linha.data_envio_editada ?? null,
      });
    }
  }
  return porId;
}

/** Eventos da sincronização, comparando a foto gravada com o apLIS de agora. */
function eventosDaSincronizacao(
  aplis: { requisicoes: RequisicaoGlosaRecursoAplis[]; lotesRecurso: LoteRecursoAplis[] },
  requisicoesAnteriores: Map<number, RequisicaoAnterior>,
  lotesAnteriores: Map<number, LoteAnterior>,
  agora: string,
): Record<string, unknown>[] {
  const paraLinhaHistorico = (idRequisicao: number | null, idLoteRecurso: number | null) => (e: EventoHistorico) => ({
    id_requisicao: idRequisicao,
    id_lote_recurso: idLoteRecurso,
    tipo: e.tipo,
    valor_anterior: e.valorAnterior,
    valor_novo: e.valorNovo,
    descricao: e.descricao,
    ocorrido_em: agora,
    usuario_id: null,
  });

  // Lote com alguma requisição já acompanhada: não é carga inicial.
  const lotesAcompanhados = new Set(
    aplis.requisicoes
      .filter((r) => r.idLoteRecurso !== null && requisicoesAnteriores.has(r.idRequisicao))
      .map((r) => r.idLoteRecurso),
  );
  const doLote = aplis.lotesRecurso.flatMap((lote) => {
    const anterior = lotesAnteriores.get(lote.idLoteRecurso);
    return eventosDoLote(
      anterior?.historico ?? null,
      { idLoteRecurso: lote.idLoteRecurso, dataEnvio: lote.dtaEnvio },
      { acompanhado: lotesAcompanhados.has(lote.idLoteRecurso), envioEditado: Boolean(anterior?.envioEditado) },
    ).map(paraLinhaHistorico(null, lote.idLoteRecurso));
  });
  const daRequisicao = aplis.requisicoes.flatMap((r) => {
    const anterior = requisicoesAnteriores.get(r.idRequisicao);
    return eventosDaRequisicao(
      anterior?.historico ?? null,
      { status: r.status, recebido: r.recebido, idLoteRecurso: r.idLoteRecurso },
      { recebidoGlosaEditado: anterior?.recebidoGlosaEditado },
    ).map(paraLinhaHistorico(r.idRequisicao, r.idLoteRecurso));
  });
  return [...doLote, ...daRequisicao];
}

/** Convênios já cobertos por uma sincronização do mês; `null` no conjunto = todos. */
async function conveniosSincronizados(
  supabase: SupabaseClient,
  competencia: string,
): Promise<Set<number | null>> {
  const { data, error } = await supabase
    .from('glosa_recurso_sincronizacoes')
    .select('id_fonte_pagadora')
    .eq('competencia', competencia);
  if (error) throw new ErroGravacao(`sincronizações: ${error.message}`);
  return new Set(((data ?? []) as { id_fonte_pagadora: number | null }[]).map((s) => s.id_fonte_pagadora));
}

async function gravarEmBlocos(
  supabase: SupabaseClient,
  tabela: string,
  linhas: Record<string, unknown>[],
  onConflict: string,
): Promise<void> {
  for (const bloco of blocos(linhas)) {
    const { error } = await supabase.from(tabela).upsert(bloco, { onConflict });
    if (error) throw new ErroGravacao(`${tabela}: ${error.message}`);
  }
}

function linhaLote(lote: LoteRecursoAplis, agora: string): Record<string, unknown> {
  return {
    id_lote_recurso: lote.idLoteRecurso,
    status_aplis: lote.status,
    status_label: lote.statusLabel,
    protocolo: lote.protocolo,
    protocolo_faturamento: lote.protocoloFaturamento,
    id_fonte_pagadora: lote.fontePagadora.id,
    fonte_pagadora_nome: lote.fontePagadora.nome,
    data_criacao_aplis: lote.dtaCriacao,
    data_envio_aplis: lote.dtaEnvio,
    data_finalizacao_aplis: lote.dtaFinalizacao,
    data_cancelamento_aplis: lote.dtaCancelamento,
    ultima_sincronizacao: agora,
  };
}

function linhaRequisicao(
  req: RequisicaoGlosaRecursoAplis,
  fixacao: GlosaFixada,
  agora: string,
): Record<string, unknown> {
  return {
    id_requisicao: req.idRequisicao,
    cod_requisicao: req.codRequisicao,
    num_guia: req.numGuia,
    paciente: req.paciente,
    id_lote_faturamento: req.idLoteFaturamento,
    competencia: req.competencia,
    id_fonte_pagadora: req.fontePagadora.id,
    fonte_pagadora_nome: req.fontePagadora.nome,
    id_lote_recurso: req.idLoteRecurso,
    status_aplis: req.status,
    liquido: req.liquido,
    recebido: req.recebido,
    valor_recursado: req.recursado,
    glosa_fixada: fixacao.glosaFixada,
    recebido_fixacao: fixacao.recebidoFixacao,
    valor_inicial_estimado: fixacao.valorInicialEstimado,
    ultima_sincronizacao: agora,
  };
}

export interface RecorteSincronizacao {
  /** 'YYYY-MM' do lote de faturamento original, já validado. */
  competencia: string;
  /** fatinstituicao.IdInstituicao; sem = todos. */
  fontePagadoraId?: number;
  /** Quem pediu; null na rotina diária. */
  usuarioId: string | null;
}

export type ResultadoSincronizacao =
  | { dadoAte: string | null; sincronizadoEm: string; requisicoes: number; lotes: number }
  | { erro: { status: number; mensagem: string } };

/** Lê o recorte do apLIS e grava a foto e o histórico. Erros inesperados sobem. */
export async function sincronizarRecorte(
  supabase: SupabaseClient,
  { competencia, fontePagadoraId, usuarioId }: RecorteSincronizacao,
): Promise<ResultadoSincronizacao> {
  const aplis = await glosasRecursosDoPeriodo({ competencia, fontePagadoraId });
  if ('erro' in aplis) return { erro: aplis.erro };

  const agora = new Date().toISOString();

  try {
    const anteriores = await requisicoesGravadas(supabase, aplis.requisicoes.map((r) => r.idRequisicao));
    const lotesAnteriores = await lotesGravados(supabase, aplis.lotesRecurso.map((l) => l.idLoteRecurso));
    const cobertos = await conveniosSincronizados(supabase, competencia);
    const cargaInicial = (r: RequisicaoGlosaRecursoAplis): boolean =>
      !cobertos.has(null) && !cobertos.has(r.fontePagadora.id);
    // Enviado pelo apLIS ou pela data de envio editada.
    const lotesEnviados = new Set(
      aplis.lotesRecurso
        .filter((l) => l.dtaEnvio !== null || Boolean(lotesAnteriores.get(l.idLoteRecurso)?.envioEditado))
        .map((l) => l.idLoteRecurso),
    );

    const eventos = eventosDaSincronizacao(aplis, anteriores, lotesAnteriores, agora);
    for (const bloco of blocos(eventos)) {
      const { error } = await supabase.from('glosa_recurso_historico').insert(bloco);
      if (error) throw new ErroGravacao(`glosa_recurso_historico: ${error.message}`);
    }

    // Lotes antes das requisições: id_lote_recurso é chave estrangeira.
    await gravarEmBlocos(
      supabase,
      'glosa_recurso_lotes',
      aplis.lotesRecurso.map((lote) => linhaLote(lote, agora)),
      'id_lote_recurso',
    );
    await gravarEmBlocos(
      supabase,
      'glosa_recurso_requisicoes',
      aplis.requisicoes.map((r) => linhaRequisicao(
        r,
        fixarGlosa(r, anteriores.get(r.idRequisicao)?.fixacao ?? null, {
          cargaInicial: cargaInicial(r),
          recursoEnviado: r.idLoteRecurso !== null && lotesEnviados.has(r.idLoteRecurso),
        }),
        agora,
      )),
      'id_requisicao',
    );

    const { error } = await supabase.from('glosa_recurso_sincronizacoes').insert({
      competencia,
      id_fonte_pagadora: fontePagadoraId ?? null,
      sincronizado_em: agora,
      sincronizado_por: usuarioId,
      dado_ate: aplis.dadoAte,
      requisicoes: aplis.requisicoes.length,
      lotes: aplis.lotesRecurso.length,
    });
    if (error) throw new ErroGravacao(`glosa_recurso_sincronizacoes: ${error.message}`);
  } catch (err) {
    if (!(err instanceof ErroGravacao)) throw err;
    console.error(`[faturamento/glosas-recursos] Supabase (${competencia}):`, err.message);
    return {
      erro: {
        status: 502,
        mensagem: 'Não foi possível gravar a foto do apLIS agora — tente novamente em alguns minutos.',
      },
    };
  }

  return {
    dadoAte: aplis.dadoAte,
    sincronizadoEm: agora,
    requisicoes: aplis.requisicoes.length,
    lotes: aplis.lotesRecurso.length,
  };
}
