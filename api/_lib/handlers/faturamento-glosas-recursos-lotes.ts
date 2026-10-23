/**
 * API Route: GET /api/faturamento/glosas-recursos-lotes
 *
 * Sub-aba Acompanhamento dos recursos → "Lotes de recurso" da tela Glosas e
 * Recursos (.scratch/glosas-recursos-dashboard/spec.md). Lê da foto do
 * Supabase (view glosa_recurso_lotes_lista), não do apLIS: a foto é gravada por
 * /api/faturamento/glosas-recursos-sincronizar. Retorno e pagamento previstos e
 * o selo de atraso saem das regras de prazo do convênio lidas a cada consulta:
 * alterar uma regra no cadastro muda a lista sem sincronizar. As edições
 * manuais (lápis) valem acima do apLIS: a data de envio editada recalcula
 * retorno, pagamento e selo; a data real de retorno encerra o selo; o valor
 * recursado e o recebido de glosa editados entram na classificação.
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

import type { SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { competenciaValida, edicoesDaFoto, prazosDoLote } from '../faturamento/recursoGlosa.js';
import type {
  RegrasPrazoLote,
  RequisicaoClassificavel,
  TipoRegraPrazo,
} from '../faturamento/recursoGlosa.js';
import { getSupabaseUserClient } from '../supabase.js';

const STATUS_LOTE = ['Criado', 'Enviado', 'Finalizado', 'Cancelado'];
const MAX_TAMANHO = 200;
const TAMANHO_PADRAO = 50;
const MAX_BUSCA = 100;
/** Linhas por página do PostgREST (o teto padrão é 1000). */
const PAGINA_LEITURA = 1000;

interface LinhaLista {
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

/** Requisição de um lote da página, em qualquer mês: o selo olha o lote inteiro. */
interface LinhaRequisicao {
  id_lote_recurso: number;
  status_aplis: number | null;
  liquido: number | string;
  recebido: number | string;
  recebido_fixacao: number | string | null;
  valor_recursado: number | string | null;
  valor_recursado_editado: number | string | null;
  valor_recebido_glosa_editado: number | string | null;
}

interface LinhaRegraFonte {
  id_fonte_pagadora: number;
  glosa_prazo_regras: {
    glosa_analise_tipo: TipoRegraPrazo;
    glosa_analise_n: number | null;
    glosa_pagamento_tipo: TipoRegraPrazo;
    glosa_pagamento_n: number | null;
  } | null;
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

/** 'YYYY-MM-DD' de hoje no fuso do laboratório. */
function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

/**
 * Fontes que podem dar a regra do lote: a do lote e, depois, as das
 * requisições (os dois cadastros do Bradesco podem divergir entre lote e
 * requisição, e só um deles estar ligado à regra).
 */
function fontesDoLote(l: LinhaLista): number[] {
  return [l.id_fonte_pagadora, ...(l.fontes_requisicoes ?? [])].filter((f): f is number => f !== null);
}

/** Requisições dos lotes, em qualquer mês, paginando o teto do PostgREST. */
async function requisicoesDosLotes(
  supabase: SupabaseClient,
  idsLotes: number[],
): Promise<{ linhas: LinhaRequisicao[]; erro: string | null }> {
  const linhas: LinhaRequisicao[] = [];
  if (idsLotes.length === 0) return { linhas, erro: null };
  for (let de = 0; ; de += PAGINA_LEITURA) {
    const { data, error } = await supabase
      .from('glosa_recurso_requisicoes')
      .select('id_lote_recurso, status_aplis, liquido, recebido, recebido_fixacao, valor_recursado, valor_recursado_editado, valor_recebido_glosa_editado')
      .in('id_lote_recurso', idsLotes)
      .order('id_requisicao')
      .range(de, de + PAGINA_LEITURA - 1);
    if (error) return { linhas, erro: error.message };
    const pagina = (data ?? []) as LinhaRequisicao[];
    linhas.push(...pagina);
    if (pagina.length < PAGINA_LEITURA) return { linhas, erro: null };
  }
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
        'id_lote_recurso, status_label, protocolo, protocolo_faturamento, id_fonte_pagadora, fonte_pagadora_nome, data_criacao_aplis, data_envio_aplis, data_envio, data_envio_editada, data_retorno_real, data_pagamento_real, fontes_requisicoes, qtd_requisicoes, valor_glosado, valor_recorrido',
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

    const linhas = (data ?? []) as LinhaLista[];
    const idsLotes = linhas.map((l) => l.id_lote_recurso);
    const fontes = [...new Set(linhas.flatMap(fontesDoLote))];

    const [{ linhas: requisicoes, erro: erroReq }, { data: regrasFontes, error: erroRegras }] = await Promise.all([
      requisicoesDosLotes(supabase, idsLotes),
      fontes.length === 0
        ? Promise.resolve({ data: [], error: null })
        : supabase
          .from('glosa_prazo_regra_fontes')
          .select('id_fonte_pagadora, glosa_prazo_regras(glosa_analise_tipo, glosa_analise_n, glosa_pagamento_tipo, glosa_pagamento_n)')
          .in('id_fonte_pagadora', fontes),
    ]);

    const erroLeitura = (error ?? erroRegras)?.message ?? erroReq;
    if (erroLeitura) {
      console.error('[faturamento/glosas-recursos-lotes] Supabase:', erroLeitura);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler os lotes de recurso agora — tente novamente em alguns minutos.',
      });
      return;
    }


