/**
 * API Route: GET /api/faturamento/dashboard-glosa-saldo
 *
 * Dashboard do Contas a Receber, cards "Glosa recuperada" e "Saldo pendente"
 * (.scratch/faturamento-comparativos/issues/10-cards-glosa-recuperada-e-saldo-pendente.md).
 * Cálculo em utils/cardsGlosaSaldo.ts, sobre as mesmas leituras do funil de glosa da aba
 * Comparativos (faturamento/dadosFunilGlosa.ts):
 *   - Recuperada: mapeamento proposto em faturamento/glosaRecuperada.ts (a confirmar), na data
 *     da glosa no funil; num mês inteiro bate com a linha "da qual, glosa recuperada".
 *   - Saldo pendente: Faturado − Recebido − Acatado (acatada do apLIS) dos títulos emitidos no
 *     período, a mesma conta do `valor_saldo` e do Saldo por operadora.
 *
 * Obedece ao período e à operadora do Dashboard; ignora os filtros de lote e de nota, porque
 * a Recuperada vem da foto de recursos do apLIS (por requisição, não por título).
 *
 * Autorização: header `Authorization: Bearer <access_token>` (canViewBilling ou a chave da
 * tela Contas a Receber). Dados lidos com o cliente do usuário (RLS).
 *
 * Query params:
 *   desde, ate   YYYY-MM-DD — obrigatórios (emissão do título)
 *   operadoraId  repetível (`operadoras.id_operadora`); ausente = todas as da meta
 *
 * Falha do Supabase → 502.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { fontesDaMeta, glosasParaFunil, titulosParaFunil } from '../faturamento/dadosFunilGlosa.js';
import { ErroSupabase } from '../faturamento/titulosConferencia.js';
import { getSupabaseUserClient } from '../supabase.js';
import { cardsGlosaSaldo, mesesDoPeriodo } from '../../../src/modules/faturamento/utils/cardsGlosaSaldo.js';

const DATA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function lista(valor: string | string[] | undefined): string[] {
  const itens = Array.isArray(valor) ? valor : valor === undefined ? [] : [valor];
  return itens.map((v) => v.trim()).filter((v) => v !== '');
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
    const desde = lista(q.desde)[0] ?? '';
    const ate = lista(q.ate)[0] ?? '';
    if (!DATA_ISO_RE.test(desde) || !DATA_ISO_RE.test(ate) || desde > ate) {
      res.status(400).json({ success: false, error: 'Informe desde e ate no formato YYYY-MM-DD, com desde ≤ ate.' });
      return;
    }
    const operadoraIds = lista(q.operadoraId);

    const supabase = getSupabaseUserClient(token as string);
    let cards;
    try {
      const [{ titulos, loteDoAplis }, fontes] = await Promise.all([
        titulosParaFunil(supabase, desde, ate, operadoraIds),
        fontesDaMeta(supabase, operadoraIds),
      ]);
      const { glosas, primeiraEmissaoDoLote } = await glosasParaFunil(
        supabase,
        titulos,
        loteDoAplis,
        mesesDoPeriodo(desde, ate),
        fontes,
      );
      cards = cardsGlosaSaldo({ desde, ate, titulos, glosas, primeiraEmissaoDoLote });
    } catch (err) {
      if (!(err instanceof ErroSupabase)) throw err;
      console.error('[faturamento/dashboard-glosa-saldo] Supabase:', err.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler a glosa recuperada e o saldo pendente agora — tente novamente em alguns minutos.',
      });
      return;
    }

    // Dado financeiro: não deixa ficar em cache de navegador nem de proxy.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, desde, ate, cards });
  } catch (err) {
    console.error('[faturamento/dashboard-glosa-saldo] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
