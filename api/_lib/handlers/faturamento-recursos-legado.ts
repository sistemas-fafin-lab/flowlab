/**
 * API Route: GET /api/faturamento/recursos-legado
 *
 * Devolve à aba Glosas e Recursos → "Histórico (apLIS)" os lotes de recurso já
 * protocolados no MySQL de backup do laboratório (fatloterecurso), lidos ao vivo —
 * nada é persistido no Supabase. Só consulta/histórico nesta entrega.
 *
 * Com `?idLoteRecurso=<n>` devolve o detalhe (procedimentos) de um lote específico
 * em vez da listagem — mesmo padrão de /api/faturamento/lote-detalhe, mas como
 * query param na mesma rota (só 425 lotes no total, não justifica uma function à
 * parte no dispatcher).
 *
 * Ver docs/plans/faturamento/glosas-recursos-legado-design.md (seção 6).
 *
 * Autorização: header `Authorization: Bearer <access_token>` da sessão do operador
 * (exige canViewBilling).
 *
 * Query params (listagem):
 *   status            código cru de fatloterecurso.Status
 *   fontePagadoraId   filtra por fatinstituicao.IdInstituicao
 *   busca             protocolo, protocolo recursado, número da guia
 *   pagina            default 1
 *   tamanho           1..200, default 50
 *
 * Query params (detalhe): idLoteRecurso (inteiro positivo) — ignora os demais.
 *
 * Variáveis de ambiente: DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
 *   + SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para validar a sessão.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import {
  detalharRecursoLegado,
  listarRecursosLegado,
  MAX_BUSCA,
  MAX_TAMANHO,
  TAMANHO_PADRAO,
} from '../faturamento/bdLab.js';

function primeiro(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

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

    const idLoteRecursoBruto = primeiro(q.idLoteRecurso)?.trim();
    if (idLoteRecursoBruto) {
      const idLoteRecurso = Number(idLoteRecursoBruto);
      if (!Number.isInteger(idLoteRecurso) || idLoteRecurso < 1) {
        res.status(400).json({ success: false, error: 'Informe idLoteRecurso (inteiro positivo).' });
        return;
      }

      const resultado = await detalharRecursoLegado(idLoteRecurso, primeiro(q.semCache) === '1');
      if ('erro' in resultado) {
        res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
        return;
      }

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ success: true, idLoteRecurso, procedimentos: resultado.procedimentos });
      return;
    }

    const status = inteiroNaFaixa(primeiro(q.status), 0, 255);
    const fontePagadoraId = inteiroNaFaixa(primeiro(q.fontePagadoraId), 1, Number.MAX_SAFE_INTEGER);
    const pagina = inteiroNaFaixa(primeiro(q.pagina), 1, Number.MAX_SAFE_INTEGER);
    const tamanho = inteiroNaFaixa(primeiro(q.tamanho), 1, MAX_TAMANHO);

    const invalidos = [
      status === null ? 'status' : null,
      fontePagadoraId === null ? 'fontePagadoraId' : null,
      pagina === null ? 'pagina' : null,
      tamanho === null ? `tamanho (1..${MAX_TAMANHO})` : null,
    ].filter((c): c is string => c !== null);
    if (invalidos.length > 0) {
      res.status(400).json({ success: false, error: `Parâmetro inválido: ${invalidos.join(', ')}.` });
      return;
    }

    const resultado = await listarRecursosLegado({
      status: status ?? undefined,
      fontePagadoraId: fontePagadoraId ?? undefined,
      pagina,
      tamanho: tamanho ?? TAMANHO_PADRAO,
      busca: primeiro(q.busca)?.trim().slice(0, MAX_BUSCA) || undefined,
      ignorarCache: primeiro(q.semCache) === '1',
    });

    if ('erro' in resultado) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, meta: resultado.meta, recursos: resultado.recursos });
  } catch (err) {
    console.error('[faturamento/recursos-legado] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
