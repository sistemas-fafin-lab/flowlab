/**
 * API Route: GET /api/faturamento/comparativos-conversao
 *
 * Aba Contas a Receber → Comparativos, bloco "Conversão de requisições": aptas × faturadas
 * por convênio, com o % de conversão e as aptas sem lote, no mês de referência, em M-1 e em
 * M-2 (faturamento-comparativos, issue 07). A requisição entra no mês da data de solicitação
 * e usa a whitelist de fontes da sub-aba "Sem lote", para as duas baterem. Mesmo contrato
 * dos demais blocos da aba (ver comparativos-volume-envio).
 *
 * Autorização: header `Authorization: Bearer <access_token>` (canViewBilling ou
 * canViewContasReceber).
 *
 * Query params:
 *   mes  YYYY-MM — obrigatório (mês de referência)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { listarRequisicoesConversao } from '../faturamento/bdLab.js';
import { listarFontesConsideradasMeta } from '../faturamento/fontesConsideradas.js';
import { getSupabaseAdminClient } from '../supabase.js';
import { periodosComparativos } from '../../../src/modules/faturamento/utils/comparativos.js';
import { montarConversaoRequisicoes } from '../../../src/modules/faturamento/utils/conversaoRequisicoes.js';

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
    const erroAuth = await autorizarFaturamento(tokenDoHeader(req.headers.authorization), ['contasReceber']);
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

    const resultado = await listarRequisicoesConversao({
      periodoIni: periodos[periodos.length - 1].desde,
      periodoFim: periodos[0].ate,
      fontesConsideradas: await listarFontesConsideradasMeta(getSupabaseAdminClient()),
    });
    if ('erro' in resultado) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    // Dado financeiro: não deixa ficar em cache de navegador nem de proxy.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      mes,
      periodos,
      ...montarConversaoRequisicoes(periodos, resultado.linhas),
    });
  } catch (err) {
    console.error('[faturamento/comparativos-conversao] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
