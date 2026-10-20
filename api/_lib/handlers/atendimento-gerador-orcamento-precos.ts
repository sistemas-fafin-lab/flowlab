/**
 * API Route: GET /api/atendimento/gerador-orcamento-precos
 *
 * Lista de preços do Gerador de Orçamento (área Atendimento): exames com preço
 * da tabela associada "Particular", convênios que atendem cada um e
 * elegibilidade ao desconto automático. Montagem em
 * api/_lib/orcamentoParticular.ts (buildOrcamentoParticular) — a mesma do
 * endpoint por chave de API da Tabela Particular. O custo só é consultado e
 * devolvido para quem tem canViewGeradorOrcamentoCustos; sem ela, os itens
 * saem sem a chave `custo`. A resposta traz `podeVerCustos` para a tela decidir
 * se mostra o PDF interno.
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
    const autorizacao = await autorizarGeradorOrcamento(tokenDoHeader(req.headers.authorization));
    if ('falha' in autorizacao) {
      res.status(autorizacao.falha.status).json(autorizacao.falha.payload);
      return;
    }

    const { podeVerCustos } = autorizacao.acesso;
    const itens = await buildOrcamentoParticular(getSupabaseAdminClient(), { incluirCusto: podeVerCustos });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, itens, podeVerCustos });
  } catch (err) {
    console.error('[atendimento/gerador-orcamento-precos] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
