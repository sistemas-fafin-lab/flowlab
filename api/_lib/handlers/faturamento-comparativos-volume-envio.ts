/**
 * API Route: GET /api/faturamento/comparativos-volume-envio
 *
 * Aba Contas a Receber → Comparativos, bloco "Volume de envio": lotes e guias enviados por
 * convênio no mês de referência, em M-1 e em M-2 (faturamento-comparativos, issue 03).
 * Os demais blocos da aba seguem o mesmo contrato: parâmetro `mes` ('YYYY-MM'), permissão da
 * tela Contas a Receber (ADR 0001) e falha do apLIS devolvida com status e mensagem, não 500.
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
import { listarVolumeEnvioMensal, STATUS_ENVIADOS_PADRAO } from '../faturamento/bdLab.js';
import { montarVolumeEnvio, periodosComparativos } from '../../../src/modules/faturamento/utils/comparativos.js';

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

    const resultado = await listarVolumeEnvioMensal({
      periodoIni: periodos[periodos.length - 1].desde,
      periodoFim: periodos[0].ate,
      statusLotes: STATUS_ENVIADOS_PADRAO,
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
      volume: montarVolumeEnvio(periodos, resultado.linhas),
    });
  } catch (err) {
    console.error('[faturamento/comparativos-volume-envio] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
