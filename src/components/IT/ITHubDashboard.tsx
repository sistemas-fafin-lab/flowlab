import React, { useState, useMemo } from 'react';
import {
  Server,
  Activity,
  Eye,
  Users,
  Clock,
  ArrowDownRight,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Globe,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useUmamiAnalytics, type UmamiRange, type SiteResult, buildChartData, statValue } from '../../hooks/useUmamiAnalytics';
import { useTheme } from '../../hooks/useTheme';

// ── Range labels ─────────────────────────────────────────────────────────────

const RANGE_OPTIONS: { value: UmamiRange; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatAvgTime(totaltime: number, pageviews: number): string {
  const avgSeconds = Math.round(totaltime / Math.max(pageviews, 1));
  if (avgSeconds < 60) return `${avgSeconds}s`;
  const mins = Math.floor(avgSeconds / 60);
  const secs = avgSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// ── Component ────────────────────────────────────────────────────────────────

const ITHubDashboard: React.FC = () => {
  const { isDark } = useTheme();
  const { data, loading, error, range, setRange, refresh } = useUmamiAnalytics('7d');
  const [selectedWebsite, setSelectedWebsite] = useState<string | 'all'>('all');

  const activeResults = useMemo<SiteResult[]>(
    () => selectedWebsite === 'all'
      ? data.results
      : data.results.filter(r => r.id === selectedWebsite),
    [selectedWebsite, data.results],
  );

  const filteredChartData = useMemo(
    () => buildChartData(activeResults, range),
    [activeResults, range],
  );

  const filteredStats = useMemo(() => ({
    pageviews: activeResults.reduce((sum, r) => sum + statValue(r.stats.pageviews), 0),
    visitors: activeResults.reduce((sum, r) => sum + statValue(r.stats.visitors), 0),
    visits: activeResults.reduce((sum, r) => sum + statValue(r.stats.visits ?? 0), 0),
    bounces: activeResults.reduce((sum, r) => sum + statValue(r.stats.bounces ?? 0), 0),
    totaltime: activeResults.reduce((sum, r) => sum + statValue(r.stats.totaltime ?? 0), 0),
  }), [activeResults]);

  const topPages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of activeResults) {
      for (const e of r.events ?? []) {
        const path = e.urlPath || '/';
        counts.set(path, (counts.get(path) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [activeResults]);

  // Chart theme tokens (mirrors Dashboard.tsx)
  const chartFont = 'Inter, system-ui, -apple-system, sans-serif';
  const chartTooltipStyle: React.CSSProperties = {
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
    borderRadius: '12px',
    border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
    boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.08)',
    color: isDark ? '#f1f5f9' : '#1e293b',
    fontFamily: chartFont,
    padding: '10px 14px',
  };
  const chartTooltipLabelStyle: React.CSSProperties = {
    color: isDark ? '#94a3b8' : '#64748b',
    fontWeight: 600,
    fontFamily: chartFont,
  };
  const chartTooltipItemStyle: React.CSSProperties = {
    color: isDark ? '#e2e8f0' : '#334155',
    fontFamily: chartFont,
  };
  const chartAxisTick = { fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b', fontFamily: chartFont };
  const chartGridColor = isDark ? 'rgba(51,65,85,0.4)' : 'rgba(226,232,240,0.8)';
  const chartAxisLineColor = isDark ? '#334155' : '#e2e8f0';

  const s = filteredStats;
  const hasStats = s.pageviews > 0 || s.visitors > 0;

  const statCards = [
    {
      label: 'Visualizações',
      value: s.pageviews,
      icon: Eye,
      color: 'bg-gradient-to-br from-blue-500 to-blue-600',
      shadow: 'shadow-blue-500/30',
      ring: 'ring-blue-500/20',
      flareColor: 'bg-blue-500',
    },
    {
      label: 'Visitantes Únicos',
      value: s.visitors,
      icon: Users,
      color: 'bg-gradient-to-br from-purple-500 to-violet-600',
      shadow: 'shadow-purple-500/30',
      ring: 'ring-purple-500/20',
      flareColor: 'bg-purple-500',
    },
    {
      label: 'Tempo Médio',
      value: hasStats ? formatAvgTime(s.totaltime, s.pageviews) : '—',
      icon: Clock,
      color: 'bg-gradient-to-br from-emerald-500 to-green-600',
      shadow: 'shadow-emerald-500/30',
      ring: 'ring-emerald-500/20',
      flareColor: 'bg-emerald-500',
      isText: true,
    },
    {
      label: 'Taxa de Rejeição',
      value: hasStats ? `${Math.round((s.bounces / Math.max(s.visits, 1)) * 100)}%` : '—',
      icon: ArrowDownRight,
      color: 'bg-gradient-to-br from-orange-500 to-amber-600',
      shadow: 'shadow-orange-500/30',
      ring: 'ring-orange-500/20',
      flareColor: 'bg-orange-500',
      isText: true,
    },
  ];

  // Websites from Umami or fallback nav modules
  const websiteCards = data.websites.length > 0
    ? data.websites.map((w) => ({ id: w.id, name: w.name, domain: w.domain }))
    : null;

  return (
    <div className="space-y-8 pb-8">
      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div className="text-center animate-fade-in-up">
        <div className="flex items-center justify-center gap-4 mb-2">
          <div className="relative">
            <div className="absolute inset-0 bg-violet-500 rounded-3xl blur-xl opacity-40" />
            <div className="relative w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-violet-500/30">
            <Server className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent mt-4">
          Hub de Aplicações
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          Acompanhe as métricas das plataformas
        </p>
      </div>

      {/* ── Analytics Section ─────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto w-full px-4 space-y-6">

        {/* Section header + range selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
          <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 rounded-2xl blur-lg opacity-40" />
                <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/25">
                  <Activity className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100">
                  Métricas de Uso da Plataforma
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Dados do Umami Analytics</p>
              </div>
            </div>

          <div className="flex items-center gap-2">
            {/* Segmented range pills — iOS style */}
            <div className="flex bg-slate-200/50 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-1 shadow-inner border border-white/20 dark:border-slate-700/30">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRange(opt.value)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                    range === opt.value
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={refresh}
              disabled={loading}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-all disabled:opacity-50 border border-transparent hover:border-slate-200/60 dark:hover:border-slate-600/60"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Error banner — same pattern as Dashboard.tsx */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 sm:p-6 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">Erro ao carregar métricas</p>
                <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Websites monitored (from Umami) ───────────────────────── */}
        {websiteCards && websiteCards.length > 0 && (
          <div className="animate-fade-in-up" style={{ animationDelay: '0.38s' }}>
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Sites monitorados ({websiteCards.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedWebsite('all')}
                className={`inline-flex items-center gap-2 backdrop-blur-2xl rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200 ${
                  selectedWebsite === 'all'
                    ? 'bg-emerald-500/20 border border-emerald-500/50 shadow-lg shadow-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : 'bg-white/60 dark:bg-slate-900/60 border border-white/50 dark:border-slate-700/50 opacity-60 hover:opacity-100 text-slate-700 dark:text-slate-200'
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                Todos
              </button>
              {websiteCards.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSelectedWebsite(selectedWebsite === w.id ? 'all' : w.id)}
                  className={`inline-flex items-center gap-2 backdrop-blur-2xl rounded-xl px-3.5 py-2 text-sm transition-all duration-200 ${
                    selectedWebsite === w.id
                      ? 'bg-emerald-500/20 border border-emerald-500/50 shadow-lg shadow-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                      : 'bg-white/60 dark:bg-slate-900/60 border border-white/50 dark:border-slate-700/50 opacity-60 hover:opacity-100 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    selectedWebsite === w.id ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                  }`} />
                  <span className="font-medium">{w.name}</span>
                  {w.domain && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">{w.domain}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Stat Cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          {statCards.map((card, i) => {
            const SIcon = card.icon;
            return (
              <div
                key={card.label}
                className="relative overflow-hidden bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/50 dark:border-slate-700/50 rounded-3xl p-5 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 animate-fade-in-up"
                style={{ animationDelay: `${0.4 + i * 0.06}s` }}
              >
                {/* Flare */}
                <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 ${card.flareColor}`} />

                <div className={`relative w-10 h-10 ${card.color} rounded-xl flex items-center justify-center shadow-lg ${card.shadow} ring-4 ${card.ring} mb-4`}>
                  <SIcon className="w-5 h-5 text-white" />
                </div>
                <div className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-none mb-2">
                  {loading ? (
                    <div className="h-10 w-20 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
                  ) : card.isText ? (
                    card.value
                  ) : (
                    Number(card.value).toLocaleString('pt-BR')
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{card.label}</p>
              </div>
            );
          })}
        </div>

        {/* ── Area Chart Card ───────────────────────────────────────── */}
        <div
          className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/50 dark:border-slate-700/50 rounded-3xl p-6 shadow-sm hover:shadow-2xl transition-shadow duration-300 animate-fade-in-up"
          style={{ animationDelay: '0.5s' }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl shadow-lg shadow-blue-500/25">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">
                  Acessos vs Sessões{selectedWebsite !== 'all' ? ` — ${websiteCards?.find(w => w.id === selectedWebsite)?.name ?? ''}` : ''}
                </h4>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {selectedWebsite === 'all' ? 'Tráfego agregado de todas as aplicações' : 'Filtrando por aplicação selecionada'}
                </p>
              </div>
            </div>

            {/* Live dot */}
            {!loading && data.chartData.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Ao vivo</span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-80">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                <span className="text-xs text-gray-400">Carregando métricas...</span>
              </div>
            </div>
          ) : filteredChartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-80 text-slate-400 dark:text-slate-500 gap-3">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700/50 rounded-3xl flex items-center justify-center">
                <Activity className="w-8 h-8" />
              </div>
              <span className="text-sm font-semibold tracking-tight">Sem dados para o período selecionado</span>
              <button
                onClick={refresh}
                className="text-xs text-violet-500 hover:text-violet-600 dark:text-violet-400 font-medium"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={filteredChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="itGradPageviews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                    <stop offset="50%" stopColor="#3B82F6" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="itGradSessions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.35} />
                    <stop offset="50%" stopColor="#8B5CF6" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={chartAxisTick}
                  axisLine={{ stroke: chartAxisLineColor }}
                  tickLine={false}
                />
                <YAxis
                  tick={chartAxisTick}
                  axisLine={{ stroke: chartAxisLineColor }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  labelStyle={chartTooltipLabelStyle}
                  itemStyle={chartTooltipItemStyle}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, fontFamily: chartFont, paddingTop: 12 }}
                />

                <Area
                  type="monotone"
                  dataKey="pageviews"
                  name="Visualizações"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  fill="url(#itGradPageviews)"
                  fillOpacity={1}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, fill: isDark ? '#0f172a' : '#fff' }}
                />
                <Area
                  type="monotone"
                  dataKey="sessions"
                  name="Sessões"
                  stroke="#8B5CF6"
                  strokeWidth={2.5}
                  fill="url(#itGradSessions)"
                  fillOpacity={1}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, fill: isDark ? '#0f172a' : '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Top Páginas ───────────────────────────────────────── */}
        <div
          className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/50 dark:border-slate-700/50 rounded-3xl p-6 shadow-sm hover:shadow-2xl transition-shadow duration-300 animate-fade-in-up"
          style={{ animationDelay: '0.55s' }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">
                Páginas mais acessadas
              </h4>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {selectedWebsite === 'all'
                  ? 'Todas as aplicações'
                  : websiteCards?.find(w => w.id === selectedWebsite)?.name ?? 'Aplicação selecionada'}
              </p>
            </div>
          </div>
          {topPages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500 gap-2">
              <Globe className="w-8 h-8 opacity-40" />
              <span className="text-sm font-medium">Nenhum evento registrado para o período</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {topPages.map((page, i) => (
                <div
                  key={page.path}
                  className="flex items-center justify-between gap-4 px-4 py-2.5 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/60 dark:hover:bg-slate-700/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate font-mono">
                      {page.path}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex-shrink-0 tabular-nums">
                    {page.count.toLocaleString('pt-BR')} visitas
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ITHubDashboard;
