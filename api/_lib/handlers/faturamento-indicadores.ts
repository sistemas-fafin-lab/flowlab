/**
 * API Route: GET /api/faturamento/indicadores
 *
 * Página Faturamento → Indicadores (.scratch/faturamento-indicadores/spec.md):
 * total faturado, requisições e exames faturados do período, com a variação
 * sobre o período anterior, e o Top 10 de exames, de convênios e de clínicas
 * (nas ordens R$ e Qtd).
 * Lê do MySQL de backup do laboratório (bdLab.ts → listarLinhasFaturadas) as
 * linhas das duas janelas numa consulta só; a regra é de
 * faturamento/indicadoresFaturamento.ts.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling ou a chave da tela).
 *
 * Query params:
 *   modo      'mes' (padrão) | 'periodo'
 *   mes       YYYY-MM, obrigatório no modo Mês — mês da criação do lote
 *   inicio    YYYY-MM-DD, obrigatório no modo Período — criação do lote, inclusivo
 *   fim       YYYY-MM-DD, obrigatório no modo Período — inclusivo, ≥ inicio
 *   semCache  1 — fura o cache em memória da consulta
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { listarLinhasFaturadas } from '../faturamento/bdLab.js';
import { erroDoPeriodo, janelasDoPeriodo, mesValido, resumirIndicadores } from '../faturamento/indicadoresFaturamento.js';
import type { PeriodoIndicadores } from '../faturamento/indicadoresFaturamento.js';

function primeiro(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

function lerPeriodo(q: Record<string, string | string[] | undefined>): PeriodoIndicadores | { erro: string } {
  const modo = primeiro(q.modo)?.trim() || 'mes';
  if (modo === 'periodo') {
    const inicio = primeiro(q.inicio)?.trim() ?? '';
    const fim = primeiro(q.fim)?.trim() ?? '';
    const erro = erroDoPeriodo(inicio, fim);
    return erro ? { erro } : { modo, inicio, fim };
  }
  if (modo !== 'mes') return { erro: "Parâmetro inválido: modo ('mes' ou 'periodo')." };
  const mes = primeiro(q.mes)?.trim() ?? '';
  return mesValido(mes) ? { modo, mes } : { erro: 'Parâmetro inválido: mes (YYYY-MM).' };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  try {
    const token = tokenDoHeader(req.headers.authorization);
    const erroAuth = await autorizarFaturamento(token, ['indicadores']);
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const q = req.query as Record<string, string | string[] | undefined>;
    const periodo = lerPeriodo(q);
    if ('erro' in periodo) {
      res.status(400).json({ success: false, error: periodo.erro });
      return;
    }

    const janelas = janelasDoPeriodo(periodo);
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
