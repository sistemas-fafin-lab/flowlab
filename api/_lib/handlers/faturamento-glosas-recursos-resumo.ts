/**
 * API Route: GET /api/faturamento/glosas-recursos-resumo
 *
 * Cards do topo de Acompanhamento dos recursos, na tela Glosas e Recursos
 * (.scratch/glosas-recursos-dashboard/spec.md): Total de recursos (com a
 * variação sobre o mês de faturamento anterior), Em análise, Deferidos,
 * Indeferidos, deferido parcial e glosa acatada. Lê da foto do Supabase; a
 * classificação e as somas são de faturamento/recursoGlosa.ts.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling). Lido
 * com o cliente do usuário, para respeitar a RLS.
 *
 * Query params:
 *   competencia      YYYY-MM do lote de faturamento original, obrigatório
 *   fontePagadoraId  filtra por convênio (fonte pagadora da requisição)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { competenciaValida, edicoesDaFoto, resumirAcompanhamento, somarMeses } from '../faturamento/recursoGlosa.js';
import type { RequisicaoClassificavel } from '../faturamento/recursoGlosa.js';
import { getSupabaseUserClient } from '../supabase.js';

/** Linhas por página do PostgREST (o teto padrão é 1000). */
const PAGINA = 1000;

interface LinhaFoto {
  status_aplis: number | null;
  liquido: number | string;
  recebido: number | string;
  recebido_fixacao: number | string | null;
  valor_recursado: number | string | null;
  valor_recursado_editado: number | string | null;
  valor_recebido_glosa_editado: number | string | null;
  id_lote_recurso: number | null;
  glosa_recurso_lotes: { data_envio_aplis: string | null; data_envio_editada: string | null } | null;
}

class ErroLeitura extends Error {}

function primeiro(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

function numeroOuNulo(valor: number | string | null): number | null {
  return valor === null ? null : Number(valor);
}

async function requisicoesDoMes(
  supabase: SupabaseClient,
  competencia: string,
  fontePagadoraId: number | undefined,
): Promise<RequisicaoClassificavel[]> {
  const saida: RequisicaoClassificavel[] = [];
  for (let de = 0; ; de += PAGINA) {
    let consulta = supabase
      .from('glosa_recurso_requisicoes')
      .select('status_aplis, liquido, recebido, recebido_fixacao, valor_recursado, valor_recursado_editado, valor_recebido_glosa_editado, id_lote_recurso, glosa_recurso_lotes(data_envio_aplis, data_envio_editada)')
      .eq('competencia', competencia);
    if (fontePagadoraId !== undefined) consulta = consulta.eq('id_fonte_pagadora', fontePagadoraId);
    const { data, error } = await consulta.order('id_requisicao').range(de, de + PAGINA - 1);
    if (error) throw new ErroLeitura(error.message);
    const linhas = (data ?? []) as unknown as LinhaFoto[];
    // As edições manuais (lápis) valem acima do apLIS: valor recursado e
    // recebido de glosa em `edicoes`, e a data de envio editada em `loteEnviado`.
    for (const l of linhas) {
      saida.push({
        foto: {
          status: l.status_aplis,
          liquido: Number(l.liquido),
          recebido: Number(l.recebido),
          recebidoFixacao: numeroOuNulo(l.recebido_fixacao),
          valorRecursado: numeroOuNulo(l.valor_recursado),
          emLoteRecurso: l.id_lote_recurso !== null,
          loteEnviado: Boolean(l.glosa_recurso_lotes?.data_envio_editada ?? l.glosa_recurso_lotes?.data_envio_aplis),
        },
        edicoes: edicoesDaFoto({
          valorRecursado: numeroOuNulo(l.valor_recursado_editado),
          valorRecebidoGlosa: numeroOuNulo(l.valor_recebido_glosa_editado),
        }),
      });
    }
    if (linhas.length < PAGINA) return saida;
  }
}

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
    const competencia = primeiro(q.competencia)?.trim() ?? '';
    const brutoFonte = primeiro(q.fontePagadoraId)?.trim() || undefined;
    const fontePagadoraId = brutoFonte === undefined ? undefined : Number(brutoFonte);

    const invalidos = [
      !competenciaValida(competencia) ? 'competencia (YYYY-MM)' : null,
      fontePagadoraId !== undefined && !(Number.isInteger(fontePagadoraId) && fontePagadoraId > 0)
        ? 'fontePagadoraId'
        : null,
    ].filter((c): c is string => c !== null);
    if (invalidos.length > 0) {
      res.status(400).json({ success: false, error: `Parâmetro inválido: ${invalidos.join(', ')}.` });
      return;
    }

    const supabase = getSupabaseUserClient(token as string);
    let resumo;
    try {
      const [atual, anterior] = await Promise.all([
        requisicoesDoMes(supabase, competencia, fontePagadoraId),
        requisicoesDoMes(supabase, somarMeses(competencia, -1), fontePagadoraId),
      ]);
      resumo = resumirAcompanhamento(atual, anterior);
    } catch (err) {
      if (!(err instanceof ErroLeitura)) throw err;
      console.error('[faturamento/glosas-recursos-resumo] Supabase:', err.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler o resumo dos recursos agora — tente novamente em alguns minutos.',
      });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, resumo });
  } catch (err) {
    console.error('[faturamento/glosas-recursos-resumo] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
