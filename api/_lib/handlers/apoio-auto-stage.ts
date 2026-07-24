/**
 * API Route: POST /api/analises-clinicas/apoio-auto-stage
 *
 * Varredura de recuperação do enfileiramento automático ao Álvaro. Processa UM
 * agendamento por chamada (o front chama em laço, um a um, mantendo cada request
 * dentro do maxDuration) — para os casos em que o documento chegou depois da
 * criação do agendamento, ou que são anteriores a esta feature. É o mesmo núcleo
 * do gatilho de receive-agendamento (api/_lib/apoio/autoStage.ts).
 *
 * Autorização: JWT de SESSÃO do operador (canManageColetas).
 * Body: { agendamentoId: string } — resposta: { success, resultado: {...} }.
 *
 * Variáveis de ambiente: as mesmas do pipeline (SUPABASE_*, GEMINI_*, APLIS_*,
 *   AOL_ENTIDADE/IDAGENTE) + LABHUB_API_URL, FLOWLAB_API_KEY (busca do documento).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../supabase.js';
import { autorizarOperador } from '../recepcaoAgendamento.js';
import { describeError } from '../errors.js';
import { autoStageAgendamento } from '../apoio/autoStage.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const erroAuth = await autorizarOperador(token);
  if (erroAuth) {
    res.status(erroAuth.status).json(erroAuth.payload);
    return;
  }

  const agendamentoId = (req.body as { agendamentoId?: unknown })?.agendamentoId;
  if (typeof agendamentoId !== 'string' || !UUID_RE.test(agendamentoId)) {
    res.status(400).json({ success: false, error: 'Informe agendamentoId (uuid).' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const resultado = await autoStageAgendamento(supabase, agendamentoId);
    res.status(200).json({ success: true, resultado });
  } catch (err) {
    console.error('[analises-clinicas/apoio-auto-stage] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao enfileirar o agendamento.' });
  }
}
