// api/umami.ts
// Vercel Serverless Function (Node.js runtime) — arquivo único, sem imports locais.
// Recebe requisições do SPA e as repassa para a instância self-hosted do Umami.
//
// Variáveis de ambiente necessárias no painel Vercel (Production + Preview):
//   UMAMI_BASE_URL   → ex: https://umamilab.ngrok.dev/api
//   UMAMI_USER       → ex: admin
//   UMAMI_PASS       → ex: sua-senha
//   UMAMI_TIMEZONE   → ex: America/Sao_Paulo

// ─── Umami client (inlined from api/_lib/umami.ts para evitar problemas de ESM) ──

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
    const data = await this.request<UmamiEvent[] | { data: UmamiEvent[] }>(`/websites/${websiteId}/events?${this.buildQuery(params)}`);
    return Array.isArray(data) ? data : (data?.data ?? []);
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
