/**
 * API Route: POST /api/faturamento/glosas-recursos-sincronizar
 *
 * Botão "Atualizar" da tela Glosas e Recursos
 * (.scratch/glosas-recursos-dashboard/spec.md): lê do apLIS as requisições
 * glosadas ou recursadas do mês de faturamento (e do convênio, se pedido) e os
 * lotes de recurso delas, e grava a foto no Supabase. A glosa fixada segue
 * faturamento/recursoGlosa.ts e não muda depois da primeira sincronização.
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
 * Fonte do apLIS: MySQL de backup, ~1 dia de atraso; `meta.dadoAte` diz até
 * quando. Falha na réplica → erro, sem gravar nada.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling). A foto
 * é espelho do apLIS, não edição do operador, então quem consulta pode
 * atualizar; grava com service_role.
 *
 * Body:
 *   competencia      'YYYY-MM' do lote de faturamento original, obrigatório
 *   fontePagadoraId  fatinstituicao.IdInstituicao, opcional (sem = todos)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { glosasRecursosDoPeriodo } from '../faturamento/bdLab.js';
import type { LoteRecursoAplis, RequisicaoGlosaRecursoAplis } from '../faturamento/bdLab.js';
import { competenciaValida, eventosDaRequisicao, eventosDoLote, fixarGlosa } from '../faturamento/recursoGlosa.js';
import type {
  EventoHistorico,
  FotoHistoricoLote,
  FotoHistoricoRequisicao,
  GlosaFixada,
} from '../faturamento/recursoGlosa.js';
import { getSupabaseAdminClient } from '../supabase.js';

/** Ids por `.in()` / linhas por upsert: o maior mês de 2026 tem ~700 requisições. */
const BLOCO = 500;

interface CorpoSincronizar {
  competencia?: unknown;
  fontePagadoraId?: unknown;
}

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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  try {
    const token = tokenDoHeader(req.headers.authorization);
    const erroAuth = await autorizarFaturamento(token);
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const corpo = (req.body ?? {}) as CorpoSincronizar;
    const competencia = typeof corpo.competencia === 'string' ? corpo.competencia.trim() : '';
    if (!competenciaValida(competencia)) {
      res.status(400).json({ success: false, error: 'Informe a competência no formato YYYY-MM.' });
      return;
    }
    const bruto = corpo.fontePagadoraId ?? undefined;
    if (bruto !== undefined && !(typeof bruto === 'number' && Number.isInteger(bruto) && bruto > 0)) {
      res.status(400).json({ success: false, error: 'fontePagadoraId deve ser um inteiro positivo.' });
      return;
    }
    const fontePagadoraId = bruto as number | undefined;

    const aplis = await glosasRecursosDoPeriodo({ competencia, fontePagadoraId });
    if ('erro' in aplis) {
      res.status(aplis.erro.status).json({ success: false, error: aplis.erro.mensagem });
      return;
    }

    const supabase = getSupabaseAdminClient();
    const { data: sessao } = await supabase.auth.getUser(token as string);
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
        sincronizado_por: sessao?.user?.id ?? null,
        dado_ate: aplis.dadoAte,
        requisicoes: aplis.requisicoes.length,
        lotes: aplis.lotesRecurso.length,
      });
      if (error) throw new ErroGravacao(`glosa_recurso_sincronizacoes: ${error.message}`);
    } catch (err) {
      if (!(err instanceof ErroGravacao)) throw err;
      console.error('[faturamento/glosas-recursos-sincronizar] Supabase:', err.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível gravar a foto do apLIS agora — tente novamente em alguns minutos.',
      });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      meta: { dadoAte: aplis.dadoAte, sincronizadoEm: agora },
      requisicoes: aplis.requisicoes.length,
      lotes: aplis.lotesRecurso.length,
    });
  } catch (err) {
    console.error('[faturamento/glosas-recursos-sincronizar] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
