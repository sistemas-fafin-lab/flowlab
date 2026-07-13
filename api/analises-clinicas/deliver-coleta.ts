/**
 * API Route: POST /api/analises-clinicas/deliver-coleta
 *
 * Vercel Serverless Function — propaga ao LAB-HUB a mudança de status da coleta
 * (direção FlowLab → LAB-HUB). Espelha deliver-resultado.ts: carrega o
 * ac_agendamentos, monta o payload, assina com HMAC-SHA256 e POSTa no webhook do
 * LAB-HUB (POST /api/v1/webhooks/coletas).
 *
 * Aciona-se automaticamente pelo gatilho ac_notificar_labhub_status (pg_net),
 * que dispara quando ac_agendamentos.status muda para 'em_coleta' / 'coletado' /
 * 'bloqueado' (ver migration 20260713120000_fase7_notificar_labhub_coleta.sql).
 * Também pode ser chamado manualmente (reconciliação) passando { agendamentoId }.
 *
 * Autorização: header `Authorization: Bearer <FLOWLAB_API_KEY>` (server-to-server).
 *
 * Variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FLOWLAB_API_KEY,
 *   LABHUB_API_URL, LABHUB_WEBHOOK_SECRET.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../_lib/supabase.js';
import { isFlowlabApiKeyValid, signHmacHex, requireEnv } from '../_lib/labhubIntegration.js';

// Estados da coleta que o LAB-HUB precisa refletir. O mapeamento p/ o vocabulário
// do LAB-HUB (coletado → realizado) é feito lá, em POST /webhooks/coletas.
const STATUS_PROPAGAVEIS = ['em_coleta', 'coletado', 'bloqueado'] as const;
type StatusPropagavel = (typeof STATUS_PROPAGAVEIS)[number];

// Exame marcado no check-in (snapshot). Espelha ExameColeta de @lab-hub/shared.
interface ExameColeta {
  nome: string;
  isCultura: boolean;
  material?: string;
}

// Espelha coletaStatusWebhookSchema de @lab-hub/api (apps/api/src/schemas/coletaStatus.ts).
interface ColetaStatusWebhookPayload {
  agendamentoLabhubId: string;
  status: StatusPropagavel;
  ocorridoEm?: string; // ISO 8601 com 'Z'
  exames?: ExameColeta[]; // presentes a partir de 'coletado'
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

  const { agendamentoId } = (req.body ?? {}) as { agendamentoId?: string };
  if (!agendamentoId) {
    res.status(400).json({ success: false, error: 'Campo obrigatório ausente: agendamentoId' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();

    const { data: agendamento, error } = await supabase
      .from('ac_agendamentos')
      .select('id, labhub_id, status, updated_at')
      .eq('id', agendamentoId)
      .single();

    if (error || !agendamento) {
      res.status(404).json({ success: false, error: 'Agendamento não encontrado' });
      return;
    }

    // Agendamento nativo do FlowLab (sem origem no LAB-HUB): nada a notificar.
    if (!agendamento.labhub_id) {
      res.status(200).json({ success: true, skipped: 'sem_labhub_id' });
      return;
    }

    // Status fora do conjunto propagável (ex.: 'recebido', 'cancelado'): ignora.
    if (!STATUS_PROPAGAVEIS.includes(agendamento.status as StatusPropagavel)) {
      res.status(200).json({ success: true, skipped: 'status_nao_propagavel', status: agendamento.status });
      return;
    }

    // Exames marcados no check-in (snapshot p/ a timeline do LAB-HUB). São gravados
    // em ac_agendamento_exames por registrar_coleta na mesma transação que faz
    // 'coletado', então em 'em_coleta'/'bloqueado' a lista vem vazia — só anexamos
    // quando há exames.
    const { data: exameRows } = await supabase
      .from('ac_agendamento_exames')
      .select('exame_nome, is_cultura')
      .eq('agendamento_id', agendamento.id);
    const exames: ExameColeta[] = (exameRows ?? []).map((e) => ({
      nome: e.exame_nome as string,
      isCultura: Boolean(e.is_cultura),
    }));

    const payload: ColetaStatusWebhookPayload = {
      agendamentoLabhubId: agendamento.labhub_id,
      status: agendamento.status as StatusPropagavel,
      ocorridoEm: new Date(agendamento.updated_at).toISOString(),
    };
    if (exames.length > 0) payload.exames = exames;

    // Assina e envia O MESMO corpo serializado (o LAB-HUB valida o HMAC sobre o
    // corpo cru exato — ver apps/api/src/lib/hmac.ts).
    const rawBody = JSON.stringify(payload);
    const signature = signHmacHex(rawBody, requireEnv('LABHUB_WEBHOOK_SECRET'));
    const url = `${requireEnv('LABHUB_API_URL')}/api/v1/webhooks/coletas`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body: rawBody,
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => resp.statusText);
      console.error('[analises-clinicas/deliver-coleta] LAB-HUB respondeu', resp.status);
      res.status(502).json({
        success: false,
        error: `LAB-HUB recusou o webhook (${resp.status})`,
        detail,
      });
      return;
    }

    res.status(200).json({ success: true, agendamentoLabhubId: payload.agendamentoLabhubId, status: payload.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[analises-clinicas/deliver-coleta] erro:', message);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
