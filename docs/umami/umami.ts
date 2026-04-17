// ─────────────────────────────────────────────────────────────────────────────
// Umami Analytics API client
//
// Usage in any project:
//
//   import { createUmamiClient, buildTimeRangeParams } from '@/lib/umami';
//
//   const client = createUmamiClient({
//     baseUrl: 'http://localhost:3000/api',
//     username: 'admin',
//     password: 'umami',
//     timezone: 'America/Sao_Paulo',
//   });
//
//   await client.authenticate();
//   const websites = await client.getWebsites();
//   const stats    = await client.getStats(websiteId, buildTimeRangeParams('7d'));
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────────────────

export interface UmamiConfig {
  baseUrl: string;
  username: string;
  password: string;
  /** IANA timezone string, e.g. "America/Sao_Paulo". Defaults to "UTC". */
  timezone?: string;
}

export interface UmamiWebsite {
  id: string;
  name: string;
  domain?: string;
  createdAt?: string;
}

/**
 * Umami may return flat numbers (older self-hosted) or objects with `.value`
 * (newer cloud/self-hosted). Use `statValue()` to read either format safely.
 */
export interface UmamiStats {
  pageviews: number | { value: number };
  visitors: number | { value: number };
  visits?: number | { value: number };
  bounces?: number | { value: number };
  totaltime?: number | { value: number };
  comparison?: {
    pageviews: number;
    visitors: number;
    visits: number;
    bounces: number;
    totaltime: number;
  };
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
  hasData?: number;
}

export interface UmamiPageviewPoint {
  /** ISO timestamp string */
  x: string;
  /** Count */
  y: number;
}

export interface UmamiPageviews {
  pageviews: UmamiPageviewPoint[];
  sessions: UmamiPageviewPoint[];
}

export type UmamiTimeUnit = "hour" | "day" | "month";

export interface UmamiQueryParams {
  startAt: number;
  endAt: number;
  unit: UmamiTimeUnit;
  /** Overrides the client-level timezone for this request. */
  timezone?: string;
}

/** Range pré-definido ou customizado com timestamps em milissegundos. */
export type UmamiTimeRange =
  | "24h"
  | "7d"
  | "30d"
  | { startAt: number; endAt: number; unit: UmamiTimeUnit };

// ── Client ───────────────────────────────────────────────────────────────────

export class UmamiClient {
  private readonly config: Required<UmamiConfig>;
  private token: string | null = null;

  constructor(config: UmamiConfig) {
    this.config = { timezone: "UTC", ...config };
  }

  // ── Low-level fetch ────────────────────────────────────────────────────────

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string>),
    };

    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    const res = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Umami API [${path}] → ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<T>;
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

  /** Authenticates and stores the Bearer token for subsequent calls. */
  async authenticate(): Promise<void> {
    const { token } = await this.request<{ token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: this.config.username,
        password: this.config.password,
      }),
    });
    this.token = token;
  }

  // ── Websites ───────────────────────────────────────────────────────────────

  /** Returns all websites registered in this Umami instance. */
  async getWebsites(): Promise<UmamiWebsite[]> {
    const data = await this.request<UmamiWebsite[] | { data: UmamiWebsite[] }>(
      "/websites",
    );
    return Array.isArray(data) ? data : (data?.data ?? []);
  }

  // ── Analytics ──────────────────────────────────────────────────────────────

  /** Aggregated statistics (pageviews, visitors, visits, bounces, totaltime). */
  async getStats(
    websiteId: string,
    params: UmamiQueryParams,
  ): Promise<UmamiStats> {
    return this.request<UmamiStats>(
      `/websites/${websiteId}/stats?${this.buildQuery(params)}`,
    );
  }

  /** Time-series pageview and session counts. */
  async getPageviews(
    websiteId: string,
    params: UmamiQueryParams,
  ): Promise<UmamiPageviews> {
    return this.request<UmamiPageviews>(
      `/websites/${websiteId}/pageviews?${this.buildQuery(params)}`,
    );
  }

  /** List of events that occurred in the given period. */
  async getEvents(
    websiteId: string,
    params: UmamiQueryParams,
  ): Promise<UmamiEvent[]> {
    const data = await this.request<UmamiEvent[] | { data: UmamiEvent[] }>(
      `/websites/${websiteId}/events?${this.buildQuery(params)}`,
    );
    return Array.isArray(data) ? data : (data?.data ?? []);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private buildQuery(params: UmamiQueryParams): string {
    const { timezone = this.config.timezone, ...rest } = params;
    return new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(rest).map(([k, v]) => [k, String(v)]),
      ),
      timezone,
    }).toString();
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

/** Convenience factory — avoids `new UmamiClient(...)` at call sites. */
export function createUmamiClient(config: UmamiConfig): UmamiClient {
  return new UmamiClient(config);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Builds `startAt`, `endAt`, and `unit` from a human-readable time range.
 *
 * @example
 * const params = buildTimeRangeParams('7d');
 * // { startAt: <ms>, endAt: <ms>, unit: 'day' }
 *
 * or
 *
 * // Range pré-definido (comportamento anterior, sem quebra)
 * buildTimeRangeParams('7d');
 *
 * // Range customizado
 * buildTimeRangeParams({
 *   startAt: new Date('2026-01-01').getTime(),
 *   endAt:   new Date('2026-03-31').getTime(),
 *   unit:    'day',
 * });
 */
export function buildTimeRangeParams(
  range: UmamiTimeRange,
): Omit<UmamiQueryParams, "timezone"> {
  if (typeof range === "object") return range;

  const endAt = Date.now();

  switch (range) {
    case "24h":
      return { startAt: endAt - 24 * 60 * 60 * 1000, endAt, unit: "hour" };
    case "30d":
      return { startAt: endAt - 30 * 24 * 60 * 60 * 1000, endAt, unit: "day" };
    case "7d":
    default:
      return { startAt: endAt - 7 * 24 * 60 * 60 * 1000, endAt, unit: "day" };
  }
}

/**
 * Reads a stat value regardless of whether Umami returned a flat number
 * or an object `{ value: number }`.
 *
 * @example
 * statValue(stats.pageviews) // works for both response formats
 */
export function statValue(
  stat: number | { value: number } | undefined,
): number {
  if (stat === undefined || stat === null) return 0;
  if (typeof stat === "object") return stat.value;
  return stat;
}
