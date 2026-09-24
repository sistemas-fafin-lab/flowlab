/**
 * API Route: GET /api/faturamento/status-faturamento
 *
 * Opções do filtro "Status Faturamento" das abas Faturas e Contas a Receber →
 * Pendências: os valores de `eventofatur` do MySQL de backup do laboratório (o
 * mesmo <select> "Status Faturamento" da tela de faturamento do apLIS). É config
 * editável pelo laboratório no apLIS, então vem do banco em vez de uma lista fixa.
 *
 * Devolve ativos e inativos (`inativo`), em ordem alfabética: o apLIS só oferece os
 * ativos, e o front faz o mesmo, mas o rótulo de um inativo ainda é necessário para
 * requisições antigas que o têm gravado.
 *
 * Autorização: `Authorization: Bearer <access_token>` da sessão do operador
 * (exige canViewBilling).
 *
 * Query params:
 *   semCache  '1' ignora o cache em memória do servidor (TTL 3 min)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { listarEventosFaturamento } from '../faturamento/bdLab.js';

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
    const resultado = await listarEventosFaturamento(primeiro(q.semCache) === '1');
    if ('erro' in resultado) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, status: resultado.eventos });
  } catch (err) {
    console.error('[faturamento/status-faturamento] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
