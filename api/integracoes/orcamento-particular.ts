/**
 * API Route: GET /api/integracoes/orcamento-particular
 *
 * Vercel Serverless Function — leitura só-leitura, server-to-server, pra
 * Tabela Particular (app externo) ler preço/custo/elegibilidade de desconto
 * automático por TUSS do orçamento Particular, mais os convênios que atendem
 * cada exame (só nomes, sem valor negociado). Mesmo padrão de "app externo
 * chama com uma API key dedicada" usado pela integração com o LAB-HUB
 * (api/_lib/labhubIntegration.ts), mas com blast radius separado.
 *
 * Autorização: header `Authorization: Bearer <TABELA_PARTICULAR_API_KEY>` —
 * chave dedicada, não reaproveita FLOWLAB_API_KEY.
 *
 * Sem paginação: devolve a lista inteira num payload só (mesmo padrão que a
 * Tabela Particular já usa hoje pro Google Sheets).
 *
 * Variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * TABELA_PARTICULAR_API_KEY.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../_lib/supabase.js';
import { describeError } from '../_lib/errors.js';
import { buildOrcamentoParticular, isTabelaParticularApiKeyValid } from '../_lib/orcamentoParticular.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  let autorizado: boolean;
  try {
    autorizado = isTabelaParticularApiKeyValid(req);
  } catch (err) {
    console.error('[integracoes/orcamento-particular] erro de configuração:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
    return;
  }
  if (!autorizado) {
    res.status(401).json({ success: false, error: 'Não autorizado' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const itens = await buildOrcamentoParticular(supabase);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(itens);
  } catch (err) {
    console.error('[integracoes/orcamento-particular] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
