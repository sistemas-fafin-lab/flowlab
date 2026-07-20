/**
 * API Route: GET /api/analises-clinicas/buscar-pacientes?q=<termo>
 *
 * Vercel Serverless Function — typeahead da recepção: busca pacientes já
 * cadastrados no LAB-HUB (por nome) para o operador vincular o agendamento a uma
 * pessoa existente. Proxy: a FLOWLAB_API_KEY é server-side, então o SPA não pode
 * chamar o LAB-HUB direto.
 *
 * Autorização: header `Authorization: Bearer <access_token>` da SESSÃO do operador
 * (exige canManageColetas) — como get-documentos.ts, aqui `Bearer` NÃO é a
 * FLOWLAB_API_KEY. Não use `isFlowlabApiKeyValid` aqui.
 *
 * Variáveis de ambiente: ver api/_lib/recepcaoAgendamento.ts
 *   (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LABHUB_API_URL, FLOWLAB_API_KEY).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buscarPacientesRecepcao } from '../_lib/recepcaoAgendamento.js';
import { describeError } from '../_lib/errors.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const { q } = req.query;

  try {
    const { status, payload } = await buscarPacientesRecepcao(
      token,
      typeof q === 'string' ? q : undefined,
    );
    // A resposta carrega dados pessoais de pacientes: não cachear.
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json(payload);
  } catch (err) {
    console.error('[analises-clinicas/buscar-pacientes] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
