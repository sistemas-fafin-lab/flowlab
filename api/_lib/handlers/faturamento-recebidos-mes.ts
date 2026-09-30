/**
 * API Route: GET /api/faturamento/recebidos-mes?competencia=2026-09
 *
 * Recebimentos de um mês pelo apLIS (MySQL de backup), para o widget "Recebido
 * no mês" do Dashboard de Contas a Receber: soma de `VlrRecebido` das
 * requisições cujo recebimento mais novo (`DtaRecebido`) cai no mês, agregado
 * por fonte pagadora e lote. Regra e armadilhas em `listarRecebidosMes`
 * (api/_lib/faturamento/bdLab.ts).
 *
 * Devolve TODAS as fontes pagadoras: o recorte pela whitelist da meta e pelo
 * filtro de operadora da tela é feito no cliente, que conhece o mapeamento
 * `operadoras.aplis_id` ↔ `IdFontePagadora`.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling).
 * Query: competencia=YYYY-MM (obrigatório); semCache=1 fura o cache de 3 min.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { listarRecebidosMes } from '../faturamento/bdLab.js';

const COMPETENCIA_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

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
    const competencia = primeiro(q.competencia)?.trim() ?? '';
    const partes = COMPETENCIA_RE.exec(competencia);
    if (!partes) {
      res.status(400).json({ success: false, error: 'Informe competencia no formato YYYY-MM.' });
      return;
    }

    // Último dia do mês em aritmética de calendário pura (Date.UTC não sofre
    // com o fuso do processo, que é UTC na Vercel e -03 em dev).
    const ano = Number(partes[1]);
    const mes = Number(partes[2]);
    const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const desde = `${competencia}-01`;
    const ate = `${competencia}-${String(ultimoDia).padStart(2, '0')}`;

    const resultado = await listarRecebidosMes({ desde, ate, ignorarCache: primeiro(q.semCache) === '1' });
    if ('erro' in resultado) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, meta: { competencia, desde, ate }, lotes: resultado.lotes });
  } catch (err) {
    console.error('[faturamento/recebidos-mes] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
