/**
 * API Route: GET /api/faturamento/comparativos-ranking-glosa
 *
 * Aba Contas a Receber → Comparativos, bloco "Ranking de códigos de glosa" (faturamento-comparativos,
 * issue 05): para o mês de referência, M-1 e M-2, o ranking por código nos modos Total e Acatada e
 * as requisições por trás de cada código. Cálculo em utils/rankingCodigosGlosa.ts.
 *
 * As glosas são as do funil (mesma leitura da foto de recursos e mesma regra de mês), então os
 * totais batem com ele: Total = glosa total do funil; Acatada = acatada do funil. O código vem do
 * apLIS por procedimento (demonstrativo → catálogo → texto livre); `glosas.requisicao_id` não é
 * usado (quase vazio). Nenhum nome de paciente sai daqui.
 *
 * Autorização: header `Authorization: Bearer <access_token>` (canViewBilling ou a chave da tela
 * Contas a Receber). Dados do Supabase lidos com o cliente do usuário (RLS).
 *
 * Query params:
 *   mes  YYYY-MM — obrigatório (mês de referência)
 *
 * Falha do Supabase → 502; falha do apLIS → status e mensagem do erro, não 500.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { glosasDasRequisicoes } from '../faturamento/bdLab.js';
import { fontesDaMeta, glosasParaFunil, titulosParaFunil } from '../faturamento/dadosFunilGlosa.js';
import { ErroSupabase } from '../faturamento/titulosConferencia.js';
import { getSupabaseUserClient } from '../supabase.js';
import { periodosComparativos } from '../../../src/modules/faturamento/utils/comparativos.js';
import { FORA_DE_LOTE, mesDaGlosaNoFunil } from '../../../src/modules/faturamento/utils/funilGlosa.js';
import { montarRankingCodigosPorMes } from '../../../src/modules/faturamento/utils/rankingCodigosGlosa.js';

function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  try {
    const token = tokenDoHeader(req.headers.authorization);
    const erroAuth = await autorizarFaturamento(token, ['contasReceber']);
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const mes = primeiro((req.query as Record<string, string | string[] | undefined>).mes)?.trim() ?? '';
    const periodos = periodosComparativos(mes);
    if (!periodos) {
      res.status(400).json({ success: false, error: 'Informe mes no formato YYYY-MM.' });
      return;
    }

    const supabase = getSupabaseUserClient(token as string);
    let doPeriodo;
    try {
      const [{ titulos, loteDoAplis }, fontes] = await Promise.all([
        titulosParaFunil(supabase, periodos[periodos.length - 1].desde, periodos[0].ate),
        fontesDaMeta(supabase),
      ]);
      const { glosas, primeiraEmissaoDoLote } = await glosasParaFunil(
        supabase,
        titulos,
        loteDoAplis,
        periodos.map((p) => p.mes),
        fontes,
      );
      const mesDaGlosa = mesDaGlosaNoFunil(titulos, primeiraEmissaoDoLote);
      const meses = new Set(periodos.map((p) => p.mes));
      doPeriodo = glosas
        .map((g) => ({ mes: mesDaGlosa(g), g }))
        .filter(({ mes: m }) => meses.has(m))
        .sort((a, b) => a.g.idRequisicao - b.g.idRequisicao);
    } catch (err) {
      if (!(err instanceof ErroSupabase)) throw err;
      console.error('[faturamento/comparativos-ranking-glosa] Supabase:', err.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler as glosas agora — tente novamente em alguns minutos.',
      });
      return;
    }

    const codigos = await glosasDasRequisicoes(doPeriodo.map(({ g }) => g.idRequisicao));
    if ('erro' in codigos) {
      res.status(codigos.erro.status).json({ success: false, error: codigos.erro.mensagem });
      return;
    }

    const meses = montarRankingCodigosPorMes(
      periodos,
      doPeriodo.map(({ mes: m, g }) => ({
        mes: m,
        glosa: {
          idRequisicao: g.idRequisicao,
          codRequisicao: g.codRequisicao,
          numGuia: g.numGuia,
          lote: g.lote ? (g.lote.codigo ?? g.lote.id) : `${g.idLoteFaturamento} · ${FORA_DE_LOTE}`,
          convenio: g.convenio,
          statusAplis: g.statusAplis,
          classe: g.classe,
          valor: g.valor,
          procedimentos: codigos.porRequisicao.get(g.idRequisicao) ?? [],
        },
      })),
    );

    // Dado financeiro: não deixa ficar em cache de navegador nem de proxy.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, mes, periodos, meses });
  } catch (err) {
    console.error('[faturamento/comparativos-ranking-glosa] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
