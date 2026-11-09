/**
 * API Route: GET /api/faturamento/comparativos-glosa-por-mes
 *
 * Aba Contas a Receber → Comparativos, bloco "Glosa por mês de solicitação": de janeiro até
 * o mês de referência, a glosa em aberto pela regra da DRE do financeiro (Análise de
 * Faturamento do apLIS; ver `listarGlosaPorMesSolicitacao`). Mesmo contrato dos outros
 * blocos da aba: parâmetro `mes` ('YYYY-MM'), permissão da tela Contas a Receber
 * (ADR 0001) e falha do banco do laboratório devolvida com status e mensagem, não 500.
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
import { listarGlosaPorMesSolicitacao } from '../faturamento/bdLab.js';
import { periodosDoAnoAte, montarGlosaPorMes } from '../../../src/modules/faturamento/utils/glosaPorMes.js';

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
    const periodos = periodosDoAnoAte(mes);
    if (!periodos) {
      res.status(400).json({ success: false, error: 'Informe mes no formato YYYY-MM.' });
      return;
    }

    const resultado = await listarGlosaPorMesSolicitacao(periodos[0].desde, periodos[periodos.length - 1].ate);
    if ('erro' in resultado) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    // Dado financeiro: não deixa ficar em cache de navegador nem de proxy.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, mes, ...montarGlosaPorMes(periodos, resultado.linhas) });
  } catch (err) {
    console.error('[faturamento/comparativos-glosa-por-mes] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
