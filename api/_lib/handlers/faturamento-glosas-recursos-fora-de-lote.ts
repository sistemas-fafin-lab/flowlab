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
 * Com `pendencia=vencidos` (card "Glosas sem recurso com prazo vencido" das
 * Pendências de glosa, issue 06), a lista é a do card: glosadas sem recurso
 * com o prazo vencido, de todos os meses de faturamento (o período não
 * filtra), do prazo mais antigo ao mais recente.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling ou a chave da tela). Lido
 * com o cliente do usuário, para respeitar a RLS.
 *
 * Query params:
 *   competencia      YYYY-MM do lote de faturamento original, obrigatório sem `pendencia`
 *   pendencia        'vencidos': só as glosadas sem recurso com prazo vencido
 *   mesVencimento    YYYY-MM em que o prazo venceu (com `pendencia`); ausente = todo o período
 *   fontePagadoraId  filtra por convênio (fatinstituicao.IdInstituicao)
 *   busca            guia, paciente, convênio, procedimento, requisição, motivo
 *   pagina           default 1
 *   tamanho          1..200, default 50
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import {
  COLUNAS_FORA_DE_LOTE,
  ErroLeituraPendencias,
  escaparIlike,
  hojeEmSaoPaulo,
  lerGlosadasForaDeLote,
  lerRegrasDasFontes,
} from '../faturamento/dadosPendenciasGlosa.js';
import type { LinhaForaDeLote } from '../faturamento/dadosPendenciasGlosa.js';
import { competenciaValida, pendenciasDeGlosa, prazoParaRecorrer, STATUS_GLOSA } from '../faturamento/recursoGlosa.js';
import type { RegraPrazo } from '../faturamento/recursoGlosa.js';
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

/** A linha como a tela a recebe, com o prazo para recorrer e o selo. */
function requisicaoDaResposta(l: LinhaForaDeLote, regraPorFonte: Map<number, RegraPrazo>, hoje: string) {
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
}

function meta(pagina: number, tamanho: number, registros: number) {
  return { pagina, tamanho, qtdPaginas: Math.ceil(registros / tamanho), registros };
}

function fontesDe(linhas: LinhaForaDeLote[]): number[] {
  return [...new Set(linhas.map((l) => l.id_fonte_pagadora).filter((f): f is number => f !== null))];
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
    const pendencia = primeiro(q.pendencia)?.trim() || undefined;
    const mesVencimento = primeiro(q.mesVencimento)?.trim() || null;

    const invalidos = [
      pendencia === undefined && !competenciaValida(competencia) ? 'competencia (YYYY-MM)' : null,
      pendencia !== undefined && pendencia !== 'vencidos' ? 'pendencia' : null,
      mesVencimento !== null && !competenciaValida(mesVencimento) ? 'mesVencimento (YYYY-MM)' : null,
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
    const de = (paginaAtual - 1) * tamanhoPagina;
    const supabase = getSupabaseUserClient(token as string);
    const hoje = hojeEmSaoPaulo();

    let linhas: LinhaForaDeLote[];
    let registros: number;
    let regraPorFonte: Map<number, RegraPrazo>;
    try {
      if (pendencia === 'vencidos') {
        const requisicoes = await lerGlosadasForaDeLote(supabase, { fontePagadoraId, busca });
        regraPorFonte = (await lerRegrasDasFontes(supabase, fontesDe(requisicoes.map((r) => r.linha)))).recurso;
        const vencidas = pendenciasDeGlosa({ requisicoes, regraRecursoPorFonte: regraPorFonte, lotes: [] }, mesVencimento, hoje)
          .prazoVencido.requisicoes;
        linhas = vencidas.slice(de, de + tamanhoPagina).map((v) => v.requisicao.linha);
        registros = vencidas.length;
      } else {
        let consulta = supabase
          .from('glosa_recurso_requisicoes_lista')
          .select(COLUNAS_FORA_DE_LOTE, { count: 'exact' })
          .eq('competencia', competencia)
          .is('id_lote_recurso', null)
          .in('status_aplis', STATUS_FORA_DE_LOTE);
        if (fontePagadoraId !== undefined) consulta = consulta.eq('id_fonte_pagadora', fontePagadoraId);
        if (busca !== undefined) consulta = consulta.ilike('busca', `%${escaparIlike(busca)}%`);
        const { data, error, count } = await consulta
          .order('data_recebimento', { ascending: false, nullsFirst: false })
          .order('id_requisicao', { ascending: false })
          .range(de, de + tamanhoPagina - 1);
        if (error) throw new ErroLeituraPendencias(error.message);
        linhas = (data ?? []) as unknown as LinhaForaDeLote[];
        registros = count ?? 0;
        regraPorFonte = (await lerRegrasDasFontes(supabase, fontesDe(linhas))).recurso;
      }
    } catch (err) {
      if (!(err instanceof ErroLeituraPendencias)) throw err;
      console.error('[faturamento/glosas-recursos-fora-de-lote] Supabase:', err.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler os recursos fora de lote agora — tente novamente em alguns minutos.',
      });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      meta: meta(paginaAtual, tamanhoPagina, registros),
      requisicoes: linhas.map((l) => requisicaoDaResposta(l, regraPorFonte, hoje)),
    });
  } catch (err) {
    console.error('[faturamento/glosas-recursos-fora-de-lote] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
