/**
 * API Route: GET /api/faturamento/envios-por-convenio
 *
 * Devolve à aba Contas a Receber → Envios uma linha por convênio (fonte pagadora)
 * com o total de lotes enviados a ele no período — agregado no MySQL de backup do
 * laboratório (nada é paginado/somado no cliente, issue 01 de
 * faturamento-envios-por-convenio).
 *
 * Autorização: header `Authorization: Bearer <access_token>` da sessão do operador
 * (exige canViewBilling) — mesma checagem de faturamento-lotes.ts.
 *
 * Query params:
 *   periodoIni, periodoFim  YYYY-MM-DD — obrigatórios
 *   status                  códigos STLOT separados por vírgula (ex.: "2,3");
 *                            default "2,3" (Conciliação + Faturado — "enviados")
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { listarEnviosPorConvenio, STATUS_ENVIADOS_PADRAO, STLOT_LABELS } from '../faturamento/bdLab.js';

const DATA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    const erroAuth = await autorizarFaturamento(tokenDoHeader(req.headers.authorization));
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const q = req.query as Record<string, string | string[] | undefined>;
    const periodoIni = primeiro(q.periodoIni)?.trim();
    const periodoFim = primeiro(q.periodoFim)?.trim();

    const faltando = [
      !periodoIni ? 'periodoIni' : null,
      !periodoFim ? 'periodoFim' : null,
    ].filter((c): c is string => c !== null);
    if (faltando.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Informe periodoIni e periodoFim.',
        missing: faltando,
      });
      return;
    }
    const malFormatadas = [
      !DATA_ISO_RE.test(periodoIni as string) ? 'periodoIni' : null,
      !DATA_ISO_RE.test(periodoFim as string) ? 'periodoFim' : null,
    ].filter((c): c is string => c !== null);
    if (malFormatadas.length > 0) {
      res.status(400).json({
        success: false,
        error: `Data deve estar no formato YYYY-MM-DD: ${malFormatadas.join(', ')}.`,
      });
      return;
    }

    // Whitelist explícita: nenhum código fora do catálogo STLOT_LABELS chega à consulta.
    const statusBruto = primeiro(q.status)?.trim();
    let statusLotes: number[];
    if (!statusBruto) {
      statusLotes = STATUS_ENVIADOS_PADRAO;
    } else {
      statusLotes = statusBruto.split(',').map((s) => Number(s.trim()));
      const invalido = statusLotes.length === 0
        || statusLotes.some((n) => !Number.isInteger(n) || !(n in STLOT_LABELS));
      if (invalido) {
        res.status(400).json({
          success: false,
          error: 'Parâmetro inválido: status (códigos STLOT do catálogo, separados por vírgula).',
        });
        return;
      }
    }

    const resultado = await listarEnviosPorConvenio({
      periodoIni: periodoIni as string,
      periodoFim: periodoFim as string,
      statusLotes,
      ignorarCache: primeiro(q.semCache) === '1',
    });

    if ('erro' in resultado) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    // Dado financeiro: não deixa ficar em cache de navegador nem de proxy.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      meta: { periodoIni, periodoFim, status: statusLotes },
      convenios: resultado.convenios,
    });
  } catch (err) {
    console.error('[faturamento/envios-por-convenio] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
