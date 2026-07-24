// api/cron/umami-inatividade.ts
// Vercel Cron (semanal) — alerta por email de projetos sem uso há 7 dias.
//
// Regra de "sem uso", inferida automaticamente pelos dados do Umami:
//   • web  (tem histórico de pageviews) → inativo se ficar 7 dias sem acessos/pageviews.
//   • app  (só gera eventos)            → inativo se ficar 7 dias sem eventos.
// A classificação usa uma janela longa (90 dias): pageviews > 0 ⇒ web, senão ⇒ app.
//
// Agendamento: vercel.json → crons → "0 11 * * 1" (seg 11:00 UTC = 08:00 America/Sao_Paulo).
// Segurança: exige `Authorization: Bearer <CRON_SECRET>` (o Vercel Cron injeta esse header
// automaticamente quando a env CRON_SECRET existe). Sem isso a rota seria um proxy anônimo
// das métricas de todos os sites — mesma preocupação de api/_lib/umamiAuth.ts.
//
// Variáveis de ambiente:
//   CRON_SECRET          → segredo do cron (obrigatória)
//   INACTIVITY_ALERT_TO  → email de destino do resumo (obrigatória para envio real)
//   UMAMI_BASE_URL, UMAMI_USER, UMAMI_PASS, UMAMI_TIMEZONE → já usadas por api/umami.ts
//   SMTP_* e SUPABASE_*  → já usadas por api/_lib/email.ts
//
// Teste sem enviar email: GET /api/cron/umami-inatividade?dryRun=true
//   (com o header Authorization: Bearer <CRON_SECRET>) devolve o cálculo em JSON.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createUmamiClient,
  buildTimeRangeParams,
  type UmamiWebsite,
} from '../_lib/umami.js';
import { sendTemplatedEmail } from '../_lib/email.js';

const INACTIVITY_DAYS = 7;
const CLASSIFY_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const TEMPLATE_SLUG = 'umami_inatividade_semanal';

type ProjectType = 'web' | 'app';

interface Evaluation {
  id: string;
  name: string;
  domain?: string;
  type: ProjectType;
  /** Pageviews nos últimos 7 dias (web). */
  pageviews7d: number;
  /** Nº de eventos nos últimos 7 dias (app). -1 quando não consultado. */
  events7d: number;
  inactive: boolean;
  /** Ignorado por ser recém-criado (< 7 dias). */
  skipped?: boolean;
  error?: string;
}

/** Lê um stat do Umami seja ele `number` ou `{ value }` (api/_lib/umami.ts não exporta helper). */
function statValue(stat: number | { value: number } | undefined): number {
  if (stat === undefined || stat === null) return 0;
  return typeof stat === 'object' ? stat.value : stat;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}

async function evaluateSite(
  client: ReturnType<typeof createUmamiClient>,
  site: UmamiWebsite,
  now: number,
): Promise<Evaluation> {
  const base: Evaluation = {
    id: site.id,
    name: site.name,
    domain: site.domain,
    type: 'app',
    pageviews7d: 0,
    events7d: -1,
    inactive: false,
  };

  // Projetos recém-criados não têm histórico suficiente para julgar inatividade.
  const createdAt = site.createdAt ? new Date(site.createdAt).getTime() : 0;
  if (createdAt && now - createdAt < INACTIVITY_DAYS * DAY_MS) {
    return { ...base, skipped: true };
  }

  const params7d = buildTimeRangeParams('7d');
  const params90d = buildTimeRangeParams({
    startAt: now - CLASSIFY_DAYS * DAY_MS,
    endAt: now,
    unit: 'day',
  });

  try {
    const [stats7d, stats90d] = await Promise.all([
      client.getStats(site.id, params7d),
      client.getStats(site.id, params90d),
    ]);

    const pageviews90d = statValue(stats90d.pageviews);
    const pageviews7d = statValue(stats7d.pageviews);
    const type: ProjectType = pageviews90d > 0 ? 'web' : 'app';

    if (type === 'web') {
      return { ...base, type, pageviews7d, inactive: pageviews7d === 0 };
    }

    // app → conta eventos dos últimos 7 dias
    const events = await client.getEvents(site.id, params7d);
    return { ...base, type, pageviews7d, events7d: events.length, inactive: events.length === 0 };
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : String(err) };
  }
}

