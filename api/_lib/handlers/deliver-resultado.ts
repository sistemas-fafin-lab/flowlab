/**
 * API Route: POST /api/analises-clinicas/deliver-resultado
 *
 * Vercel Serverless Function — envia um resultado liberado ao LAB-HUB
 * (direção FlowLab → LAB-HUB, D1). Carrega ac_resultados, monta o payload com
 * painéis estruturados, assina com HMAC-SHA256 e POSTa no webhook do LAB-HUB.
 *
 * Nesta fatia de integração não há UI: aciona-se via curl/script com a
 * FLOWLAB_API_KEY, passando { resultadoId }.
 *
 * Autorização: header `Authorization: Bearer <FLOWLAB_API_KEY>` (server-to-server).
 *
 * Variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FLOWLAB_API_KEY,
 *   LABHUB_API_URL, LABHUB_WEBHOOK_SECRET.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../supabase.js';
import { isFlowlabApiKeyValid, signHmacHex, requireEnv } from '../labhubIntegration.js';
import { describeError } from '../errors.js';

// Espelha ResultadoWebhookPayload de @lab-hub/shared / resultadoWebhookSchema.
interface ResultadoWebhookPayload {
  agendamentoLabhubId: string;
  exameNome: string;
  categoria?: string;
  resumo?: string;
  paineis: unknown[];
  laudoUrl?: string;
  declaracaoUrl?: string;
  liberadoEm: string; // ISO 8601 com 'Z' (z.datetime() do LAB-HUB não aceita offset)
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

  const { resultadoId } = (req.body ?? {}) as { resultadoId?: string };
  if (!resultadoId) {
    res.status(400).json({ success: false, error: 'Campo obrigatório ausente: resultadoId' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();

    const { data: resultado, error } = await supabase
      .from('ac_resultados')
      .select(
        'id, agendamento_id, exame_nome, categoria, resumo, paineis, laudo_url, declaracao_url, liberado_em',
      )
      .eq('id', resultadoId)
      .single();

    if (error || !resultado) {
      res.status(404).json({ success: false, error: 'Resultado não encontrado' });
      return;
    }

    // Busca o labhub_id do agendamento numa consulta simples (evita o typing de
    // relação embutida do supabase-js quando não há tipos gerados do schema).
    const { data: agendamento } = await supabase
      .from('ac_agendamentos')
      .select('labhub_id')
      .eq('id', resultado.agendamento_id)
      .maybeSingle();
    const agendamentoLabhubId = agendamento?.labhub_id;
    if (!agendamentoLabhubId) {
      res.status(422).json({ success: false, error: 'Agendamento do resultado sem labhub_id' });
      return;
    }

    // Monta o payload — campos opcionais só entram se presentes (o schema do
    // LAB-HUB usa .optional(), que NÃO aceita null).
    const payload: ResultadoWebhookPayload = {
      agendamentoLabhubId,
      exameNome: resultado.exame_nome,
      paineis: Array.isArray(resultado.paineis) ? resultado.paineis : [],
      liberadoEm: new Date(resultado.liberado_em).toISOString(),
    };
    if (resultado.categoria) payload.categoria = resultado.categoria;
    if (resultado.resumo) payload.resumo = resultado.resumo;
    if (resultado.laudo_url) payload.laudoUrl = resultado.laudo_url;
    if (resultado.declaracao_url) payload.declaracaoUrl = resultado.declaracao_url;

    // Assina e envia O MESMO corpo serializado (o LAB-HUB valida o HMAC sobre o
    // corpo cru exato — ver apps/api/src/lib/hmac.ts).
    const rawBody = JSON.stringify(payload);
    const signature = signHmacHex(rawBody, requireEnv('LABHUB_WEBHOOK_SECRET'));
    const url = `${requireEnv('LABHUB_API_URL')}/api/v1/webhooks/resultados`;

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
      console.error('[analises-clinicas/deliver-resultado] LAB-HUB respondeu', resp.status);
      res.status(502).json({
        success: false,
        error: `LAB-HUB recusou o webhook (${resp.status})`,
        detail,
      });
      return;
    }

    await supabase
      .from('ac_resultados')
      .update({ entregue_ao_labhub: true })
      .eq('id', resultado.id);

    res.status(200).json({ success: true, agendamentoLabhubId });
  } catch (err) {
    console.error('[analises-clinicas/deliver-resultado] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
