import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

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

export interface EventChartDataPoint {
  date: string;
  [eventName: string]: number | string;
}

export interface EventSummaryItem {
  name: string;
  count: number;
  percentage: number;
}

// ── API response shape for all=true (matches route.ts) ───────────────────────

export interface SiteResult {
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

export type UmamiRange = '24h' | '7d' | '30d' | 'custom';

/**
 * Dados crus da API. A agregação e a montagem dos gráficos ficam a cargo de quem
 * consome — o dashboard filtra por site antes de agregar, então totais calculados
 * aqui seriam sempre descartados.
 */
export interface UmamiAnalyticsData {
  websites: UmamiWebsite[];
  results: SiteResult[];
}

export interface UseUmamiAnalyticsReturn {
  data: UmamiAnalyticsData;
  loading: boolean;
  error: string | null;
  range: UmamiRange;
  setRange: (range: UmamiRange) => void;
  refresh: () => void;
  customStart: Date | null;
  customEnd: Date | null;
  setCustomRange: (start: Date, end: Date) => void;
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
 * - 24h → HH:00  (truncated to hour for consistent bucketing)
 * - 7d / 30d → dd/MM
 */
function formatDateLabel(iso: string, range: UmamiRange): string {
  // Umami pode retornar "YYYY-MM-DD HH:MM:SS" (com espaço) ou "YYYY-MM-DDTHH:MM:SS".
  // Substituímos o espaço por "T" para garantir parse correto em todos os ambientes.
  const d = new Date(iso.replace(' ', 'T'));
  if (isNaN(d.getTime())) return iso;

  const pad = (n: number) => String(n).padStart(2, '0');

  if (range === '24h') {
    return `${pad(d.getHours())}:00`;
  }
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** Builds the sortable key of a Date, matching the format of `dateKey`. */
function dateKeyFromDate(d: Date, range: UmamiRange): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return range === '24h' ? `${day}T${pad(d.getHours())}` : day;
}

/**
 * Sortable key derived from an ISO string, used to order buckets chronologically.
 * - 24h → "YYYY-MM-DDTHH"
 * - demais → "YYYY-MM-DD"
 *
 * A API mistura dois formatos: as séries de pageviews vêm sem fuso
 * ("2026-06-22 00:00:00"), já convertidas para o timezone pedido na query — aí
 * fatiar a string é o certo. Já os eventos vêm em UTC ("2026-07-21T12:19:13.795Z")
 * e precisam ser convertidos, senão tudo que acontece depois das 21h (BRT) cai no
 * dia seguinte.
 */
function dateKey(iso: string, range: UmamiRange): string {
  const normalized = iso.replace(' ', 'T');

  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized)) {
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) return dateKeyFromDate(d, range);
  }

  return range === '24h' ? normalized.slice(0, 13) : normalized.slice(0, 10);
}

/** Local calendar day ("YYYY-MM-DD") of an Umami timestamp or Date. */
export function localDayKey(value: string | Date): string {
  return value instanceof Date ? dateKeyFromDate(value, '7d') : dateKey(value, '7d');
}

/**
 * Distingue pageview (eventType 1) de evento customizado (eventType 2). O endpoint
 * /events devolve os dois misturados: só a contagem de eventType 1 bate com
 * `stats.pageviews`.
 */
export function isPageviewEvent(e: UmamiEvent): boolean {
  return e.eventType === undefined ? !e.eventName : e.eventType === 1;
}

export interface RangeBucket {
  key: string;
  label: string;
}

export interface RangeWindow {
  start: Date;
  end: Date;
  unit: 'hour' | 'day';
}

/**
 * Janela consultada para cada range, ancorada na virada da hora/dia local.
 *
 * Ancorar importa: "30 dias" a partir de `now - 30*24h` cai no meio do dia -30,
 * e o Umami devolve esse dia truncado como um 31º bucket — um degrau falso na
 * ponta esquerda do gráfico. Ancorando à meia-noite saem exatamente 30 dias.
 */
