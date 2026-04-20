// api/_lib/umami.ts
// Umami API client — Node.js compatible (sem dependências externas)

export interface UmamiConfig {
  baseUrl: string;
  username: string;
  password: string;
  timezone?: string;
}

export interface UmamiWebsite {
  id: string;
  name: string;
  domain?: string;
  createdAt?: string;
}

export interface UmamiStats {
  pageviews: number | { value: number };
  visitors: number | { value: number };
  visits?: number | { value: number };
  bounces?: number | { value: number };
  totaltime?: number | { value: number };
}

export interface UmamiEvent {
  createdAt: string;
  urlPath: string;
  urlQuery?: string;
  referrerDomain?: string;
  eventId?: string;
  eventType?: number;
  eventName?: string;
  visitId?: string;
}

export interface UmamiPageviewPoint {
  x: string;
  y: number;
}

export interface UmamiPageviews {
  pageviews: UmamiPageviewPoint[];
  sessions: UmamiPageviewPoint[];
}

export type UmamiTimeUnit = 'hour' | 'day' | 'month';

export interface UmamiQueryParams {
  startAt: number;
  endAt: number;
  unit: UmamiTimeUnit;
  timezone?: string;
}

export type UmamiTimeRange =
  | '24h'
  | '7d'
  | '30d'
  | { startAt: number; endAt: number; unit: UmamiTimeUnit };

export class UmamiClient {
  private readonly config: Required<UmamiConfig>;
  private token: string | null = null;

  constructor(config: UmamiConfig) {
    this.config = { timezone: 'UTC', ...config };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // Necessário para bypasear a página de aviso do ngrok em tunnels locais
      'ngrok-skip-browser-warning': '1',
      ...(init.headers as Record<string, string>),
    };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const res = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Umami API [${path}] → ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  async authenticate(): Promise<void> {
    const { token } = await this.request<{ token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: this.config.username,
        password: this.config.password,
      }),
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
    return this.request<UmamiPageviews>(
      `/websites/${websiteId}/pageviews?${this.buildQuery(params)}`,
    );
  }

  async getEvents(websiteId: string, params: UmamiQueryParams): Promise<UmamiEvent[]> {
    const data = await this.request<UmamiEvent[] | { data: UmamiEvent[] }>(
      `/websites/${websiteId}/events?${this.buildQuery(params)}`,
    );
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

export function createUmamiClient(config: UmamiConfig): UmamiClient {
  return new UmamiClient(config);
}

export function buildTimeRangeParams(range: UmamiTimeRange): Omit<UmamiQueryParams, 'timezone'> {
  if (typeof range === 'object') return range;
  const endAt = Date.now();
  switch (range) {
    case '24h':
      return { startAt: endAt - 24 * 60 * 60 * 1000, endAt, unit: 'hour' };
    case '30d':
      return { startAt: endAt - 30 * 24 * 60 * 60 * 1000, endAt, unit: 'day' };
    case '7d':
    default:
      return { startAt: endAt - 7 * 24 * 60 * 60 * 1000, endAt, unit: 'day' };
  }
}
