import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createUmamiClient, buildTimeRangeParams } from './api/_lib/umami';
import type { UmamiTimeRange, UmamiTimeUnit } from './api/_lib/umami';

// ── Dev-only middleware that emula /api/umami sem precisar do vercel dev ──────
function umamiApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'umami-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url?.startsWith('/api/umami')) return next();

        const url = new URL(req.url, 'http://localhost');
        const param = (key: string): string | null => url.searchParams.get(key);

        const websiteId  = param('id');
        const startAtRaw = param('startAt');
        const endAtRaw   = param('endAt');
        const unitRaw    = param('unit') as UmamiTimeUnit | null;
        const rangeRaw   = param('range');
        const all        = param('all') === 'true';

        const range: UmamiTimeRange =
          startAtRaw && endAtRaw
            ? { startAt: Number(startAtRaw), endAt: Number(endAtRaw), unit: unitRaw ?? 'day' }
            : ((rangeRaw ?? '24h') as UmamiTimeRange);

        const client = createUmamiClient({
          baseUrl:  env.UMAMI_BASE_URL  ?? 'https://umamilab.ngrok.dev/api',
          username: env.UMAMI_USER      ?? 'admin',
          password: env.UMAMI_PASS      ?? 'umami',
          timezone: env.UMAMI_TIMEZONE  ?? 'America/Sao_Paulo',
        });

        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(body));
        };

        try {
          await client.authenticate();
          const websites = await client.getWebsites();
          const params   = buildTimeRangeParams(range);

          if (all) {
            if (!websites.length) {
              return send(200, { websites: [], results: [], error: 'Nenhum site encontrado' });
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
            return send(200, { websites, results });
          }

          const targetId = websiteId ?? (websites[0]?.id ?? null);
          if (!targetId) return send(200, { websites, error: 'Nenhum site encontrado' });

          const [stats, events, pageviews] = await Promise.all([
            client.getStats(targetId, params),
            client.getEvents(targetId, params),
            client.getPageviews(targetId, params),
          ]);
          return send(200, { websites, currentId: targetId, stats, events, pageviews });
        } catch (err) {
          console.error('[dev/api/umami]', err);
          send(500, { error: err instanceof Error ? err.message : 'Erro ao buscar dados do Umami' });
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // loadEnv com prefix '' carrega TODAS as vars (inclusive UMAMI_* sem prefixo VITE_)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), umamiApiPlugin(env)],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
