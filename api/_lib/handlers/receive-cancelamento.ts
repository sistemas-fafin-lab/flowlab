/**
 * API Route: POST /api/analises-clinicas/receive-cancelamento
 *
 * Vercel Serverless Function — recebe a notificação de que um agendamento foi
 * cancelado no LAB-HUB (direção LAB-HUB → FlowLab) e marca o ac_agendamentos
 * correspondente como 'cancelado'. Como a disponibilidade (get-disponibilidade)
 * deriva a ocupação de ac_agendamentos ativos, marcar 'cancelado' libera o
 * horário automaticamente.
 *
 * Autorização: header `Authorization: Bearer <FLOWLAB_API_KEY>` (server-to-server).
 * Idempotente: o LAB-HUB pode reenviar; cancelar de novo é no-op. Se o
 * agendamento não existir aqui (nunca sincronizado), responde 200 sem erro.
 *
 * Variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FLOWLAB_API_KEY.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../supabase.js';
import { isFlowlabApiKeyValid } from '../labhubIntegration.js';
import { describeError } from '../errors.js';

// Payload enviado pelo LAB-HUB (espelha CancelamentoPayloadFlowLab de @lab-hub/shared).
interface ReceiveCancelamentoBody {
  labhubId: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  if (!isFlowlabApiKeyValid(req)) {
    res.status(401).json({ success: false, error: 'Não autorizado' });
    return;
  }

  const { labhubId } = (req.body ?? {}) as Partial<ReceiveCancelamentoBody>;
  if (!labhubId) {
    res.status(400).json({ success: false, error: 'Campo obrigatório ausente: labhubId' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();

    // UPDATE condicional: só afeta a linha que ainda não está 'cancelado'. Devolve
    // a linha afetada — assim distinguimos "cancelei agora" de "nada a fazer".
    const { data: cancelado, error } = await supabase
      .from('ac_agendamentos')
      .update({ status: 'cancelado' })
      .eq('labhub_id', labhubId)
      .neq('status', 'cancelado')
      .select('id')
      .maybeSingle();
    if (error) {
      console.error('[analises-clinicas/receive-cancelamento] update falhou:', error.message);
      res.status(500).json({ success: false, error: 'Falha ao cancelar agendamento' });
      return;
    }

    if (cancelado) {
      res.status(200).json({ flowlabId: cancelado.id, status: 'cancelado' });
      return;
    }

    // Nenhuma linha afetada: ou já estava cancelado (idempotente) ou nunca chegou
    // aqui (agendamento não sincronizado). Ambos os casos são sucesso.
    const { data: existente } = await supabase
      .from('ac_agendamentos')
      .select('id, status')
      .eq('labhub_id', labhubId)
      .maybeSingle();
    if (existente) {
      res.status(200).json({ flowlabId: existente.id, status: existente.status, idempotency: 'ignored' });
      return;
    }
    res.status(200).json({ status: 'nao_encontrado', idempotency: 'ignored' });
  } catch (err) {
    console.error('[analises-clinicas/receive-cancelamento] erro inesperado:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
