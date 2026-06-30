/**
 * API Route: POST /api/analises-clinicas/receive-agendamento
 *
 * Vercel Serverless Function — recebe um agendamento confirmado pelo LAB-HUB
 * (direção LAB-HUB → FlowLab) e registra em ac_agendamentos.
 *
 * Autorização: header `Authorization: Bearer <FLOWLAB_API_KEY>` (server-to-server).
 * Idempotente: o LAB-HUB pode reenviar; a unicidade de labhub_id garante 1 linha.
 *
 * Variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FLOWLAB_API_KEY.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../_lib/supabase.js';
import { isFlowlabApiKeyValid } from '../_lib/labhubIntegration.js';

// Payload enviado pelo LAB-HUB (espelha AgendamentoPayloadFlowLab de @lab-hub/shared).
interface ReceiveAgendamentoBody {
  labhubId: string;
  pacienteNome: string;
  pacienteTelefone?: string;
  postoFlowlabId: string; // = ac_postos.id
  dataHora: string; // ISO 8601
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

  const { labhubId, pacienteNome, pacienteTelefone, postoFlowlabId, dataHora } =
    (req.body ?? {}) as Partial<ReceiveAgendamentoBody>;

  if (!labhubId || !pacienteNome || !postoFlowlabId || !dataHora) {
    res.status(400).json({
      success: false,
      error: 'Campos obrigatórios ausentes: labhubId, pacienteNome, postoFlowlabId, dataHora',
    });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();

    // Idempotência: se já recebemos esse labhub_id, devolve o flowlabId existente.
    const { data: existente } = await supabase
      .from('ac_agendamentos')
      .select('id')
      .eq('labhub_id', labhubId)
      .maybeSingle();
    if (existente) {
      res.status(200).json({ flowlabId: existente.id, idempotency: 'ignored' });
      return;
    }

    // Resolve o nome do posto para o snapshot (local_posto).
    const { data: posto } = await supabase
      .from('ac_postos')
      .select('id, nome')
      .eq('id', postoFlowlabId)
      .maybeSingle();

    const { data: criado, error } = await supabase
      .from('ac_agendamentos')
      .insert({
        labhub_id: labhubId,
        paciente_nome: pacienteNome,
        paciente_telefone: pacienteTelefone ?? null,
        posto_id: posto?.id ?? null,
        local_posto: posto?.nome ?? '',
        data_hora: dataHora,
        status: 'recebido',
      })
      .select('id')
      .single();

    if (error || !criado) {
      // Corrida: outra entrega inseriu o mesmo labhub_id entre o SELECT e o INSERT.
      if (error?.code === '23505') {
        const { data: agora } = await supabase
          .from('ac_agendamentos')
          .select('id')
          .eq('labhub_id', labhubId)
          .single();
        res.status(200).json({ flowlabId: agora?.id, idempotency: 'ignored' });
        return;
      }
      console.error('[analises-clinicas/receive-agendamento] insert falhou:', error?.message);
      res.status(500).json({ success: false, error: 'Falha ao registrar agendamento' });
      return;
    }

    res.status(201).json({ flowlabId: criado.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[analises-clinicas/receive-agendamento] erro inesperado:', message);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
