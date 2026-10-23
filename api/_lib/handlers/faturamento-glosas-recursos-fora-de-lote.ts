/**
 * API Route: GET /api/faturamento/glosas-recursos-fora-de-lote
 *
 * Sub-aba Acompanhamento dos recursos → "Recursos fora de lote" da tela Glosas
 * e Recursos (.scratch/glosas-recursos-dashboard/spec.md, issue 09): as
 * requisições do período que não estão em nenhum lote de recurso — em
 * "GLOSADO ainda SEM RECURSO" (6) ou em 1º/2º recurso (7, 16) —, para a
 * responsável ver o que falta recorrer e conferir a limpeza dos lotes de 2026.
 * Lê da foto do Supabase (view glosa_recurso_requisicoes_lista). O prazo para
 * recorrer sai da regra GLOSA – RECURSO do convênio, contada da data de
 * recebimento da requisição, lida a cada consulta.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling). Lido
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
import { competenciaValida, prazoParaRecorrer, STATUS_GLOSA } from '../faturamento/recursoGlosa.js';
import type { RegraPrazo, TipoRegraPrazo } from '../faturamento/recursoGlosa.js';
import { getSupabaseUserClient } from '../supabase.js';

const MAX_TAMANHO = 200;
const TAMANHO_PADRAO = 50;
const MAX_BUSCA = 100;

/** Glosado sem recurso e recursos que ainda deveriam estar num lote. */
const STATUS_FORA_DE_LOTE = [
  STATUS_GLOSA.glosadoSemRecurso,
  STATUS_GLOSA.primeiroRecurso,
  STATUS_GLOSA.segundoRecurso,
];

interface LinhaLista {
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

interface LinhaRegraFonte {
  id_fonte_pagadora: number;
  glosa_prazo_regras: { glosa_recurso_tipo: TipoRegraPrazo; glosa_recurso_n: number | null } | null;
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

/** 'YYYY-MM-DD' de hoje no fuso do laboratório. */
function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
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
        'id_requisicao, cod_requisicao, num_guia, paciente, competencia, id_fonte_pagadora, fonte_pagadora_nome, status_aplis, glosa_fixada, valor_inicial_estimado, data_recebimento, procedimentos, motivos',
        { count: 'exact' },
      )
      .eq('competencia', competencia)
      .is('id_lote_recurso', null)
      .in('status_aplis', STATUS_FORA_DE_LOTE);
    if (fontePagadoraId !== undefined) consulta = consulta.eq('id_fonte_pagadora', fontePagadoraId);
    if (busca !== undefined) consulta = consulta.ilike('busca', `%${escaparIlike(busca)}%`);

    const de = (paginaAtual - 1) * tamanhoPagina;
    const { data, error, count } = await consulta
      .order('data_recebimento', { ascending: false, nullsFirst: false })
      .order('id_requisicao', { ascending: false })
      .range(de, de + tamanhoPagina - 1);

    const linhas = (data ?? []) as LinhaLista[];
    const fontes = [...new Set(linhas.map((l) => l.id_fonte_pagadora).filter((f): f is number => f !== null))];

    const { data: regrasFontes, error: erroRegras } = fontes.length === 0
      ? { data: [], error: null }
      : await supabase
        .from('glosa_prazo_regra_fontes')
        .select('id_fonte_pagadora, glosa_prazo_regras(glosa_recurso_tipo, glosa_recurso_n)')
        .in('id_fonte_pagadora', fontes);

    const erroLeitura = (error ?? erroRegras)?.message;
    if (erroLeitura) {
      console.error('[faturamento/glosas-recursos-fora-de-lote] Supabase:', erroLeitura);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler os recursos fora de lote agora — tente novamente em alguns minutos.',
      });
      return;
    }

    const regraPorFonte = new Map<number, RegraPrazo>();
    for (const f of (regrasFontes ?? []) as unknown as LinhaRegraFonte[]) {
      const r = f.glosa_prazo_regras;
      if (r) regraPorFonte.set(f.id_fonte_pagadora, { tipo: r.glosa_recurso_tipo, n: r.glosa_recurso_n });
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
      requisicoes: linhas.map((l) => {
        const regra = l.id_fonte_pagadora === null ? null : regraPorFonte.get(l.id_fonte_pagadora) ?? null;
        const { prazo, selo } = prazoParaRecorrer(l.data_recebimento, regra, hoje);
        return {
          idRequisicao: l.id_requisicao,
          codRequisicao: l.cod_requisicao,
          numGuia: l.num_guia,
          paciente: l.paciente,
          competencia: l.competencia,
          fontePagadora: { id: l.id_fonte_pagadora, nome: l.fonte_pagadora_nome },
          status: l.status_aplis,
          dataGlosa: l.data_recebimento,
          procedimentos: l.procedimentos ?? [],
          motivos: l.motivos ?? [],
          valorGlosado: l.glosa_fixada === null ? null : Number(l.glosa_fixada),
          valorInicialEstimado: l.valor_inicial_estimado,
          prazoRecorrer: prazo,
          selo,
        };
      }),
    });
  } catch (err) {
    console.error('[faturamento/glosas-recursos-fora-de-lote] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