function buildListHtml(inactive: Evaluation[]): string {
  return inactive
    .map((p) => {
      const rotulo =
        p.type === 'web' ? 'Web — sem acessos há 7 dias' : 'App — sem eventos há 7 dias';
      const dominio = p.domain ? ` <span style="color:#9ca3af;">(${escapeHtml(p.domain)})</span>` : '';
      return `<li style="margin:0 0 8px 0;"><strong style="color:#1a1a2e;">${escapeHtml(
        p.name,
      )}</strong>${dominio}<br /><span style="font-size:13px;color:#6b7280;">${rotulo}</span></li>`;
    })
    .join('');
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  // ── Autorização (Bearer CRON_SECRET) ──────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }

  const dryRun = String(req.query.dryRun ?? '') === 'true';

  // ── Configuração do Umami (sem fallback: falha explícita se faltar) ────────
  const { UMAMI_BASE_URL, UMAMI_USER, UMAMI_PASS } = process.env;
  if (!UMAMI_BASE_URL || !UMAMI_USER || !UMAMI_PASS) {
    console.error('[cron/umami-inatividade] UMAMI_BASE_URL, UMAMI_USER e UMAMI_PASS são obrigatórias');
    res.status(500).json({ error: 'Integração com o Umami não configurada.' });
    return;
  }

  const to = process.env.INACTIVITY_ALERT_TO;
  if (!dryRun && !to) {
    console.error('[cron/umami-inatividade] INACTIVITY_ALERT_TO não configurada');
    res.status(500).json({ error: 'Destinatário do alerta (INACTIVITY_ALERT_TO) não configurado.' });
    return;
  }

  const client = createUmamiClient({
    baseUrl: UMAMI_BASE_URL,
    username: UMAMI_USER,
    password: UMAMI_PASS,
    timezone: process.env.UMAMI_TIMEZONE ?? 'America/Sao_Paulo',
  });

  try {
    await client.authenticate();
    const websites = await client.getWebsites();
    const now = Date.now();

    const evaluations = await Promise.all(
      websites.map((site) => evaluateSite(client, site, now)),
    );

    const inactive = evaluations.filter((e) => e.inactive && !e.error && !e.skipped);

    // ── Sem inativos: não envia email ────────────────────────────────────────
    if (inactive.length === 0) {
      console.log('[cron/umami-inatividade] Nenhum projeto inativo. Nenhum email enviado.');
      res.status(200).json({
        ok: true,
        totalSites: websites.length,
        inactiveCount: 0,
        emailSent: false,
        ...(dryRun ? { evaluations } : {}),
      });
      return;
    }

    const dataBR = new Date(now).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const variables: Record<string, string> = {
      total: String(inactive.length),
      periodo: String(INACTIVITY_DAYS),
      data: dataBR,
      lista: buildListHtml(inactive),
    };

    // ── Dry-run: não envia, apenas devolve o cálculo ─────────────────────────
    if (dryRun) {
      res.status(200).json({
        ok: true,
        dryRun: true,
        totalSites: websites.length,
        inactiveCount: inactive.length,
        emailSent: false,
        recipient: to ?? null,
        inactive: inactive.map(({ name, domain, type, pageviews7d, events7d }) => ({
          name,
          domain,
          type,
          pageviews7d,
          events7d,
        })),
        evaluations,
      });
      return;
    }

    // ── Envio real do resumo semanal ─────────────────────────────────────────
    const result = await sendTemplatedEmail({ to: to!, templateSlug: TEMPLATE_SLUG, variables });

    if (!result.success) {
      console.error('[cron/umami-inatividade] Falha ao enviar email:', result.errorCode, result.error);
      res.status(500).json({
        ok: false,
        error: result.error ?? 'Falha ao enviar email',
        errorCode: result.errorCode,
        inactiveCount: inactive.length,
      });
      return;
    }

    console.log(
      `[cron/umami-inatividade] Resumo enviado para ${to} — ${inactive.length} projeto(s) inativo(s).`,
    );
    res.status(200).json({
      ok: true,
      totalSites: websites.length,
      inactiveCount: inactive.length,
      emailSent: true,
      messageId: result.messageId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cron/umami-inatividade]', message);
    res.status(500).json({ ok: false, error: message });
  }
}
