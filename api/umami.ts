// api/umami.ts
// Vercel Serverless Function (Node.js runtime).
// Recebe requisições do SPA e as repassa para a instância self-hosted do Umami.
//
// Autorização: header `Authorization: Bearer <access_token>` da SESSÃO do usuário,
// que precisa de `canManageIT` — a mesma permissão da rota /it/dashboard no SPA.
// Ver api/_lib/umamiAuth.ts.
//
// Variáveis de ambiente OBRIGATÓRIAS (Production + Preview no painel Vercel,
// e .env no ambiente local) — sem fallback em código:
//   UMAMI_BASE_URL   → ex: https://umamilab.ngrok.dev/api
//   UMAMI_USER       → usuário de leitura no Umami
//   UMAMI_PASS       → senha desse usuário
//   UMAMI_TIMEZONE   → opcional, default America/Sao_Paulo
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY → usadas para validar a sessão

import { authorizeUmamiRequest } from './_lib/umamiAuth.js';

// ─── Umami client (cópia de api/_lib/umami.ts; manter os dois em sincronia) ────

interface UmamiConfig {
  baseUrl: string;
  username: string;
  password: string;
  timezone?: string;
}

interface UmamiWebsite {
  id: string;
  name: string;
  domain?: string;
}

interface UmamiStats {
  pageviews: number | { value: number };
  visitors: number | { value: number };
  visits?: number | { value: number };
  bounces?: number | { value: number };
  totaltime?: number | { value: number };
}

interface UmamiEvent {
  createdAt: string;
  urlPath: string;
  eventName?: string;
}

interface UmamiPageviewPoint { x: string; y: number }
interface UmamiPageviews {
  pageviews: UmamiPageviewPoint[];
  sessions: UmamiPageviewPoint[];
}

type UmamiTimeUnit = 'hour' | 'day' | 'month';

interface UmamiQueryParams {
  startAt: number;
  endAt: number;
  unit: UmamiTimeUnit;
  timezone?: string;
}

type UmamiTimeRange =
  | '24h'
  | '7d'
  | '30d'
  | { startAt: number; endAt: number; unit: UmamiTimeUnit };

class UmamiClient {
  private readonly config: Required<UmamiConfig>;
  private token: string | null = null;

  constructor(config: UmamiConfig) {
    this.config = { timezone: 'UTC', ...config };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': '1',
      ...(init.headers as Record<string, string>),
    };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const res = await fetch(`${this.config.baseUrl}${path}`, { ...init, headers, cache: 'no-store' });
    if (!res.ok) throw new Error(`Umami API [${path}] → ${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
  }

  async authenticate(): Promise<void> {
    const { token } = await this.request<{ token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: this.config.username, password: this.config.password }),
    });
    this.token = token;
  }

  async getWebsites(): Promise<UmamiWebsite[]> {
    const data = await this.request<UmamiWebsite[] | { data: UmamiWebsite[] }>('/websites');
    return Array.isArray(data) ? data : (data?.data ?? []);
  }

  async getStats(websiteId: string, params: UmamiQueryParams): Promise<UmamiStats> {
    return this.request<UmamiStats>(`/websites/${websiteId}/stats?${this.buildQuery(params)}`);
  }

  async getPageviews(websiteId: string, params: UmamiQueryParams): Promise<UmamiPageviews> {
    return this.request<UmamiPageviews>(`/websites/${websiteId}/pageviews?${this.buildQuery(params)}`);
  }

  async getEvents(websiteId: string, params: UmamiQueryParams): Promise<UmamiEvent[]> {
    const pageSize = 500;
    const all: UmamiEvent[] = [];
    let page = 1;
    while (true) {
      const query = `${this.buildQuery(params)}&page=${page}&pageSize=${pageSize}`;
      const data = await this.request<UmamiEvent[] | { data: UmamiEvent[] }>(`/websites/${websiteId}/events?${query}`);
      const batch = Array.isArray(data) ? data : (data?.data ?? []);
      all.push(...batch);
      if (batch.length < pageSize) break;
      page++;
    }
    return all;
  }

  private buildQuery(params: UmamiQueryParams): string {
    const { timezone = this.config.timezone, ...rest } = params;
    return new URLSearchParams({
      ...Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, String(v)])),
      timezone,
    }).toString();
  }
}

function createUmamiClient(config: UmamiConfig): UmamiClient {
  return new UmamiClient(config);
}

function buildTimeRangeParams(range: UmamiTimeRange): Omit<UmamiQueryParams, 'timezone'> {
  if (typeof range === 'object') return range;
  const endAt = Date.now();
  switch (range) {
    case '24h': return { startAt: endAt - 24 * 60 * 60 * 1000, endAt, unit: 'hour' };
    case '30d': return { startAt: endAt - 30 * 24 * 60 * 60 * 1000, endAt, unit: 'day' };
    case '7d':
    default:    return { startAt: endAt - 7 * 24 * 60 * 60 * 1000, endAt, unit: 'day' };
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

// Tipos mínimos do Vercel para o handler (evita depender de @vercel/node)
interface VercelRequest {
  query: Record<string, string | string[]>;
  headers: Record<string, string | string[] | undefined>;
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
  // Sem `Access-Control-Allow-Origin`: o SPA chama esta rota na mesma origem.
  // Liberar `*` deixava qualquer site ler as métricas de todas as aplicações.
  res.setHeader('Cache-Control', 'no-store');

  const auth = await authorizeUmamiRequest(req.headers?.authorization);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
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
    console.error('[api/umami] UMAMI_BASE_URL, UMAMI_USER e UMAMI_PASS são obrigatórias');
    return res.status(500).json({ error: 'Integração com o Umami não configurada.' });
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
