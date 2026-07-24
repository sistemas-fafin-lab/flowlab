/**
 * API Route: POST /api/analises-clinicas/receive-documento
 *
 * LAB-HUB → FlowLab (server-to-server): avisa que um pedido médico foi anexado a
 * um agendamento. Dispara o enfileiramento automático ao Álvaro em segundo plano
 * (autoStageAgendamento). Cobre o caso comum em que o agendamento foi criado SEM
 * documento e o paciente anexa o pedido depois — o gatilho de receive-agendamento
 * sozinho pegaria só quem já tem o documento na criação.
 *
 * Autorização: header `Authorization: Bearer <FLOWLAB_API_KEY>`, como
 * receive-agendamento/receive-cancelamento (NÃO é JWT de sessão).
 * Idempotente: autoStageAgendamento deduplica (um agendamento nunca vira dois itens).
 *
 * Body: { labhubId: string, tipo?: string } — labhubId = id do agendamento no
 *   LAB-HUB (= ac_agendamentos.labhub_id no FlowLab).
 *
 * Variáveis de ambiente: as do pipeline (SUPABASE_*, GEMINI_*, APLIS_*,
 *   AOL_ENTIDADE/IDAGENTE) + LABHUB_API_URL, FLOWLAB_API_KEY (busca do documento).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { waitUntil } from '@vercel/functions';
import { getSupabaseAdminClient } from '../supabase.js';
import { isFlowlabApiKeyValid } from '../labhubIntegration.js';
import { describeError } from '../errors.js';
import { autoStageAgendamento } from '../apoio/autoStage.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  if (!isFlowlabApiKeyValid(req)) {
    res.status(401).json({ success: false, error: 'Não autorizado' });
    return;
  }

  const { labhubId } = (req.body ?? {}) as { labhubId?: string; tipo?: string };
  if (!labhubId || typeof labhubId !== 'string') {
    res.status(400).json({ success: false, error: 'Campo obrigatório ausente: labhubId' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();

    // Resolve o agendamento do FlowLab a partir do id do LAB-HUB. Se o agendamento
    // ainda não foi sincronizado (documento anexado antes do receive-agendamento),
    // apenas confirma: o gatilho de receive-agendamento fará o estágio ao chegar,
    // e o botão "Processar pendentes" cobre qualquer sobra.
    const { data: agendamento } = await supabase
      .from('ac_agendamentos')
      .select('id')
      .eq('labhub_id', labhubId)
      .maybeSingle();

    if (!agendamento) {
      res.status(200).json({ ok: true, ignored: 'agendamento_nao_sincronizado' });
      return;
    }

    // Estágio em segundo plano — o OCR passa dos 30s e o LAB-HUB não pode esperar.
    try {
      waitUntil(autoStageAgendamento(supabase, agendamento.id));
    } catch (bgErr) {
      console.error('[analises-clinicas/receive-documento] waitUntil falhou:', describeError(bgErr));
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[analises-clinicas/receive-documento] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
