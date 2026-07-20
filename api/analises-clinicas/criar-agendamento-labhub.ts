/**
 * API Route: POST /api/analises-clinicas/criar-agendamento-labhub
 *
 * Vercel Serverless Function — a recepção cria um agendamento (walk-in / encaixe)
 * vinculado a um paciente do LAB-HUB. Se o paciente ainda não existe, o LAB-HUB
 * cria uma linha "fantasma" (só nome/cpf/data_nascimento) que a pessoa reivindica
 * ao se cadastrar com o mesmo CPF. O agendamento é sincronizado de volta e nasce
 * aqui em ac_agendamentos (com labhub_id) pelo caminho normal.
 *
 * Proxy: a FLOWLAB_API_KEY é server-side, então o SPA não pode chamar o LAB-HUB
 * direto. Autorização: header `Authorization: Bearer <access_token>` da SESSÃO do
 * operador (exige canManageColetas) — aqui `Bearer` NÃO é a FLOWLAB_API_KEY.
 *
 * Variáveis de ambiente: ver api/_lib/recepcaoAgendamento.ts
 *   (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LABHUB_API_URL, FLOWLAB_API_KEY).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  criarAgendamentoRecepcao,
  type CriarAgendamentoRecepcaoBody,
} from '../_lib/recepcaoAgendamento.js';
import { describeError } from '../_lib/errors.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  try {
    const { status, payload } = await criarAgendamentoRecepcao(
      token,
      (req.body ?? {}) as CriarAgendamentoRecepcaoBody,
    );
    res.status(status).json(payload);
  } catch (err) {
    console.error('[analises-clinicas/criar-agendamento-labhub] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
