/**
 * API Route: GET /api/faturamento/pendencias-nao-faturadas
 *
 * Devolve à aba Faturamento → Contas a Receber → Pendências os lotes de faturamento
 * sem NF/RPS vinculado e fora da janela normal de fechamento (2 meses mais recentes).
 * Regra completa em api/_lib/faturamento/bdLab.ts (listarLotesPendentes).
 *
 * Autorização: header `Authorization: Bearer <access_token>` da SESSÃO do operador
 * (exige canViewBilling), mesmo padrão de /api/faturamento/lotes.
 *
 * Query params (todos opcionais):
 *   desde         YYYY-MM-DD — limite inferior
 *   ate           YYYY-MM-DD — limite superior (nunca ultrapassa o cutoff de M-2)
 *   operadoraId   fatinstituicao.IdInstituicao
 *   pagina        default 1
 *   tamanho       1..200, default 50
 *
 * Variáveis de ambiente: DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
 *   + SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para validar a sessão.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { listarLotesPendentes, MAX_TAMANHO, TAMANHO_PADRAO } from '../faturamento/bdLab.js';

const DATA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function primeiro(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

/** Inteiro dentro de [min, max]; undefined quando ausente, null quando inválido. */
function inteiroNaFaixa(
  bruto: string | undefined,
  min: number,
  max: number,
): number | null | undefined {
  if (bruto === undefined || bruto.trim() === '') return undefined;
  const n = Number(bruto);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
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
    const desde = primeiro(q.desde)?.trim() || undefined;
    const ate = primeiro(q.ate)?.trim() || undefined;
    const operadoraId = inteiroNaFaixa(primeiro(q.operadoraId), 1, Number.MAX_SAFE_INTEGER);
    const pagina = inteiroNaFaixa(primeiro(q.pagina), 1, Number.MAX_SAFE_INTEGER);
    const tamanho = inteiroNaFaixa(primeiro(q.tamanho), 1, MAX_TAMANHO);

    const invalidos = [
      operadoraId === null ? 'operadoraId' : null,
      pagina === null ? 'pagina' : null,
      tamanho === null ? `tamanho (1..${MAX_TAMANHO})` : null,
      desde !== undefined && !DATA_ISO_RE.test(desde) ? 'desde' : null,
      ate !== undefined && !DATA_ISO_RE.test(ate) ? 'ate' : null,
    ].filter((c): c is string => c !== null);
    if (invalidos.length > 0) {
      res.status(400).json({
        success: false,
        error: `Parâmetro inválido: ${invalidos.join(', ')}.`,
      });
      return;
    }

    const resultado = await listarLotesPendentes({
      desde,
      ate,
      operadoraId: operadoraId ?? undefined,
      pagina,
      tamanho: tamanho ?? TAMANHO_PADRAO,
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
      meta: resultado.meta,
      lotes: resultado.lotes,
    });
  } catch (err) {
    console.error('[faturamento/pendencias-nao-faturadas] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
