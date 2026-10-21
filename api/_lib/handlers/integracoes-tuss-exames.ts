/**
 * API Route: GET /api/integracoes/tuss-exames
 *
 * Handler despachado por api/integracoes/[action].ts — leitura só-leitura, server-to-server, pro
 * Sistema de Admissão copiar o que precisa para escolher o TUSS de um
 * procedimento ao enviar a requisição ao AEL: os exames do catálogo ligados a
 * cobrança/teste do apLIS, as linhas de fontes pagadoras e as exclusões. Sem
 * valores nem custos. Mesmo padrão de api/_lib/handlers/integracoes-orcamento-particular.ts.
 *
 * Autorização: header `Authorization: Bearer <ADMISSAO_API_KEY>` — chave
 * dedicada, não reaproveita FLOWLAB_API_KEY nem TABELA_PARTICULAR_API_KEY.
 *
 * Sem paginação: devolve tudo num payload só, pra cópia ser completa.
 *
 * Variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * ADMISSAO_API_KEY.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../supabase.js';
import { describeError } from '../errors.js';
import { buildTussExames, isAdmissaoApiKeyValid } from '../tussExames.js';

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
    autorizado = isAdmissaoApiKeyValid(req);
  } catch (err) {
    console.error('[integracoes/tuss-exames] erro de configuração:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
    return;
  }
  if (!autorizado) {
    res.status(401).json({ success: false, error: 'Não autorizado' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const payload = await buildTussExames(supabase);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(payload);
  } catch (err) {
    console.error('[integracoes/tuss-exames] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
