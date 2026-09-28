// api/_lib/requestsDigestWhatsApp.ts
// Canal WhatsApp do resumo diário de solicitações (issue 04): envia o template
// aprovado `resumo_solicitacoes_diario` pela Cloud API da Meta. O handler
// (api/_lib/handlers/notifications-requests-digest-cron.ts) tenta este canal
// primeiro e cai para o e-mail em qualquer falha — por isso esta função nunca
// lança: toda falha vira `{ success: false, error }`, já pronta para o log.
//
// O botão "Ver pendentes" do template tem URL fixa, então não recebe parâmetro.
//
// Fica fora do módulo `messaging/` (WAHA, frontend): aqui é envio server-side,
// de um número próprio, pela API oficial — só saída, sem tratar respostas.

import { describeError } from './errors.js';
import type { RequestsDigestCounts } from './requestsDailyDigest.js';

const GRAPH_API_BASE = 'https://graph.facebook.com/v25.0';
const TEMPLATE_NAME = 'resumo_solicitacoes_diario';
const TEMPLATE_LANGUAGE = 'pt_BR';

const REQUIRED_ENV = ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'REQUESTS_DIGEST_WHATSAPP_TO'] as const;

/**
 * `process.env`, lido só nas chaves de REQUIRED_ENV. REQUESTS_DIGEST_WHATSAPP_TO
 * é o destinatário: só dígitos, com DDI (ex.: 5511999998888).
 */
export type WhatsAppEnv = Record<string, string | undefined>;

/** Mesmo formato de SendTemplatedEmailResult (email.ts). */
export interface WhatsAppSendResult {
  success: boolean;
  /** Id da mensagem na Cloud API (wamid...), quando enviada. */
  messageId?: string;
  /** Motivo da falha, pronto para o log. */
  error?: string;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Parâmetros do corpo na ordem do template: data, novas, SC, SM, urgentes, pendentes antigas. */
const bodyParameters = (counts: RequestsDigestCounts, date: string) =>
  [date, counts.newCount, counts.scCount, counts.smCount, counts.urgentCount, counts.olderPendingCount]
    .map((value) => ({ type: 'text', text: String(value) }));

/** "HTTP 401 — code=190 Invalid OAuth access token." a partir da resposta de erro da Graph API. */
async function describeGraphError(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  let detail = text.slice(0, 500);
  try {
    const error = JSON.parse(text)?.error;
    if (error?.message) {
      const subcode = error.error_subcode ? `/${error.error_subcode}` : '';
      detail = `code=${error.code}${subcode} ${error.message}`;
    }
  } catch {
    // corpo não-JSON (ex.: 502 do proxy) — fica o texto cru
  }
  return `HTTP ${response.status} — ${detail}`.trim();
}

export async function sendRequestsDigestWhatsApp(
  digest: { counts: RequestsDigestCounts; date: string },
  deps: { env: WhatsAppEnv; fetch: FetchLike },
): Promise<WhatsAppSendResult> {
  const missing = REQUIRED_ENV.filter((key) => !deps.env[key]?.trim());
  if (missing.length > 0) {
    return { success: false, error: `Env ausente: ${missing.join(', ')}` };
  }

  const phoneNumberId = deps.env.WHATSAPP_PHONE_NUMBER_ID!.trim();
  const token = deps.env.WHATSAPP_ACCESS_TOKEN!.trim();
  const to = deps.env.REQUESTS_DIGEST_WHATSAPP_TO!.trim();

  try {
    const response = await deps.fetch(`${GRAPH_API_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: TEMPLATE_NAME,
          language: { code: TEMPLATE_LANGUAGE },
          components: [{ type: 'body', parameters: bodyParameters(digest.counts, digest.date) }],
        },
      }),
    });

    if (!response.ok) {
      return { success: false, error: await describeGraphError(response) };
    }

    const data: { messages?: { id?: string }[] } | null = await response.json().catch(() => null);
    return { success: true, messageId: data?.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: `Falha de rede: ${describeError(err)}` };
  }
}
