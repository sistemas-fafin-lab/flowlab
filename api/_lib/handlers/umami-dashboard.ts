/**
 * API Route: GET /api/umami/dashboard
 *
 * Repassa ao SPA os dados do dashboard de uso (stats/eventos/pageviews) lidos da
 * instância self-hosted do Umami. Consumido por src/hooks/useUmamiAnalytics.ts.
 *
 * Autorização: header `Authorization: Bearer <access_token>` da SESSÃO do usuário,
 * que precisa de `canManageIT` — a mesma permissão da rota /it/dashboard no SPA.
 * Ver api/_lib/umamiAuth.ts.
 *
 * Variáveis de ambiente OBRIGATÓRIAS (Production + Preview no painel Vercel,
 * e .env no ambiente local) — sem fallback em código:
 *   UMAMI_BASE_URL   → ex: https://umamilab.ngrok.dev/api
 *   UMAMI_USER       → usuário de leitura no Umami
 *   UMAMI_PASS       → senha desse usuário
 *   UMAMI_TIMEZONE   → opcional, default America/Sao_Paulo
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY → usadas para validar a sessão
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createUmamiClient, buildTimeRangeParams, type UmamiTimeRange, type UmamiTimeUnit } from '../umami.js';
import { authorizeUmamiRequest } from '../umamiAuth.js';

function param(query: VercelRequest['query'], key: string): string | null {
  const v = query[key];
  if (!v) return null;
  return Array.isArray(v) ? v[0] : v;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Sem `Access-Control-Allow-Origin`: o SPA chama esta rota na mesma origem.
  // Liberar `*` deixava qualquer site ler as métricas de todas as aplicações.
  res.setHeader('Cache-Control', 'no-store');

  const auth = await authorizeUmamiRequest(req.headers?.authorization);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const { query } = req;

  const websiteId  = param(query, 'id');
  const startAtRaw = param(query, 'startAt');
  const endAtRaw   = param(query, 'endAt');
  const unitRaw    = param(query, 'unit') as UmamiTimeUnit | null;
  const rangeRaw   = param(query, 'range');
  const timezone   = param(query, 'timezone');
  const all        = param(query, 'all') === 'true';

  const range: UmamiTimeRange =
    startAtRaw && endAtRaw
      ? { startAt: Number(startAtRaw), endAt: Number(endAtRaw), unit: unitRaw ?? 'day' }
      : ((rangeRaw ?? '24h') as UmamiTimeRange);

  // Sem fallback: credencial em código vaza no repositório e some do controle de
  // rotação. Faltando a variável, o endpoint falha em vez de tentar um palpite.
  const { UMAMI_BASE_URL, UMAMI_USER, UMAMI_PASS } = process.env;
  if (!UMAMI_BASE_URL || !UMAMI_USER || !UMAMI_PASS) {
    console.error('[umami/dashboard] UMAMI_BASE_URL, UMAMI_USER e UMAMI_PASS são obrigatórias');
    res.status(500).json({ error: 'Integração com o Umami não configurada.' });
    return;
  }

  const client = createUmamiClient({
    baseUrl:  UMAMI_BASE_URL,
    username: UMAMI_USER,
    password: UMAMI_PASS,
    timezone: process.env.UMAMI_TIMEZONE ?? 'America/Sao_Paulo',
  });

  try {
    await client.authenticate();

    const websites = await client.getWebsites();
    // O timezone define onde o Umami corta cada bucket. O cliente manda o do
    // navegador para casar com os rótulos do gráfico; sem ele, cai no env.
    const params   = { ...buildTimeRangeParams(range), ...(timezone ? { timezone } : {}) };

    if (all) {
      if (!websites.length) {
        res.status(200).json({ websites: [], results: [], error: 'Nenhum site encontrado' });
        return;
      }

      const results = await Promise.all(
        websites.map(async (site) => {
          const [stats, events, pageviews] = await Promise.all([
            client.getStats(site.id, params),
            client.getEvents(site.id, params),
            client.getPageviews(site.id, params),
          ]);
          return { id: site.id, stats, events, pageviews };
        }),
      );

      res.status(200).json({ websites, results });
      return;
    }

    // Single-site mode
    const targetId = websiteId ?? (websites[0]?.id ?? null);

    if (!targetId) {
      res.status(200).json({ websites, error: 'Nenhum site encontrado' });
      return;
    }

    const [stats, events, pageviews] = await Promise.all([
      client.getStats(targetId, params),
      client.getEvents(targetId, params),
      client.getPageviews(targetId, params),
    ]);

    res.status(200).json({ websites, currentId: targetId, stats, events, pageviews });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack   = err instanceof Error ? err.stack : undefined;
    console.error('[umami/dashboard]', message, stack);
    res.status(500).json({ error: message, detail: stack });
  }
}
