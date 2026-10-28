/**
 * API Route: GET /api/faturamento/glosas-recursos-recentes
 *
 * Aba "Glosas recentes" da tela Glosas e Recursos
 * (.scratch/glosas-recursos-dashboard/spec.md, issue 10): as glosas do
 * período, da mais recente para a mais antiga (data de recebimento da
 * requisição). Lê da foto do Supabase (view glosa_recurso_requisicoes_lista).
 * O status vem traduzido como no Dashboard (Aberta, Em recurso, Revertida,
 * Definitiva) por faturamento/recursoGlosa.ts, com as edições do lápis
 * valendo acima do apLIS.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling ou a chave da tela). Lido
 * com o cliente do usuário, para respeitar a RLS.
 *
 * Query params:
 *   competencia      YYYY-MM do lote de faturamento original, obrigatório
 *   fontePagadoraId  filtra por convênio (fatinstituicao.IdInstituicao)
 *   busca            guia, paciente, convênio, procedimento, requisição, motivo
 *   pagina           default 1
 *   tamanho          1..200, default 50
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { competenciaValida, edicoesDaFoto, statusDashboard } from '../faturamento/recursoGlosa.js';
import { getSupabaseUserClient } from '../supabase.js';

const MAX_TAMANHO = 200;
const TAMANHO_PADRAO = 50;
const MAX_BUSCA = 100;

interface LinhaLista {
  id_requisicao: number;
  cod_requisicao: string | null;
  num_guia: string | null;
  paciente: string | null;
  competencia: string;
  id_fonte_pagadora: number | null;
  fonte_pagadora_nome: string | null;
  id_lote_recurso: number | null;
  status_aplis: number | null;
  glosa_fixada: number | string | null;
  valor_inicial_estimado: boolean;
  data_recebimento: string | null;
  procedimentos: string[] | null;
  motivos: string[] | null;
  liquido: number | string;
  recebido: number | string;
  recebido_fixacao: number | string | null;
  valor_recursado: number | string | null;
  valor_recursado_editado: number | string | null;
  valor_recebido_glosa_editado: number | string | null;
  lote_enviado: boolean;
}

function primeiro(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

function inteiroNaFaixa(bruto: string | undefined, min: number, max: number): number | null | undefined {
  if (bruto === undefined || bruto.trim() === '') return undefined;
  const n = Number(bruto);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

function numeroOuNulo(valor: number | string | null): number | null {
  return valor === null ? null : Number(valor);
}

/** `%` e `_` digitados são texto, não curinga do ILIKE. */
function escaparIlike(termo: string): string {
  return termo.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  try {
    const token = tokenDoHeader(req.headers.authorization);
    const erroAuth = await autorizarFaturamento(token, ['glosas']);
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const q = req.query as Record<string, string | string[] | undefined>;
    const competencia = primeiro(q.competencia)?.trim() ?? '';
    const fontePagadoraId = inteiroNaFaixa(primeiro(q.fontePagadoraId), 1, Number.MAX_SAFE_INTEGER);
    const pagina = inteiroNaFaixa(primeiro(q.pagina), 1, Number.MAX_SAFE_INTEGER);
    const tamanho = inteiroNaFaixa(primeiro(q.tamanho), 1, MAX_TAMANHO);
    const busca = primeiro(q.busca)?.trim().slice(0, MAX_BUSCA) || undefined;

    const invalidos = [
      !competenciaValida(competencia) ? 'competencia (YYYY-MM)' : null,
      fontePagadoraId === null ? 'fontePagadoraId' : null,
      pagina === null ? 'pagina' : null,
      tamanho === null ? `tamanho (1..${MAX_TAMANHO})` : null,
    ].filter((c): c is string => c !== null);
    if (invalidos.length > 0) {
      res.status(400).json({ success: false, error: `Parâmetro inválido: ${invalidos.join(', ')}.` });
      return;
    }

    const paginaAtual = pagina ?? 1;
    const tamanhoPagina = tamanho ?? TAMANHO_PADRAO;
    const supabase = getSupabaseUserClient(token as string);

    let consulta = supabase
      .from('glosa_recurso_requisicoes_lista')
      .select(
        'id_requisicao, cod_requisicao, num_guia, paciente, competencia, id_fonte_pagadora, fonte_pagadora_nome, id_lote_recurso, status_aplis, glosa_fixada, valor_inicial_estimado, data_recebimento, procedimentos, motivos, liquido, recebido, recebido_fixacao, valor_recursado, valor_recursado_editado, valor_recebido_glosa_editado, lote_enviado',
        { count: 'exact' },
      )
      .eq('competencia', competencia);
    if (fontePagadoraId !== undefined) consulta = consulta.eq('id_fonte_pagadora', fontePagadoraId);
    if (busca !== undefined) consulta = consulta.ilike('busca', `%${escaparIlike(busca)}%`);

    const de = (paginaAtual - 1) * tamanhoPagina;
    const { data, error, count } = await consulta
      .order('data_recebimento', { ascending: false, nullsFirst: false })
      .order('id_requisicao', { ascending: false })
      .range(de, de + tamanhoPagina - 1);

    if (error) {
      console.error('[faturamento/glosas-recursos-recentes] Supabase:', error.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler as glosas recentes agora — tente novamente em alguns minutos.',
      });
      return;
    }

    const linhas = (data ?? []) as LinhaLista[];
    const registros = count ?? 0;
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      meta: {
        pagina: paginaAtual,
        tamanho: tamanhoPagina,
        qtdPaginas: Math.ceil(registros / tamanhoPagina),
        registros,
      },
      glosas: linhas.map((l) => ({
        idRequisicao: l.id_requisicao,
        codRequisicao: l.cod_requisicao,
        numGuia: l.num_guia,
        paciente: l.paciente,
        competencia: l.competencia,
        fontePagadora: { id: l.id_fonte_pagadora, nome: l.fonte_pagadora_nome },
        statusAplis: l.status_aplis,
        dataGlosa: l.data_recebimento,
        procedimentos: l.procedimentos ?? [],
        motivos: l.motivos ?? [],
        valorGlosado: numeroOuNulo(l.glosa_fixada),
        valorInicialEstimado: l.valor_inicial_estimado,
        // As edições manuais (lápis) valem acima do apLIS: valor recursado e
        // recebido de glosa em `edicoes`; a data de envio editada já está em lote_enviado.
        status: statusDashboard(
          {
            status: l.status_aplis,
            liquido: Number(l.liquido),
            recebido: Number(l.recebido),
            recebidoFixacao: numeroOuNulo(l.recebido_fixacao),
            valorRecursado: numeroOuNulo(l.valor_recursado),
            emLoteRecurso: l.id_lote_recurso !== null,
            loteEnviado: l.lote_enviado,
          },
          edicoesDaFoto({
            valorRecursado: numeroOuNulo(l.valor_recursado_editado),
            valorRecebidoGlosa: numeroOuNulo(l.valor_recebido_glosa_editado),
          }),
        ),
      })),
    });
  } catch (err) {
    console.error('[faturamento/glosas-recursos-recentes] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
