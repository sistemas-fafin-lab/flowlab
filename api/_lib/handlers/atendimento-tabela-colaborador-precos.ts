/**
 * API Route: GET /api/atendimento/tabela-colaborador-precos
 *
 * Lista do modo Tabela Colaborador do Gerador de Orçamento (área Atendimento):
 * exames do Controle de Custos com custo ou com preço Particular, incluindo os
 * de uso interno, cada um com o preço Particular (ou null) e o Valor
 * colaborador (ou o motivo de "consultar a gestão"). Montagem em
 * api/_lib/orcamentoParticular.ts (buildOrcamentoParticular, modo
 * 'colaborador'), com os parâmetros da regra lidos a cada chamada. O custo só
 * é devolvido para quem tem canViewGeradorOrcamentoCustos. Ver
 * .scratch/tabela-colaborador/spec.md.
 *
 * Autorização: header `Authorization: Bearer <access_token>` da SESSÃO do
 * usuário (exige canUseTabelaColaborador). Regra em api/_lib/atendimento/autorizacao.ts.
 *
 * Variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../supabase.js';
import { describeError } from '../errors.js';
import { autorizarTabelaColaborador, tokenDoHeader } from '../atendimento/autorizacao.js';
import { buildOrcamentoParticular } from '../orcamentoParticular.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  try {
    const autorizacao = await autorizarTabelaColaborador(tokenDoHeader(req.headers.authorization));
    if ('falha' in autorizacao) {
      res.status(autorizacao.falha.status).json(autorizacao.falha.payload);
      return;
    }

    const { podeVerCustos } = autorizacao.acesso;
    const itens = await buildOrcamentoParticular(getSupabaseAdminClient(), {
      incluirCusto: podeVerCustos,
      modo: 'colaborador',
    });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, itens, podeVerCustos });
  } catch (err) {
    console.error('[atendimento/tabela-colaborador-precos] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
