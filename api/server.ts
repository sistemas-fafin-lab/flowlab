/**
 * api/server.ts
 * Servidor standalone para Docker — serve o SPA (dist/) + rotas da API.
 * Compatível com handlers Vercel (Request/Response) sem precisar do runtime Vercel.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '../dist');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ── Helpers estáticos ──────────────────────────────────────────────────────────
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) return false;

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  res.statusCode = 200;
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', ext === '.html' ? 'no-cache' : 'public, max-age=31536000');
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// ── Wrapper Vercel-compatível ──────────────────────────────────────────────────
interface VercelLikeRequest {
  query: Record<string, string | string[]>;
  body?: unknown;
  headers: http.IncomingMessage['headers'];
  method?: string;
  url?: string;
}

interface VercelLikeResponse {
  status(code: number): VercelLikeResponse;
  json(body: unknown): void;
  setHeader(key: string, value: string): VercelLikeResponse;
}

function wrapRequest(req: http.IncomingMessage, parsedBody?: unknown): VercelLikeRequest {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const query: Record<string, string | string[]> = {};
  for (const [k, v] of url.searchParams) {
    const existing = query[k];
    if (existing) {
      query[k] = Array.isArray(existing) ? [...existing, v] : [existing, v];
    } else {
      query[k] = v;
    }
  }
  return { query, body: parsedBody, headers: req.headers, method: req.method, url: req.url };
}

function wrapResponse(res: http.ServerResponse): VercelLikeResponse {
  return {
    status(code: number) {
      res.statusCode = code;
      return this;
    },
    json(body: unknown) {
      sendJson(res, res.statusCode || 200, body);
    },
    setHeader(key: string, value: string) {
      res.setHeader(key, value);
      return this;
    },
  };
}

// ── Carregamento lazy dos handlers ───────────────────────────────────────────
// Importa sob demanda para não carregar tudo na memória de uma vez.
const HANDLERS = new Map<string, () => Promise<{ default: (req: VercelLikeRequest, res: VercelLikeResponse) => Promise<void> }>>();

HANDLERS.set('GET /api/umami',      () => import('./umami.js'));
HANDLERS.set('POST /api/notifications/email', () => import('./notifications/email.js'));
HANDLERS.set('POST /api/users/create', () => import('./users/create.js'));
HANDLERS.set('POST /api/analises-clinicas/deliver-coleta',     () => import('./analises-clinicas/deliver-coleta.js'));
HANDLERS.set('POST /api/analises-clinicas/deliver-resultado',  () => import('./analises-clinicas/deliver-resultado.js'));
HANDLERS.set('GET /api/analises-clinicas/get-disponibilidade', () => import('./analises-clinicas/get-disponibilidade.js'));
HANDLERS.set('POST /api/analises-clinicas/receive-agendamento', () => import('./analises-clinicas/receive-agendamento.js'));
HANDLERS.set('POST /api/analises-clinicas/receive-cancelamento', () => import('./analises-clinicas/receive-cancelamento.js'));

async function parseBody(req: http.IncomingMessage): Promise<unknown> {
  if (!req.headers['content-type']?.includes('application/json')) return undefined;
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : undefined); }
      catch { resolve(undefined); }
    });
    req.on('error', reject);
  });
}

// ── Servidor ─────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  try {
    const urlPath = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname;
    const method = req.method || 'GET';

    // CORS preflight
    if (method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.statusCode = 204;
      res.end();
      return;
    }

    // ── Rotas da API ─────────────────────────────────────────────────────────
    const routeKey = `${method} ${urlPath}`;
    const handlerLoader = HANDLERS.get(routeKey);

    if (handlerLoader) {
      const parsedBody = method !== 'GET' ? await parseBody(req) : undefined;
      const vReq = wrapRequest(req, parsedBody);
      const vRes = wrapResponse(res);
      const mod = await handlerLoader();
      await mod.default(vReq, vRes);
      return;
    }

    // ── Arquivos estáticos (SPA) ───────────────────────────────────────────
    // Tenta servir o arquivo direto; se não existir, fallback para index.html.
    const filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);
    if (serveStatic(req, res, filePath)) return;

    // Fallback SPA
    if (serveStatic(req, res, path.join(DIST_DIR, 'index.html'))) return;

    res.statusCode = 404;
    res.end('Not found');
  } catch (err) {
    console.error('[server] erro:', err);
    res.statusCode = 500;
    res.end('Internal server error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[server] FlowLAB rodando em http://${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM recebido, encerrando...');
  server.close(() => process.exit(0));
});
