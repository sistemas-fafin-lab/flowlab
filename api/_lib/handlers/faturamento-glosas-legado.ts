/**
 * API Route: GET /api/faturamento/glosas-legado
 *
 * Devolve à aba Glosas e Recursos → "Histórico (apLIS)" as glosas já lançadas no
 * MySQL de backup do laboratório (fatrequisicaoprocedimento.IdMotivoGlosa), lidas ao
 * vivo — nada é persistido no Supabase. Só consulta/histórico nesta entrega: não há
 * ação de "adotar" um item do legado para a tabela `glosas` nativa.
 *
 * Ver docs/plans/faturamento/glosas-recursos-legado-design.md (seção 6).
 *
 * Autorização: header `Authorization: Bearer <access_token>` da sessão do operador
 * (exige canViewBilling).
 *
 * Query params:
 *   periodoIni, periodoFim  YYYY-MM-DD — obrigatórios (sem período a consulta
 *                            varreria as ~23 mil linhas com motivo de glosa)
 *   fontePagadoraId          filtra por fatinstituicao.IdInstituicao
 *   pagina                   default 1
 *   tamanho                  1..200, default 50
 *   busca                    paciente, código da requisição, guia
 *
 * Variáveis de ambiente: DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
 *   + SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para validar a sessão.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { listarGlosasLegado, MAX_BUSCA, MAX_TAMANHO, TAMANHO_PADRAO } from '../faturamento/bdLab.js';

const DATA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    const periodoIni = primeiro(q.periodoIni)?.trim();
    const periodoFim = primeiro(q.periodoFim)?.trim();

    const fontePagadoraId = inteiroNaFaixa(primeiro(q.fontePagadoraId), 1, Number.MAX_SAFE_INTEGER);
    const pagina = inteiroNaFaixa(primeiro(q.pagina), 1, Number.MAX_SAFE_INTEGER);
    const tamanho = inteiroNaFaixa(primeiro(q.tamanho), 1, MAX_TAMANHO);

    const invalidos = [
      fontePagadoraId === null ? 'fontePagadoraId' : null,
      pagina === null ? 'pagina' : null,
      tamanho === null ? `tamanho (1..${MAX_TAMANHO})` : null,
    ].filter((c): c is string => c !== null);
    if (invalidos.length > 0) {
      res.status(400).json({ success: false, error: `Parâmetro inválido: ${invalidos.join(', ')}.` });
      return;
    }

    const faltando = [
      !periodoIni ? 'periodoIni' : null,
      !periodoFim ? 'periodoFim' : null,
    ].filter((c): c is string => c !== null);
    if (faltando.length > 0) {
      res.status(400).json({ success: false, error: 'Informe o período completo.', missing: faltando });
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

    const resultado = await listarGlosasLegado({
      periodoIni: periodoIni as string,
      periodoFim: periodoFim as string,
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

    // Dado financeiro: não deixa ficar em cache de navegador nem de proxy.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, meta: resultado.meta, glosas: resultado.glosas });
  } catch (err) {
    console.error('[faturamento/glosas-legado] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
