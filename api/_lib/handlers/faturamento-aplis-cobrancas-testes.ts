/**
 * API Route: GET /api/faturamento/aplis-cobrancas-testes
 *
 * Cobranças do apLIS (`fatexametipo`) com os testes de cada uma, para os campos
 * "Cobrança no apLIS" e "Teste no apLIS" do formulário de exame do Controle de
 * Custos (.scratch/controle-custos-vinculo-aplis-tuss/spec.md). Regra da
 * consulta em api/_lib/faturamento/bdLab.ts (listarCobrancasTestesAplis).
 *
 * Autorização: header `Authorization: Bearer <access_token>` da SESSÃO do operador
 * (exige canViewBilling ou canManageBilling — o gate da rota /cost-control). A
 * gravação do vínculo não passa por aqui: vai direto em custo_exames, com a RLS
 * como gate.
 *
 * Variáveis de ambiente: DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
 *   + SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para validar a sessão.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { listarCobrancasTestesAplis } from '../faturamento/bdLab.js';

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

    const resultado = await listarCobrancasTestesAplis();
    if ('erro' in resultado) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, cobrancas: resultado.cobrancas });
  } catch (err) {
    console.error('[faturamento/aplis-cobrancas-testes] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
