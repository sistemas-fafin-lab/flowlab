/**
 * API Route: GET /api/faturamento/indicadores
 *
 * Página Faturamento → Indicadores (.scratch/faturamento-indicadores/spec.md):
 * total faturado, requisições e exames faturados do período, com a variação
 * sobre o período anterior, e o Top 10 de convênios (nas ordens R$ e Qtd).
 * Lê do MySQL de backup do laboratório (bdLab.ts → listarLinhasFaturadas) as
 * linhas das duas janelas numa consulta só; a regra é de
 * faturamento/indicadoresFaturamento.ts.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling).
 *
 * Query params:
 *   mes       YYYY-MM, obrigatório — mês da criação do lote
 *   semCache  1 — fura o cache em memória da consulta
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { listarLinhasFaturadas } from '../faturamento/bdLab.js';
import { janelasDoPeriodo, mesValido, resumirIndicadores } from '../faturamento/indicadoresFaturamento.js';

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
    const erroAuth = await autorizarFaturamento(token);
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const q = req.query as Record<string, string | string[] | undefined>;
    const mes = primeiro(q.mes)?.trim() ?? '';
    if (!mesValido(mes)) {
      res.status(400).json({ success: false, error: 'Parâmetro inválido: mes (YYYY-MM).' });
      return;
    }

    const janelas = janelasDoPeriodo({ modo: 'mes', mes });
    const resultado = await listarLinhasFaturadas({
      desde: janelas.anterior.inicio,
      ate: janelas.atual.fim,
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
      meta: { dadoAte: resultado.dadoAte, janelas },
      indicadores: resumirIndicadores(resultado.linhas, janelas),
    });
  } catch (err) {
    console.error('[faturamento/indicadores] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
