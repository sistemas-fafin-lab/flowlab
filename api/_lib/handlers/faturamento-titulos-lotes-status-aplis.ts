/**
 * API Route: GET /api/faturamento/titulos-lotes-status-aplis?status=N&desde=YYYY-MM-DD&ate=YYYY-MM-DD
 *
 * Filtro "Status do lote (apLIS)" da aba Títulos: dos lotes dos títulos
 * emitidos no período, os que estão hoje no status STLOT `status` no apLIS.
 * A tela filtra os títulos por esses ids (`aplis_id` do lote).
 *
 * `lotes.status_aplis` no Supabase não serve: é a foto do lote no instante em
 * que entrou no título e não é re-sincronizada. O status vem do MySQL de backup
 * (`lotesNoStatus`), ~1 dia de atraso — `meta.dadoAte` diz até quando. Sem
 * cache. Falha na réplica → erro, nunca lista vazia (seria lida como "nenhum
 * título nesse status").
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling ou a chave
 * da tela). Os títulos são lidos com o cliente do usuário, para respeitar o RLS.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { lotesNoStatus, STLOT_LABELS } from '../faturamento/bdLab.js';
import { ErroSupabase, lotesAplisDosTitulos } from '../faturamento/titulosConferencia.js';
import { getSupabaseUserClient } from '../supabase.js';

const DATA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function primeiro(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
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

    const q = req.query as Record<string, string | string[] | undefined>;
    const status = Number(primeiro(q.status)?.trim());
    // Whitelist: nenhum código fora do catálogo STLOT chega à consulta.
    if (!Number.isInteger(status) || !(status in STLOT_LABELS)) {
      res.status(400).json({ success: false, error: 'Parâmetro inválido: status (código STLOT do catálogo).' });
      return;
    }
    const desde = primeiro(q.desde)?.trim() ?? '';
    const ate = primeiro(q.ate)?.trim() ?? '';
    if (!DATA_ISO_RE.test(desde) || !DATA_ISO_RE.test(ate)) {
      res.status(400).json({ success: false, error: 'Informe desde e ate no formato YYYY-MM-DD.' });
      return;
    }

    let idsDosTitulos: number[];
    try {
      idsDosTitulos = await lotesAplisDosTitulos(getSupabaseUserClient(token as string), desde, ate);
    } catch (err) {
      if (!(err instanceof ErroSupabase)) throw err;
      console.error('[faturamento/titulos-lotes-status-aplis] Supabase:', err.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler os títulos agora — tente novamente em alguns minutos.',
      });
      return;
    }

    const resultado = await lotesNoStatus(idsDosTitulos, status);
    if ('erro' in resultado) {
      res.status(resultado.erro.status).json({
        success: false,
        error: 'Não foi possível consultar o status dos lotes no apLIS agora — tente novamente em alguns minutos. '
          + `(${resultado.erro.mensagem})`,
      });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, meta: { dadoAte: resultado.dadoAte }, idsLote: resultado.idsLote });
  } catch (err) {
    console.error('[faturamento/titulos-lotes-status-aplis] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
