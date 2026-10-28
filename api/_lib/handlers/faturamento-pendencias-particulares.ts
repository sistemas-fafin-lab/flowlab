/**
 * API Route: GET /api/faturamento/pendencias-particulares
 *
 * Devolve à aba Faturamento → Contas a Receber → Pendências → Particulares as
 * requisições da fonte pagadora PARTICULAR (IdFontePagadora 1102) sem NF
 * emitida, solicitadas até hoje. Regra completa em
 * api/_lib/faturamento/bdLab.ts (listarParticularesPendentes).
 *
 * Autorização: header `Authorization: Bearer <access_token>` da SESSÃO do operador
 * (exige canViewBilling ou a chave da tela), mesmo padrão de /api/faturamento/lotes.
 *
 * Query params (todos opcionais):
 *   desde         YYYY-MM-DD — sobre a data de solicitação
 *   ate           YYYY-MM-DD — nunca ultrapassa hoje
 *   pagina        default 1
 *   tamanho       1..200, default 50
 *   incluirSemNf  1 — traz também as requisições de locais de origem marcados
 *                 como "não emite NF" (tabela clinicas_sem_nf); sem ele, elas
 *                 saem da lista e do valorTotal
 *
 * Variáveis de ambiente: DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
 *   + SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para validar a sessão.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { listarParticularesPendentes, MAX_TAMANHO, TAMANHO_PADRAO } from '../faturamento/bdLab.js';
import { listarClinicasSemNf } from '../faturamento/clinicasSemNf.js';
import { getSupabaseUserClient } from '../supabase.js';

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
    const token = tokenDoHeader(req.headers.authorization);
    const erroAuth = await autorizarFaturamento(token, ['contasReceber']);
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const q = req.query as Record<string, string | string[] | undefined>;
    const desde = primeiro(q.desde)?.trim() || undefined;
    const ate = primeiro(q.ate)?.trim() || undefined;
    const pagina = inteiroNaFaixa(primeiro(q.pagina), 1, Number.MAX_SAFE_INTEGER);
    const tamanho = inteiroNaFaixa(primeiro(q.tamanho), 1, MAX_TAMANHO);

    const invalidos = [
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

    const ignorarCache = primeiro(q.semCache) === '1';

    // Lida com o cliente do usuário: a RLS de clinicas_sem_nf é a mesma regra de
    // leitura do faturamento. Falhar aqui não pode virar lista sem o filtro.
    let idsClinicasSemNf: number[];
    try {
      idsClinicasSemNf = await listarClinicasSemNf(getSupabaseUserClient(token as string), { ignorarCache });
    } catch (err) {
      console.error('[faturamento/pendencias-particulares] erro ao ler clínicas sem NF:', describeError(err));
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler a lista de clínicas sem NF. Tente novamente.',
      });
      return;
    }

    const resultado = await listarParticularesPendentes({
      desde,
      ate,
      pagina,
      tamanho: tamanho ?? TAMANHO_PADRAO,
      ignorarCache,
      idsClinicasSemNf,
      incluirSemNf: primeiro(q.incluirSemNf) === '1',
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
      requisicoes: resultado.requisicoes,
    });
  } catch (err) {
    console.error('[faturamento/pendencias-particulares] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
