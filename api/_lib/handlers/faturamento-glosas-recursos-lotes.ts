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
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling ou a chave da tela). Lido
 * com o cliente do usuário, para respeitar a RLS.
 *
 * Query params:
 *   competencia      YYYY-MM do lote de faturamento original, obrigatório sem `pendencia`
 *   pendencia        'retorno-atrasado' | 'pagamento-atrasado': os lotes dos
 *                    cards das Pendências de glosa (issue 06), de todos os meses
 *                    de faturamento (o período não filtra), da data prevista
 *                    mais antiga à mais recente
 *   mesVencimento    YYYY-MM em que a data prevista venceu (com `pendencia`); ausente = todo o período
 *   fontePagadoraId  filtra por convênio (fatinstituicao.IdInstituicao)
 *   status           rótulo do lote (Criado, Enviado, Finalizado, Cancelado)
 *   busca            lote, protocolo, convênio, guia, paciente
 *   pagina           default 1
 *   tamanho          1..200, default 50
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import {
  COLUNAS_LOTE_RECURSO,
  ErroLeituraPendencias,
  escaparIlike,
  fontesDoLote,
  hojeEmSaoPaulo,
  lerLotesEnviados,
  lerRegrasDasFontes,
  regrasDoLote,
  requisicoesDosLotes,
} from '../faturamento/dadosPendenciasGlosa.js';
import type { FiltroPendencia, LinhaLoteRecurso, LoteRecursoPendencia } from '../faturamento/dadosPendenciasGlosa.js';
import { competenciaValida, pendenciasDeGlosa, prazosDoLote } from '../faturamento/recursoGlosa.js';
import { getSupabaseUserClient } from '../supabase.js';

const STATUS_LOTE = ['Criado', 'Enviado', 'Finalizado', 'Cancelado'];
const PENDENCIAS_LOTE: FiltroPendencia[] = ['retorno-atrasado', 'pagamento-atrasado'];
const MAX_TAMANHO = 200;
const TAMANHO_PADRAO = 50;
const MAX_BUSCA = 100;

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

/** O lote como a tela o recebe, com retorno e pagamento previstos e o selo. */
function loteDaResposta(lote: LoteRecursoPendencia, hoje: string) {
  const l = lote.linha;
  const prazos = prazosDoLote(lote, lote.regras, hoje);
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
}

function meta(pagina: number, tamanho: number, registros: number) {
  return { pagina, tamanho, qtdPaginas: Math.ceil(registros / tamanho), registros };
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
    const status = primeiro(q.status)?.trim() || undefined;
    const fontePagadoraId = inteiroNaFaixa(primeiro(q.fontePagadoraId), 1, Number.MAX_SAFE_INTEGER);
    const pagina = inteiroNaFaixa(primeiro(q.pagina), 1, Number.MAX_SAFE_INTEGER);
    const tamanho = inteiroNaFaixa(primeiro(q.tamanho), 1, MAX_TAMANHO);
    const busca = primeiro(q.busca)?.trim().slice(0, MAX_BUSCA) || undefined;
    const brutoPendencia = primeiro(q.pendencia)?.trim() || undefined;
    const pendencia = PENDENCIAS_LOTE.find((p) => p === brutoPendencia);
    const mesVencimento = primeiro(q.mesVencimento)?.trim() || null;

    const invalidos = [
      brutoPendencia === undefined && !competenciaValida(competencia) ? 'competencia (YYYY-MM)' : null,
      brutoPendencia !== undefined && pendencia === undefined ? 'pendencia' : null,
      mesVencimento !== null && !competenciaValida(mesVencimento) ? 'mesVencimento (YYYY-MM)' : null,
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
    const de = (paginaAtual - 1) * tamanhoPagina;
    const supabase = getSupabaseUserClient(token as string);
    const hoje = hojeEmSaoPaulo();

    let lotes: LoteRecursoPendencia[];
    let registros: number;
    try {
      if (pendencia !== undefined) {
        const enviados = await lerLotesEnviados(supabase, { fontePagadoraId, status, busca });
        const pendencias = pendenciasDeGlosa({ requisicoes: [], regraRecursoPorFonte: new Map(), lotes: enviados }, mesVencimento, hoje);
        const doCard = pendencia === 'retorno-atrasado' ? pendencias.retornoAtrasado.lotes : pendencias.pagamentoAtrasado.lotes;
        lotes = doCard.slice(de, de + tamanhoPagina).map((p) => p.lote);
        registros = doCard.length;
      } else {
        let consulta = supabase
          .from('glosa_recurso_lotes_lista')
          .select(COLUNAS_LOTE_RECURSO, { count: 'exact' })
          .eq('competencia', competencia);
        // Fonte da requisição, não do lote: é o mesmo recorte da sincronização.
        if (fontePagadoraId !== undefined) consulta = consulta.contains('fontes_requisicoes', [fontePagadoraId]);
        if (status !== undefined) consulta = consulta.eq('status_label', status);
        if (busca !== undefined) consulta = consulta.ilike('busca', `%${escaparIlike(busca)}%`);
        const { data, error, count } = await consulta
          .order('data_criacao_aplis', { ascending: false, nullsFirst: false })
          .order('id_lote_recurso', { ascending: false })
          .range(de, de + tamanhoPagina - 1);
        if (error) throw new ErroLeituraPendencias(error.message);

        const linhas = (data ?? []) as unknown as LinhaLoteRecurso[];
        const ids = linhas.map((l) => l.id_lote_recurso);
        const enviados = new Set(linhas.filter((l) => l.data_envio).map((l) => l.id_lote_recurso));
        const [porLote, regras] = await Promise.all([
          requisicoesDosLotes(supabase, ids, enviados),
          lerRegrasDasFontes(supabase, [...new Set(linhas.flatMap(fontesDoLote))]),
        ]);
        lotes = linhas.map((linha) => ({
          linha,
          dataEnvio: linha.data_envio,
          dataRetornoReal: linha.data_retorno_real,
          regras: regrasDoLote(linha, regras.lote),
          requisicoes: porLote.get(linha.id_lote_recurso) ?? [],
        }));
        registros = count ?? 0;
      }
    } catch (err) {
      if (!(err instanceof ErroLeituraPendencias)) throw err;
      console.error('[faturamento/glosas-recursos-lotes] Supabase:', err.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler os lotes de recurso agora — tente novamente em alguns minutos.',
      });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      meta: meta(paginaAtual, tamanhoPagina, registros),
      lotes: lotes.map((l) => loteDaResposta(l, hoje)),
    });
  } catch (err) {
    console.error('[faturamento/glosas-recursos-lotes] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
