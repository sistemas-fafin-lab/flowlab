/**
 * API Route: GET /api/faturamento/glosas-recursos-detalhe
 *
 * Card "Detalhes do recurso" da tela Glosas e Recursos
 * (.scratch/glosas-recursos-dashboard/spec.md). Dois modos, um por chamada:
 *
 *   ?idLoteRecurso=N  requisições do lote de recurso (em qualquer mês), da foto
 *                     do Supabase: a lista do card aberto pelo olho do lote.
 *   ?idRequisicao=N   a requisição da foto + justificativa (procedimentos dela
 *                     no lote de recurso) e observações (tarefas do setor
 *                     GLOSA - FATURAMENTO), lidas ao vivo do apLIS. Os
 *                     documentos vêm de /api/faturamento/imagens-legado.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling). A foto
 * é lida com o cliente do usuário, para respeitar a RLS.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { detalheRecursoRequisicao } from '../faturamento/bdLab.js';
import { valorRecebidoGlosa } from '../faturamento/recursoGlosa.js';
import { getSupabaseUserClient } from '../supabase.js';

const COLUNAS_REQUISICAO =
  'id_requisicao, cod_requisicao, num_guia, paciente, competencia, id_fonte_pagadora, fonte_pagadora_nome, id_lote_recurso, status_aplis, liquido, recebido, glosa_fixada, recebido_fixacao, valor_recursado, valor_inicial_estimado';

interface LinhaRequisicao {
  id_requisicao: number;
  cod_requisicao: string | null;
  num_guia: string | null;
  paciente: string | null;
  competencia: string;
  id_fonte_pagadora: number | null;
  fonte_pagadora_nome: string | null;
  id_lote_recurso: number | null;
  status_aplis: number | null;
  liquido: number | string;
  recebido: number | string;
  glosa_fixada: number | string | null;
  recebido_fixacao: number | string | null;
  valor_recursado: number | string | null;
  valor_inicial_estimado: boolean;
}

function primeiro(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

/** undefined: ausente; null: inválido. */
function idPositivo(bruto: string | undefined): number | null | undefined {
  if (bruto === undefined || bruto.trim() === '') return undefined;
  const n = Number(bruto);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function numeroOuNulo(valor: number | string | null): number | null {
  return valor === null ? null : Number(valor);
}

// As edições manuais (lápis, ticket 07) entram aqui, em `valorRecebidoGlosa`
// e no recursado.
function paraResposta(r: LinhaRequisicao) {
  const valorRecursado = numeroOuNulo(r.valor_recursado);
  return {
    idRequisicao: r.id_requisicao,
    codRequisicao: r.cod_requisicao,
    numGuia: r.num_guia,
    paciente: r.paciente,
    competencia: r.competencia,
    fontePagadora: { id: r.id_fonte_pagadora, nome: r.fonte_pagadora_nome },
    idLoteRecurso: r.id_lote_recurso,
    statusAplis: r.status_aplis,
    glosaFixada: numeroOuNulo(r.glosa_fixada),
    valorRecursado,
    valorRecebidoGlosa: valorRecebidoGlosa({
      status: r.status_aplis,
      liquido: Number(r.liquido),
      recebido: Number(r.recebido),
      recebidoFixacao: numeroOuNulo(r.recebido_fixacao),
      valorRecursado,
      emLoteRecurso: r.id_lote_recurso !== null,
      loteEnviado: false,
    }),
    valorInicialEstimado: r.valor_inicial_estimado,
  };
}

const ERRO_LEITURA = 'Não foi possível ler o detalhe do recurso agora — tente novamente em alguns minutos.';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
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

    const q = req.query as Record<string, string | string[] | undefined>;
    const idLoteRecurso = idPositivo(primeiro(q.idLoteRecurso));
    const idRequisicao = idPositivo(primeiro(q.idRequisicao));
    if (idLoteRecurso === null || idRequisicao === null || (idLoteRecurso === undefined) === (idRequisicao === undefined)) {
      res.status(400).json({ success: false, error: 'Informe idLoteRecurso ou idRequisicao (inteiro positivo).' });
      return;
    }

    const supabase = getSupabaseUserClient(token as string);
    res.setHeader('Cache-Control', 'no-store');

    if (idLoteRecurso !== undefined) {
      // Um lote de recurso tem dezenas de requisições, longe do teto do PostgREST.
      const { data, error } = await supabase
        .from('glosa_recurso_requisicoes')
        .select(COLUNAS_REQUISICAO)
        .eq('id_lote_recurso', idLoteRecurso)
        .order('paciente', { ascending: true, nullsFirst: false })
        .order('id_requisicao');
      if (error) {
        console.error('[faturamento/glosas-recursos-detalhe] Supabase:', error.message);
        res.status(502).json({ success: false, error: ERRO_LEITURA });
        return;
      }
      res.status(200).json({
        success: true,
        requisicoes: ((data ?? []) as LinhaRequisicao[]).map(paraResposta),
      });
      return;
    }

    const { data, error } = await supabase
      .from('glosa_recurso_requisicoes')
      .select(COLUNAS_REQUISICAO)
      .eq('id_requisicao', idRequisicao as number)
      .maybeSingle();
    if (error) {
      console.error('[faturamento/glosas-recursos-detalhe] Supabase:', error.message);
      res.status(502).json({ success: false, error: ERRO_LEITURA });
      return;
    }
    if (!data) {
      res.status(404).json({ success: false, error: 'Requisição não encontrada na foto de glosas e recursos.' });
      return;
    }

    const linha = data as LinhaRequisicao;
    const aplis = await detalheRecursoRequisicao(linha.id_requisicao, linha.id_lote_recurso);
    if ('erro' in aplis) {
      res.status(aplis.erro.status).json({ success: false, error: aplis.erro.mensagem });
      return;
    }

    res.status(200).json({
      success: true,
      requisicao: paraResposta(linha),
      justificativas: aplis.justificativas,
      observacoes: aplis.observacoes,
    });
  } catch (err) {
    console.error('[faturamento/glosas-recursos-detalhe] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
