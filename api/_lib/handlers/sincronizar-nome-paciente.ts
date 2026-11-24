/**
 * API Route: POST /api/analises-clinicas/sincronizar-nome-paciente
 *
 * Leva ao LAB-HUB o nome do paciente corrigido no FlowLab depois da coleta
 * (RPC editar_coleta). Corpo: { agendamentoId } — o nome é lido de
 * ac_agendamentos no servidor, não vem do cliente.
 *
 * Autorização: `Authorization: Bearer <access_token>` da SESSÃO do operador
 * (exige canEditarColeta). Não é a FLOWLAB_API_KEY.
 *
 * Variáveis de ambiente: ver api/_lib/recepcaoAgendamento.ts.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sincronizarNomePacienteLabhub } from '../recepcaoAgendamento.js';
import { describeError } from '../errors.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const body = (req.body ?? {}) as Record<string, unknown>;

  try {
    const { status, payload } = await sincronizarNomePacienteLabhub(token, {
      agendamentoId: typeof body.agendamentoId === 'string' ? body.agendamentoId : undefined,
    });
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json(payload);
  } catch (err) {
    console.error('[analises-clinicas/sincronizar-nome-paciente] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
