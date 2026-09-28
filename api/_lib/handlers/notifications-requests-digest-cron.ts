/**
 * API Route: GET /api/notifications/requests-digest-cron
 *
 * Vercel Cron (diário) — resumo das solicitações (SC/SM) por e-mail para a
 * Louise: novas nas últimas 24h e contagem das pendentes de dias anteriores.
 * Sem nada novo nem pendente, nada é enviado. A montagem do resumo fica em
 * api/_lib/requestsDailyDigest.ts (funções puras).
 *
 * Agendamento: vercel.json → crons → "0 20 * * *" (20:00 UTC = 17:00 America/Sao_Paulo).
 * Segurança: exige `Authorization: Bearer <CRON_SECRET>` (o Vercel Cron injeta esse
 * header automaticamente quando a env CRON_SECRET existe), no padrão de
 * api/_lib/handlers/umami-inatividade-cron.ts.
 *
 * Variáveis de ambiente:
 *   CRON_SECRET           → segredo do cron (obrigatória)
 *   REQUESTS_DIGEST_EMAIL → e-mail de destino do resumo (obrigatória para envio real)
 *   APP_URL               → opcional, base do link (ver api/_lib/appUrl.ts)
 *   SMTP_*, SUPABASE_*    → já usadas por api/_lib/email.ts
 *
 * Teste sem enviar e-mail: GET /api/notifications/requests-digest-cron?dryRun=true
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
  type RequestsDigestRow,
} from '../requestsDailyDigest.js';

const TEMPLATE_SLUG = 'purchase_requests_daily_digest';
const ACTION_URL = buildRequestsUrl(APP_BASE_URL, 'pending');

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  // ── Autorização (Bearer CRON_SECRET) ──────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ ok: false, error: 'Não autorizado.' });
    return;
  }

  const dryRun = String(req.query.dryRun ?? '') === 'true';

  const to = process.env.REQUESTS_DIGEST_EMAIL?.trim();
  if (!dryRun && !to) {
    console.error('[notifications/requests-digest-cron] REQUESTS_DIGEST_EMAIL não configurada');
    res.status(500).json({ ok: false, error: 'Destinatário do resumo (REQUESTS_DIGEST_EMAIL) não configurado.' });
    return;
  }

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

    // ── Resumo vazio: não envia nada ─────────────────────────────────────────
    if (digest.isEmpty) {
      console.log('[notifications/requests-digest-cron] Nada novo nem pendente. Nenhum e-mail enviado.');
      res.status(200).json({
        ok: true,
        emailSent: false,
        reason: 'Nenhuma solicitação nova nas últimas 24h e nenhuma pendente antiga.',
        counts: digest.counts,
      });
      return;
    }

    const variables = buildRequestsDigestEmailVariables(digest, now, ACTION_URL);

    // ── Dry-run: não envia, apenas devolve o cálculo ─────────────────────────
    if (dryRun) {
      res.status(200).json({
        ok: true,
        dryRun: true,
        emailSent: false,
        recipient: to ?? null,
        counts: digest.counts,
        variables,
      });
      return;
    }

    // ── Envio real ───────────────────────────────────────────────────────────
    const result = await sendTemplatedEmail({ to: to!, templateSlug: TEMPLATE_SLUG, variables });
    if (!result.success) {
      console.error('[notifications/requests-digest-cron] Falha ao enviar e-mail:', result.errorCode, result.error);
      res.status(500).json({
        ok: false,
        error: result.error ?? 'Falha ao enviar e-mail',
        errorCode: result.errorCode,
        counts: digest.counts,
      });
      return;
    }

    console.log(
      `[notifications/requests-digest-cron] Resumo enviado para ${to} — `
      + `${digest.counts.newCount} nova(s), ${digest.counts.olderPendingCount} pendente(s) antiga(s).`,
    );
    res.status(200).json({ ok: true, emailSent: true, counts: digest.counts, messageId: result.messageId });
  } catch (err) {
    console.error('[notifications/requests-digest-cron] erro:', describeError(err));
    res.status(500).json({ ok: false, error: 'Erro interno.' });
  }
}