    const regraPorFonte = new Map<number, RegrasPrazoLote>();
    for (const f of (regrasFontes ?? []) as unknown as LinhaRegraFonte[]) {
      const r = f.glosa_prazo_regras;
      if (!r) continue;
      regraPorFonte.set(f.id_fonte_pagadora, {
        glosaAnalise: { tipo: r.glosa_analise_tipo, n: r.glosa_analise_n },
        glosaPagamento: { tipo: r.glosa_pagamento_tipo, n: r.glosa_pagamento_n },
      });
    }

    const requisicoesPorLote = new Map<number, RequisicaoClassificavel[]>();
    const enviados = new Set(linhas.filter((l) => l.data_envio).map((l) => l.id_lote_recurso));
    for (const r of requisicoes) {
      const lista = requisicoesPorLote.get(r.id_lote_recurso) ?? [];
      lista.push({
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
      requisicoesPorLote.set(r.id_lote_recurso, lista);
    }

    const hoje = hojeEmSaoPaulo();

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
      lotes: linhas.map((l) => {
        const fonteComRegra = fontesDoLote(l).find((f) => regraPorFonte.has(f));
        const prazos = prazosDoLote(
          {
            dataEnvio: l.data_envio,
            dataRetornoReal: l.data_retorno_real,
            requisicoes: requisicoesPorLote.get(l.id_lote_recurso) ?? [],
          },
          fonteComRegra === undefined ? null : regraPorFonte.get(fonteComRegra) ?? null,
          hoje,
        );
        return {
        idLoteRecurso: l.id_lote_recurso,
        statusLabel: l.status_label,
        protocolo: l.protocolo,
        protocoloFaturamento: l.protocolo_faturamento,
        fontePagadora: { id: l.id_fonte_pagadora, nome: l.fonte_pagadora_nome },
        dataCriacao: l.data_criacao_aplis,
        dataEnvio: l.data_envio,
        dataEnvioAplis: l.data_envio_aplis,
        dataEnvioEditada: l.data_envio_editada,
        dataRetornoReal: l.data_retorno_real,
        dataPagamentoReal: l.data_pagamento_real,
        qtdRequisicoes: l.qtd_requisicoes,
        valorGlosado: Number(l.valor_glosado),
        valorRecorrido: Number(l.valor_recorrido),
          dataRetornoPrevista: prazos.dataRetornoPrevista,
          dataPagamentoPrevista: prazos.dataPagamentoPrevista,
          selo: prazos.selo,
        };
      }),
    });
  } catch (err) {
    console.error('[faturamento/glosas-recursos-lotes] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
