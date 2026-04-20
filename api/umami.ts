// api/umami.ts
// Vercel Serverless Function (Node.js runtime)
// Recebe requisições do SPA e as repassa para a instância self-hosted do Umami.
//
// Variáveis de ambiente necessárias no painel Vercel (Production + Preview):
//   UMAMI_BASE_URL   → ex: https://umamilab.ngrok.dev/api
//   UMAMI_USER       → ex: admin
//   UMAMI_PASS       → ex: sua-senha
//   UMAMI_TIMEZONE   → ex: America/Sao_Paulo

// dotenv NÃO é necessário aqui — Vercel injeta as env vars automaticamente.
// Em ambiente local, o vite.config.ts resolve /api/umami via middleware próprio.
import { createUmamiClient, buildTimeRangeParams } from './_lib/umami';
import type { UmamiTimeRange, UmamiTimeUnit } from './_lib/umami';

// Tipos mínimos do Vercel para o handler (evita depender de @vercel/node)
interface VercelRequest {
  query: Record<string, string | string[]>;
}
interface VercelResponse {
  status(code: number): VercelResponse;
  json(body: unknown): void;
  setHeader(key: string, value: string): VercelResponse;
}

function param(query: VercelRequest['query'], key: string): string | null {
  const v = query[key];
  if (!v) return null;
  return Array.isArray(v) ? v[0] : v;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { query } = req;

  const websiteId  = param(query, 'id');
  const startAtRaw = param(query, 'startAt');
  const endAtRaw   = param(query, 'endAt');
  const unitRaw    = param(query, 'unit') as UmamiTimeUnit | null;
  const rangeRaw   = param(query, 'range');
  const all        = param(query, 'all') === 'true';

  const range: UmamiTimeRange =
    startAtRaw && endAtRaw
      ? { startAt: Number(startAtRaw), endAt: Number(endAtRaw), unit: unitRaw ?? 'day' }
      : ((rangeRaw ?? '24h') as UmamiTimeRange);

  const client = createUmamiClient({
    baseUrl:  process.env.UMAMI_BASE_URL  ?? 'https://umamilab.ngrok.dev/api',
    username: process.env.UMAMI_USER      ?? 'admin',
    password: process.env.UMAMI_PASS      ?? 'umamiLab00421',
    timezone: process.env.UMAMI_TIMEZONE  ?? 'America/Sao_Paulo',
  });

  try {
    await client.authenticate();

    const websites = await client.getWebsites();
    const params   = buildTimeRangeParams(range);

    if (all) {
      if (!websites.length) {
        return res.status(200).json({ websites: [], results: [], error: 'Nenhum site encontrado' });
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

      return res.status(200).json({ websites, results });
    }

    // Single-site mode
    const targetId = websiteId ?? (websites[0]?.id ?? null);

    if (!targetId) {
      return res.status(200).json({ websites, error: 'Nenhum site encontrado' });
    }

    const [stats, events, pageviews] = await Promise.all([
      client.getStats(targetId, params),
      client.getEvents(targetId, params),
      client.getPageviews(targetId, params),
    ]);

    return res.status(200).json({ websites, currentId: targetId, stats, events, pageviews });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack   = err instanceof Error ? err.stack : undefined;
    console.error('[api/umami]', message, stack);
    return res.status(500).json({ error: message, detail: stack });
  }
}
