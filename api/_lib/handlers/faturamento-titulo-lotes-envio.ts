/**
 * API Route: GET /api/faturamento/titulo-lotes-envio?idsLote=6607,6608
 *
 * Revalida ao vivo o `DtaEnvio` de um conjunto de lotes, direto no apLIS —
 * issue 15 do feedback do setor de faturamento (24/08): `dataEnvio` do título
 * é um snapshot gravado uma única vez na criação (fat_criar_titulo), então um
 * lote cujo envio só foi preenchido DEPOIS do título criado fica "sem envio"
 * pra sempre na tela, mesmo já enviado no apLIS. A expansão do título
 * (TitulosList.tsx) chama esta rota para conferir o estado atual, em vez de
 * confiar só no `lotes.data_envio` congelado.
 *
 * Reaproveita `listarLotes` (mesma consulta da aba Faturas), DE PROPÓSITO sem
 * `ignorarCache: true`: o item 2 da issue pede um cache curto (mesmo padrão de
 * 3 min do resto do módulo) pra não bater no MySQL de backup a cada expansão de
 * título — diferente de titulo-criar.ts, que precisa do estado exato do banco
 * porque grava um snapshot permanente. Aqui um valor de até 3 min é aceitável:
 * a tela só precisa parar de mostrar um envio que já aconteceu há muito mais
 * tempo que isso.
 *
 * Autorização: `Authorization: Bearer <access_token>` da sessão do operador
 * (exige canViewBilling — mesma leitura de lote-detalhe).
 *
 * Variáveis de ambiente: DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
 *   + SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para validar a sessão.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { listarLotes, MAX_LOTES_TITULO, MAX_TAMANHO } from '../faturamento/bdLab.js';

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
    const erroAuth = await autorizarFaturamento(tokenDoHeader(req.headers.authorization));
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const q = req.query as Record<string, string | string[] | undefined>;
    const bruto = primeiro(q.idsLote) ?? '';
    const idsLote = [
      ...new Set(
        bruto
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isInteger(n) && n > 0),
      ),
    ];

    if (idsLote.length === 0) {
      res.status(400).json({ success: false, error: 'Informe idsLote (lista separada por vírgula).' });
      return;
    }
    if (idsLote.length > MAX_LOTES_TITULO) {
      res.status(400).json({ success: false, error: `idsLote (máximo ${MAX_LOTES_TITULO})` });
      return;
    }

    const resultado = await listarLotes({ idsLote, pagina: 1, tamanho: MAX_TAMANHO });
    if ('erro' in resultado) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    // Só os lotes que o apLIS de fato devolveu — um lote ausente aqui (excluído
    // lá, ou IdLote digitado errado num título antigo) faz o cliente cair de
    // volta pro snapshot em vez de assumir "sem envio".
    const envios: Record<string, string | null> = {};
    for (const lote of resultado.lotes) envios[String(lote.idLote)] = lote.dtaEnvio;

    // Dado financeiro consultado ao vivo: não cachear no navegador/proxy.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, envios });
  } catch (err) {
    console.error('[faturamento/titulo-lotes-envio] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