export function buildRangeWindow(
  range: UmamiRange,
  customStart?: Date | null,
  customEnd?: Date | null,
): RangeWindow {
  const end = new Date();

  if (range === '24h') {
    const start = new Date(end);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() - 23);
    return { start, end, unit: 'hour' };
  }

  if (range === 'custom' && customStart && customEnd) {
    const start = new Date(customStart);
    start.setHours(0, 0, 0, 0);
    const stop = new Date(customEnd);
    stop.setHours(23, 59, 59, 999);
    return { start, end: stop, unit: 'day' };
  }

  const days = range === '30d' ? 30 : 7;
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return { start, end, unit: 'day' };
}

/**
 * Generates the full list of expected buckets (key + display label) for the range.
 * Deriva da mesma janela enviada à API, então os rótulos do eixo e os buckets
 * devolvidos pelo Umami cobrem exatamente o mesmo período.
 */
function generateRangeBuckets(
  range: UmamiRange,
  customStart?: Date | null,
  customEnd?: Date | null,
): RangeBucket[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const { start, end, unit } = buildRangeWindow(range, customStart, customEnd);

  const buckets: RangeBucket[] = [];
  const current = new Date(start);
  while (current <= end) {
    buckets.push({
      key: dateKeyFromDate(current, range),
      label:
        unit === 'hour'
          ? `${pad(current.getHours())}:00`
          : `${pad(current.getDate())}/${pad(current.getMonth() + 1)}`,
    });
    // Setters de Date (e não aritmética de ms) para não escorregar em mudanças de fuso.
    if (unit === 'hour') current.setHours(current.getHours() + 1);
    else current.setDate(current.getDate() + 1);
  }
  return buckets;
}

/**
 * Combines pageviews + sessions arrays from ALL sites, grouping by bucket key,
 * and returns a Recharts-ready dataset sorted chronologically. Buckets sem dados
 * no período aparecem zerados.
 */
export function buildChartData(
  results: SiteResult[],
  range: UmamiRange,
  customStart?: Date | null,
  customEnd?: Date | null,
): ChartDataPoint[] {
  const pvMap = new Map<string, number>();
  const sessMap = new Map<string, number>();
  const labelByKey = new Map<string, string>();

  for (const r of results) {
    if (!r.pageviews) continue;

    for (const p of r.pageviews.pageviews) {
      const key = dateKey(p.x, range);
      labelByKey.set(key, formatDateLabel(p.x, range));
      pvMap.set(key, (pvMap.get(key) ?? 0) + p.y);
    }

    for (const s of r.pageviews.sessions) {
      const key = dateKey(s.x, range);
      labelByKey.set(key, formatDateLabel(s.x, range));
      sessMap.set(key, (sessMap.get(key) ?? 0) + s.y);
    }
  }

  // Nenhum resultado ativo → gráfico vazio (o dashboard mostra o estado "sem dados").
  if (!labelByKey.size) return [];

  for (const b of generateRangeBuckets(range, customStart, customEnd)) {
    if (!labelByKey.has(b.key)) labelByKey.set(b.key, b.label);
  }

  // As chaves são "YYYY-MM-DD[THH]", que ordenam corretamente como string.
  const allKeys = Array.from(labelByKey.keys()).sort();

  return allKeys.map((key) => ({
    date: labelByKey.get(key)!,
    pageviews: pvMap.get(key) ?? 0,
    sessions: sessMap.get(key) ?? 0,
  }));
}

