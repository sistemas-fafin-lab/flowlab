/**
 * API Route: GET /api/faturamento/glosas-recursos-lotes
 *
 * Sub-aba Acompanhamento dos recursos → "Lotes de recurso" da tela Glosas e
 * Recursos (.scratch/glosas-recursos-dashboard/spec.md). Lê da foto do
 * Supabase (view glosa_recurso_lotes_lista), não do apLIS: a foto é gravada por
 * /api/faturamento/glosas-recursos-sincronizar.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling). Lido
 * com o cliente do usuário, para respeitar a RLS.
 *
 * Query params:
 *   competencia      YYYY-MM do lote de faturamento original, obrigatório
 *   fontePagadoraId  filtra por convênio (fatinstituicao.IdInstituicao)
 *   status           rótulo do lote (Criado, Enviado, Finalizado, Cancelado)
 *   busca            lote, protocolo, convênio, guia, paciente
 *   pagina           default 1
 *   tamanho          1..200, default 50
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { competenciaValida } from '../faturamento/recursoGlosa.js';
import { getSupabaseUserClient } from '../supabase.js';

const STATUS_LOTE = ['Criado', 'Enviado', 'Finalizado', 'Cancelado'];
const MAX_TAMANHO = 200;
const TAMANHO_PADRAO = 50;
const MAX_BUSCA = 100;

interface LinhaLista {
  id_lote_recurso: number;
  status_label: string;
  protocolo: string | null;
  protocolo_faturamento: string | null;
  id_fonte_pagadora: number | null;
  fonte_pagadora_nome: string | null;
  data_criacao_aplis: string | null;
  data_envio_aplis: string | null;
  qtd_requisicoes: number;
  valor_glosado: number | string;
  valor_recorrido: number | string;
}

interface LinhaSincronizacao {
  sincronizado_em: string;
  dado_ate: string | null;
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
    const erroAuth = await autorizarFaturamento(token);
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const q = req.query as Record<string, string | string[] | undefined>;
    const competencia = primeiro(q.competencia)?.trim() ?? '';
    const status = primeiro(q.status)?.trim() || undefined;
    const fontePagadoraId = inteiroNaFaixa(primeiro(q.fontePagadoraId), 1, Number.MAX_SAFE_INTEGER);
    const pagina = inteiroNaFaixa(primeiro(q.pagina), 1, Number.MAX_SAFE_INTEGER);
    const tamanho = inteiroNaFaixa(primeiro(q.tamanho), 1, MAX_TAMANHO);
    const busca = primeiro(q.busca)?.trim().slice(0, MAX_BUSCA) || undefined;

    const invalidos = [
      !competenciaValida(competencia) ? 'competencia (YYYY-MM)' : null,
      status !== undefined && !STATUS_LOTE.includes(status) ? 'status' : null,
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
      .from('glosa_recurso_lotes_lista')
      .select(
        'id_lote_recurso, status_label, protocolo, protocolo_faturamento, id_fonte_pagadora, fonte_pagadora_nome, data_criacao_aplis, data_envio_aplis, qtd_requisicoes, valor_glosado, valor_recorrido',
        { count: 'exact' },
      )
      .eq('competencia', competencia);
    // Fonte da requisição, não do lote: é o mesmo recorte da sincronização.
    if (fontePagadoraId !== undefined) consulta = consulta.contains('fontes_requisicoes', [fontePagadoraId]);
    if (status !== undefined) consulta = consulta.eq('status_label', status);
    if (busca !== undefined) consulta = consulta.ilike('busca', `%${escaparIlike(busca)}%`);

    const de = (paginaAtual - 1) * tamanhoPagina;
    const { data, error, count } = await consulta
      .order('data_criacao_aplis', { ascending: false, nullsFirst: false })
      .order('id_lote_recurso', { ascending: false })
      .range(de, de + tamanhoPagina - 1);

    // Última sincronização que cobre o recorte: a de todos os convênios ou a do pedido.
    const { data: sincronizacoes, error: erroSync } = await supabase
      .from('glosa_recurso_sincronizacoes')
      .select('sincronizado_em, dado_ate')
      .eq('competencia', competencia)
      .or(fontePagadoraId !== undefined
        ? `id_fonte_pagadora.is.null,id_fonte_pagadora.eq.${fontePagadoraId}`
        : 'id_fonte_pagadora.is.null')
      .order('sincronizado_em', { ascending: false })
      .limit(1);

    if (error || erroSync) {
      console.error('[faturamento/glosas-recursos-lotes] Supabase:', (error ?? erroSync)?.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler os lotes de recurso agora — tente novamente em alguns minutos.',
      });
      return;
    }

    const ultima = ((sincronizacoes ?? []) as LinhaSincronizacao[])[0] ?? null;

    const registros = count ?? 0;
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      meta: {
        pagina: paginaAtual,
        tamanho: tamanhoPagina,
        qtdPaginas: Math.ceil(registros / tamanhoPagina),
        registros,
        ultimaSincronizacao: ultima ? { sincronizadoEm: ultima.sincronizado_em, dadoAte: ultima.dado_ate } : null,
      },
      lotes: ((data ?? []) as LinhaLista[]).map((l) => ({
        idLoteRecurso: l.id_lote_recurso,
        statusLabel: l.status_label,
        protocolo: l.protocolo,
        protocoloFaturamento: l.protocolo_faturamento,
        fontePagadora: { id: l.id_fonte_pagadora, nome: l.fonte_pagadora_nome },
        dataCriacao: l.data_criacao_aplis,
        dataEnvio: l.data_envio_aplis,
        qtdRequisicoes: l.qtd_requisicoes,
        valorGlosado: Number(l.valor_glosado),
        valorRecorrido: Number(l.valor_recorrido),
      })),
    });
  } catch (err) {
    console.error('[faturamento/glosas-recursos-lotes] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
