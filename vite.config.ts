import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createUmamiClient, buildTimeRangeParams } from './api/_lib/umami';
import type { UmamiTimeRange, UmamiTimeUnit } from './api/_lib/umami';
import nodemailer from 'nodemailer';
// ── Dev-only middleware para POST /api/notifications/email ───────────────────
function emailApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'email-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (req.url !== '/api/notifications/email' || req.method !== 'POST') return next();

        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };

        // Lê body JSON
        let body: Record<string, string> = {};
        try {
          await new Promise<void>((resolve, reject) => {
            let raw = '';
            req.on('data', (chunk) => { raw += chunk; });
            req.on('end', () => {
              try { body = JSON.parse(raw); resolve(); }
              catch { reject(new Error('JSON inválido')); }
            });
            req.on('error', reject);
          });
        } catch {
          return send(400, { success: false, error: 'Body inválido' });
        }

        const { to, subject, html } = body;

        if (!to || !subject || !html) {
          return send(400, { success: false, error: 'Campos obrigatórios: to, subject, html' });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
          return send(400, { success: false, error: 'Endereço de email inválido' });
        }

        const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = env;

        if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
          console.error('[dev/email] Variáveis SMTP não configuradas no .env');
          return send(500, { success: false, error: 'Configuração SMTP ausente' });
        }

        try {
          const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: Number(SMTP_PORT),
            secure: Number(SMTP_PORT) === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
          });

          const info = await transporter.sendMail({
            from: SMTP_FROM,
            to,
            subject,
            html,
          });

          console.log('[dev/email] Enviado:', info.messageId);
          send(200, { success: true, messageId: info.messageId });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Erro desconhecido';
          console.error('[dev/email] Falha:', message);
          send(500, { success: false, error: message });
        }
      });
    },
  };
}
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
    plugins: [react(), emailApiPlugin(env), umamiApiPlugin(env)],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