export function buildEventChartData(
  results: SiteResult[],
  range: UmamiRange,
  customStart?: Date | null,
  customEnd?: Date | null,
): { chartData: EventChartDataPoint[]; summary: EventSummaryItem[]; eventNames: string[] } {
  const dateMap = new Map<string, Map<string, number>>();

  for (const r of results) {
    for (const e of r.events ?? []) {
      if (!e.eventName) continue;
      const key = dateKey(e.createdAt, range);
      if (!dateMap.has(key)) dateMap.set(key, new Map());
      const byName = dateMap.get(key)!;
      byName.set(e.eventName, (byName.get(e.eventName) ?? 0) + 1);
    }
  }

  // Use all expected buckets for the range so days/hours without events appear as zero
  const buckets = generateRangeBuckets(range, customStart, customEnd);

  const nameSet = new Set<string>();
  for (const byName of dateMap.values()) for (const n of byName.keys()) nameSet.add(n);
  const eventNames = Array.from(nameSet);

  const chartData: EventChartDataPoint[] = buckets.map(({ key, label }) => {
    const row: EventChartDataPoint = { date: label };
    const byName = dateMap.get(key);
    for (const name of eventNames) row[name] = byName?.get(name) ?? 0;
    return row;
  });

  const totals = new Map<string, number>();
  for (const byName of dateMap.values())
    for (const [name, count] of byName) totals.set(name, (totals.get(name) ?? 0) + count);

  const grandTotal = Array.from(totals.values()).reduce((a, b) => a + b, 0);
  const summary: EventSummaryItem[] = Array.from(totals.entries())
    .map(([name, count]) => ({ name, count, percentage: grandTotal ? Math.round((count / grandTotal) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  return { chartData, summary, eventNames };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const API_URL = '/api/umami';

/**
 * Umami client-side tracker — injected once into <head>. Endereço e id do site
 * são públicos (vão no HTML), mas ficam no .env para não precisar recompilar ao
 * trocar de instância — as duas variáveis já existiam ali, sem uso.
 */
const UMAMI_TRACKER = {
  src: import.meta.env.VITE_UMAMI_TRACKER_SRC ?? 'https://umamilab.ngrok.dev/script.js',
  websiteId: import.meta.env.VITE_UMAMI_WEBSITE_ID ?? '237b1a87-ebab-4ff1-affd-3a1b87068881',
  scriptId: 'umami-tracker',
} as const;

const EMPTY_DATA: UmamiAnalyticsData = {
  websites: [],
  results: [],
};

export function useUmamiAnalytics(
  initialRange: UmamiRange = '7d',
  apiUrl: string = API_URL,
): UseUmamiAnalyticsReturn {
  const [data, setData] = useState<UmamiAnalyticsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<UmamiRange>(initialRange);
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);

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
    async (r: UmamiRange, cStart?: Date | null, cEnd?: Date | null) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        // A janela é sempre calculada aqui (e não a partir de `range` no servidor)
        // para que os buckets do Umami batam com os rótulos do eixo. O timezone do
        // navegador vai junto: é ele que define onde o Umami corta cada bucket.
        const { start, end, unit } = buildRangeWindow(r, cStart, cEnd);
        const query = new URLSearchParams({
          all: 'true',
          startAt: String(start.getTime()),
          endAt: String(end.getTime()),
          unit,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        const url = `${apiUrl}?${query.toString()}`;

        // A rota exige a sessão do usuário (permissão canManageIT) — ver
        // api/_lib/umamiAuth.ts.
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('Sessão expirada. Faça login novamente.');

        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
            'ngrok-skip-browser-warning': '69420',
          },
        });

        if (!res.ok) {
          // 401/403 trazem uma mensagem útil no corpo ("Sessão inválida ou
          // expirada.", "Sem permissão...") — mostrar isso em vez do status cru.
          const body = await res.json().catch(() => null);
          const apiError = (body as { error?: string } | null)?.error;
          throw new Error(apiError || `HTTP ${res.status}: ${res.statusText}`);
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

        setData({
          websites: json.websites ?? [],
          results: json.results ?? [],
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
    fetchAnalytics(range, customStart, customEnd);
    return () => abortRef.current?.abort();
  }, [range, customStart, customEnd, fetchAnalytics]);

  const refresh = useCallback(() => {
    fetchAnalytics(range, customStart, customEnd);
  }, [range, customStart, customEnd, fetchAnalytics]);

  const setCustomRange = useCallback((start: Date, end: Date) => {
    setCustomStart(start);
    setCustomEnd(end);
    setRange('custom');
  }, []);

  return { data, loading, error, range, setRange, refresh, customStart, customEnd, setCustomRange };
}
