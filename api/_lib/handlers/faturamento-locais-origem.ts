/**
 * API Route: GET /api/faturamento/locais-origem
 *
 * Busca de locais de origem do apLIS por nome, para o modal "Clínicas sem NF" da
 * aba Faturamento → Contas a Receber → Pendências → Particulares. Regra da
 * consulta em api/_lib/faturamento/bdLab.ts (buscarLocaisOrigem).
 *
 * Autorização: header `Authorization: Bearer <access_token>` da SESSÃO do operador
 * (exige canViewBilling, canManageBilling ou canViewContasReceber). A escrita na lista de clínicas sem NF
 * não passa por aqui: vai direto na tabela clinicas_sem_nf, com a RLS como gate.
 *
 * Query params:
 *   busca  obrigatório, 2..MAX_BUSCA caracteres — casa nome fantasia ou razão social
 *
 * Variáveis de ambiente: DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
 *   + SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para validar a sessão.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { buscarLocaisOrigem, MAX_BUSCA } from '../faturamento/bdLab.js';

/** Com um caractere só, o LIKE '%x%' casa quase todos os locais. */
const MIN_BUSCA = 2;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  try {
    const erroAuth = await autorizarFaturamento(tokenDoHeader(req.headers.authorization), ['contasReceber']);
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const bruto = req.query.busca;
    const busca = (Array.isArray(bruto) ? bruto[0] : bruto)?.trim() ?? '';
    if (busca.length < MIN_BUSCA || busca.length > MAX_BUSCA) {
      res.status(400).json({
        success: false,
        error: `Parâmetro inválido: busca (${MIN_BUSCA}..${MAX_BUSCA} caracteres).`,
      });
      return;
    }

    const resultado = await buscarLocaisOrigem(busca);
    if ('erro' in resultado) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, locais: resultado.locais });
  } catch (err) {
    console.error('[faturamento/locais-origem] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
