import { useState, useCallback, useEffect, useRef } from 'react';

// ── Types (espelhando docs/umami/umami.ts) ───────────────────────────────────

export interface UmamiStats {
  pageviews: number | { value: number };
  visitors: number | { value: number };
  visits?: number | { value: number };
  bounces?: number | { value: number };
  totaltime?: number | { value: number };
}

export interface UmamiPageviewPoint {
  x: string;
  y: number;
}

export interface UmamiPageviews {
  pageviews: UmamiPageviewPoint[];
  sessions: UmamiPageviewPoint[];
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

export interface UmamiWebsite {
  id: string;
  name: string;
  domain?: string;
  createdAt?: string;
}

// ── Recharts-ready type ──────────────────────────────────────────────────────

export interface ChartDataPoint {
  date: string;
  pageviews: number;
  sessions: number;
}

// ── Aggregated stats across all websites ─────────────────────────────────────

export interface AggregatedStats {
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
}

// ── API response shape for all=true (matches route.ts) ───────────────────────

interface SiteResult {
  id: string;
  stats: UmamiStats;
  events: UmamiEvent[];
  pageviews: UmamiPageviews;
}

interface UmamiAllApiResponse {
  websites: UmamiWebsite[];
  results: SiteResult[];
  error?: string;
}

// ── Hook data & return ───────────────────────────────────────────────────────

export type UmamiRange = '24h' | '7d' | '30d';

export interface UmamiAnalyticsData {
  websites: UmamiWebsite[];
  aggregatedStats: AggregatedStats;
  chartData: ChartDataPoint[];
}

export interface UseUmamiAnalyticsReturn {
  data: UmamiAnalyticsData;
  loading: boolean;
  error: string | null;
  range: UmamiRange;
  setRange: (range: UmamiRange) => void;
  refresh: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Reads a stat value regardless of Umami response format (flat number or { value }). */
export function statValue(stat: number | { value: number } | undefined): number {
  if (stat === undefined || stat === null) return 0;
  if (typeof stat === 'object') return stat.value;
  return stat;
}

/**
 * Formats an ISO date string to a display label based on the range unit:
 * - 24h → HH:mm
 * - 7d / 30d → dd/MM
 */
function formatDateLabel(iso: string, range: UmamiRange): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;

  const pad = (n: number) => String(n).padStart(2, '0');

  if (range === '24h') {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/**
 * Aggregates stats from all site results into a single total.
 */
function aggregateStats(results: SiteResult[]): AggregatedStats {
  const agg: AggregatedStats = { pageviews: 0, visitors: 0, visits: 0, bounces: 0, totaltime: 0 };

  for (const r of results) {
    agg.pageviews += statValue(r.stats.pageviews);
    agg.visitors += statValue(r.stats.visitors);
    agg.visits += statValue(r.stats.visits);
    agg.bounces += statValue(r.stats.bounces);
    agg.totaltime += statValue(r.stats.totaltime);
  }

  return agg;
}

/**
 * Combines pageviews + sessions arrays from ALL sites, grouping by date label,
 * and returns a Recharts-ready dataset sorted chronologically.
 */
export function buildChartData(
  results: SiteResult[],
  range: UmamiRange,
): ChartDataPoint[] {
  const pvMap = new Map<string, number>();
  const sessMap = new Map<string, number>();

  for (const r of results) {
    if (!r.pageviews) continue;

    for (const p of r.pageviews.pageviews) {
      const label = formatDateLabel(p.x, range);
      pvMap.set(label, (pvMap.get(label) ?? 0) + p.y);
    }

    for (const s of r.pageviews.sessions) {
      const label = formatDateLabel(s.x, range);
      sessMap.set(label, (sessMap.get(label) ?? 0) + s.y);
    }
  }

  const allLabels = Array.from(new Set([...pvMap.keys(), ...sessMap.keys()]));

  // Sort labels chronologically (dd/MM or HH:mm both sort correctly as strings
  // when the original x values are ISO dates — we preserve insertion order which
  // already comes sorted from Umami, but an explicit sort guarantees it).
  allLabels.sort((a, b) => a.localeCompare(b));

  return allLabels.map((date) => ({
    date,
    pageviews: pvMap.get(date) ?? 0,
    sessions: sessMap.get(date) ?? 0,
  }));
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const API_URL = '/api/umami';

/** Umami client-side tracker — injected once into <head> */
const UMAMI_TRACKER = {
  src: 'https://umamilab.ngrok.dev/script.js',
  websiteId: '237b1a87-ebab-4ff1-affd-3a1b87068881',
  scriptId: 'umami-tracker',
} as const;

const EMPTY_STATS: AggregatedStats = { pageviews: 0, visitors: 0, visits: 0, bounces: 0, totaltime: 0 };

const EMPTY_DATA: UmamiAnalyticsData = {
  websites: [],
  aggregatedStats: EMPTY_STATS,
  chartData: [],
};

export function useUmamiAnalytics(
  initialRange: UmamiRange = '7d',
  apiUrl: string = API_URL,
): UseUmamiAnalyticsReturn {
  const [data, setData] = useState<UmamiAnalyticsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<UmamiRange>(initialRange);

  const abortRef = useRef<AbortController | null>(null);

  // Inject the Umami tracker script into <head> once per page load
  useEffect(() => {
    if (document.getElementById(UMAMI_TRACKER.scriptId)) return;

    const script = document.createElement('script');
    script.id = UMAMI_TRACKER.scriptId;
    script.src = UMAMI_TRACKER.src;
    script.defer = true;
    script.setAttribute('data-website-id', UMAMI_TRACKER.websiteId);
    document.head.appendChild(script);
  }, []);

  const fetchAnalytics = useCallback(
    async (r: UmamiRange) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const url = `${apiUrl}?all=true&range=${encodeURIComponent(r)}`;

        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'ngrok-skip-browser-warning': '69420',
          },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        // Guard against ngrok / proxy returning an HTML warning page
        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
          throw new Error(
            'A API retornou HTML (Possível bloqueio de rede ou proxy)',
          );
        }

        const json: UmamiAllApiResponse = await res.json();

        if (json.error) {
          throw new Error(json.error);
        }

        const results = json.results ?? [];
        const aggregatedStats = aggregateStats(results);
        const chartData = buildChartData(results, r);

        setData({
          websites: json.websites ?? [],
          aggregatedStats,
          chartData,
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message =
          err instanceof Error ? err.message : 'Erro ao buscar dados de analytics';
        setError(message);
        setData(EMPTY_DATA);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [apiUrl],
  );

  useEffect(() => {
    fetchAnalytics(range);
    return () => abortRef.current?.abort();
  }, [range, fetchAnalytics]);

  const refresh = useCallback(() => {
    fetchAnalytics(range);
  }, [range, fetchAnalytics]);

  return { data, loading, error, range, setRange, refresh };
}
