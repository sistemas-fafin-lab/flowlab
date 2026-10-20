/**
 * API Route: GET /api/atendimento/gerador-orcamento-precos
 *
 * Lista de preços do Gerador de Orçamento (área Atendimento): exames com preço
 * da tabela associada "Particular", convênios que atendem cada um e
 * elegibilidade ao desconto automático. Montagem em
 * api/_lib/orcamentoParticular.ts (buildOrcamentoParticular) — a mesma do
 * endpoint por chave de API da Tabela Particular, mas aqui SEM custo: o custo
 * nem é consultado, e os itens saem sem a chave `custo`.
 *
 * Autorização: header `Authorization: Bearer <access_token>` da SESSÃO do
 * usuário (exige canUseGeradorOrcamento). Regra em api/_lib/atendimento/autorizacao.ts.
 *
 * Variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../supabase.js';
import { describeError } from '../errors.js';
import { autorizarGeradorOrcamento, tokenDoHeader } from '../atendimento/autorizacao.js';
import { buildOrcamentoParticular } from '../orcamentoParticular.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  try {
    const erroAuth = await autorizarGeradorOrcamento(tokenDoHeader(req.headers.authorization));
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const itens = await buildOrcamentoParticular(getSupabaseAdminClient(), { incluirCusto: false });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, itens });
  } catch (err) {
    console.error('[atendimento/gerador-orcamento-precos] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
