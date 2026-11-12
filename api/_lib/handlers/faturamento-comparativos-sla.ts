/**
 * API Route: GET /api/faturamento/comparativos-sla
 *
 * Aba Contas a Receber → Comparativos, bloco "SLA por convênio": dias médios de cadastro →
 * envio ao faturamento → recebido no faturamento → faturado, e o tempo de liquidação
 * (faturado → recebido) com o % já recebido, por convênio, no mês de referência, em M-1 e
 * em M-2 (faturamento-comparativos, issue 06). A requisição entra no mês em que foi
 * faturada. Mesmo contrato dos demais blocos da aba (ver comparativos-volume-envio).
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
import { listarMarcosSla } from '../faturamento/bdLab.js';
import { periodosComparativos } from '../../../src/modules/faturamento/utils/comparativos.js';
import { FONTES_MARCOS, montarSlaFaturamento } from '../../../src/modules/faturamento/utils/slaFaturamento.js';

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

    const resultado = await listarMarcosSla({
      periodoIni: periodos[periodos.length - 1].desde,
      periodoFim: periodos[0].ate,
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
      fontes: FONTES_MARCOS,
      sla: montarSlaFaturamento(periodos, resultado.linhas),
    });
  } catch (err) {
    console.error('[faturamento/comparativos-sla] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
