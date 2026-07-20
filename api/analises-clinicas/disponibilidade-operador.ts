/**
 * API Route: GET /api/analises-clinicas/disponibilidade-operador
 *
 * Vercel Serverless Function — devolve a disponibilidade dos postos (mesma grade
 * que o paciente vê) para o operador escolher um horário real ao criar um
 * agendamento manual. Difere de get-disponibilidade.ts só na autorização: aqui é o
 * JWT de SESSÃO do operador (exige canManageColetas), não a FLOWLAB_API_KEY — por
 * isso o SPA pode chamar. O cálculo é o mesmo (api/_lib/disponibilidade.ts).
 *
 * Variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   DISPONIBILIDADE_DIAS (opcional), AGENDA_TZ_OFFSET (opcional).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { disponibilidadeOperador } from '../_lib/recepcaoAgendamento.js';
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

  try {
    const { status, payload } = await disponibilidadeOperador(token);
    res.status(status).json(payload);
  } catch (err) {
    console.error('[analises-clinicas/disponibilidade-operador] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
