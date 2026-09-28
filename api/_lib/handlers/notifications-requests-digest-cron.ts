/**
 * API Route: GET /api/notifications/requests-digest-cron
 *
 * Vercel Cron (diário) — resumo das solicitações (SC/SM) para a Louise: novas
 * nas últimas 24h e contagem das pendentes de dias anteriores. Sem nada novo
 * nem pendente, nada é enviado, em nenhum canal. A montagem do resumo fica em
 * api/_lib/requestsDailyDigest.ts (funções puras).
 *
 * Canais: tenta primeiro o WhatsApp (template `resumo_solicitacoes_diario` pela
 * Cloud API da Meta — api/_lib/requestsDigestWhatsApp.ts). Se o WhatsApp falhar
 * por qualquer motivo (env ausente, token inválido, template não aprovado...),
 * o erro vai para o log e o resumo segue por e-mail com um aviso no topo.
 * WhatsApp enviado → o e-mail não é enviado.
 *
 * Agendamento: vercel.json → crons → "0 20 * * *" (20:00 UTC = 17:00 America/Sao_Paulo).
 * Segurança: exige `Authorization: Bearer <CRON_SECRET>` (o Vercel Cron injeta esse
 * header automaticamente quando a env CRON_SECRET existe), no padrão de
 * api/_lib/handlers/umami-inatividade-cron.ts.
 *
 * Variáveis de ambiente:
 *   CRON_SECRET                 → segredo do cron (obrigatória)
 *   WHATSAPP_PHONE_NUMBER_ID    → id do número remetente na Cloud API
 *   WHATSAPP_ACCESS_TOKEN       → token de System User com whatsapp_business_messaging
 *   REQUESTS_DIGEST_WHATSAPP_TO → destinatário do WhatsApp (só dígitos, com DDI)
 *   REQUESTS_DIGEST_EMAIL       → e-mail de destino do fallback
 *   APP_URL                     → opcional, base do link (ver api/_lib/appUrl.ts)
 *   SMTP_*, SUPABASE_*          → já usadas por api/_lib/email.ts
 *
 * Teste sem enviar nada: GET /api/notifications/requests-digest-cron?dryRun=true
 *   (com o header Authorization: Bearer <CRON_SECRET>) devolve o resumo em JSON.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendTemplatedEmail } from '../email.js';
import { getSupabaseAdminClient } from '../supabase.js';
import { describeError } from '../errors.js';
import { APP_BASE_URL } from '../appUrl.js';
import { buildRequestsUrl } from '../requestsRoutes.js';
import {
  buildRequestsDailyDigest,
  buildRequestsDigestEmailVariables,
  digestWindowStart,
  formatDigestDate,
  type RequestsDigestCounts,
  type RequestsDigestRow,
} from '../requestsDailyDigest.js';
import { sendRequestsDigestWhatsApp } from '../requestsDigestWhatsApp.js';

const LOG = '[notifications/requests-digest-cron]';
const describeCounts = ({ newCount, olderPendingCount }: RequestsDigestCounts): string =>
  `${newCount} nova(s), ${olderPendingCount} pendente(s) antiga(s).`;
const TEMPLATE_SLUG = 'purchase_requests_daily_digest';
const ACTION_URL = buildRequestsUrl(APP_BASE_URL, 'pending');
const WHATSAPP_FAILED_NOTICE =
  'Este resumo foi enviado por e-mail porque o envio pelo WhatsApp falhou hoje.';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  // ── Autorização (Bearer CRON_SECRET) ──────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ ok: false, error: 'Não autorizado.' });
    return;
  }

  const dryRun = String(req.query.dryRun ?? '') === 'true';

  try {
    const now = new Date();
    const windowStart = digestWindowStart(now).toISOString();

    // Candidatas: tudo o que foi criado na janela + tudo o que segue pendente.
    // A separação exata (novas × pendentes antigas) fica na função pura.
    const { data, error } = await getSupabaseAdminClient()
      .from('requests')
      .select('type, status, priority, requested_by, department, items, created_at')
      .or(`created_at.gte."${windowStart}",status.eq.pending`);
    if (error) throw error;

    const digest = buildRequestsDailyDigest((data ?? []) as RequestsDigestRow[], now);

    // ── Resumo vazio: não envia nada, em nenhum canal ────────────────────────
    if (digest.isEmpty) {
      console.log(`${LOG} Nada novo nem pendente. Nenhum resumo enviado.`);
      res.status(200).json({
        ok: true,
        whatsappSent: false,
        emailSent: false,
        reason: 'Nenhuma solicitação nova nas últimas 24h e nenhuma pendente antiga.',
        counts: digest.counts,
      });
      return;
    }

    const to = process.env.REQUESTS_DIGEST_EMAIL?.trim();

    // ── Dry-run: não envia, apenas devolve o cálculo ─────────────────────────
    if (dryRun) {
      res.status(200).json({
        ok: true,
        dryRun: true,
        whatsappSent: false,
        emailSent: false,
        whatsappRecipient: process.env.REQUESTS_DIGEST_WHATSAPP_TO?.trim() || null,
        recipient: to ?? null,
        counts: digest.counts,
        variables: buildRequestsDigestEmailVariables(digest, now, ACTION_URL),
      });
      return;
    }

    // ── Canal principal: WhatsApp ────────────────────────────────────────────
    const whatsapp = await sendRequestsDigestWhatsApp(
      { counts: digest.counts, date: formatDigestDate(now) },
      { env: process.env, fetch },
    );
    if (whatsapp.success) {
      console.log(
        `${LOG} Resumo enviado por WhatsApp (${whatsapp.messageId}) — ` + describeCounts(digest.counts),
      );
      res.status(200).json({ ok: true, whatsappSent: true, emailSent: false, counts: digest.counts, messageId: whatsapp.messageId });
      return;
    }
    console.error(`${LOG} Falha no WhatsApp, caindo para o e-mail:`, whatsapp.error);

    // ── Fallback: e-mail com o aviso de falha ────────────────────────────────
    if (!to) {
      console.error(`${LOG} REQUESTS_DIGEST_EMAIL não configurada — resumo não enviado em nenhum canal`);
      res.status(500).json({
        ok: false,
        error: 'WhatsApp falhou e o destinatário do e-mail (REQUESTS_DIGEST_EMAIL) não está configurado.',
        whatsappError: whatsapp.error,
      });
      return;
    }

    const variables = buildRequestsDigestEmailVariables(digest, now, ACTION_URL, WHATSAPP_FAILED_NOTICE);
    const result = await sendTemplatedEmail({ to, templateSlug: TEMPLATE_SLUG, variables });
    if (!result.success) {
      console.error(`${LOG} Falha ao enviar e-mail:`, result.errorCode, result.error);
      res.status(500).json({
        ok: false,
        error: result.error ?? 'Falha ao enviar e-mail',
        errorCode: result.errorCode,
        whatsappError: whatsapp.error,
        counts: digest.counts,
      });
      return;
    }

    console.log(
      `${LOG} Resumo enviado por e-mail (fallback) para ${to} — ` + describeCounts(digest.counts),
    );
    res.status(200).json({
      ok: true,
      whatsappSent: false,
      emailSent: true,
      whatsappError: whatsapp.error,
      counts: digest.counts,
      messageId: result.messageId,
    });
  } catch (err) {
    console.error(`${LOG} erro:`, describeError(err));
    res.status(500).json({ ok: false, error: 'Erro interno.' });
  }
}
