import React, { useState, useMemo } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { useITProjectDashboard } from '../../hooks/useITProjectDashboard';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  LayoutDashboard,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Clock,
  Target,
  AlertCircle,
  Users,
  Zap,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const KANBAN_STATUS_COLORS: Record<string, string> = {
  backlog:     '#64748b',
  todo:        '#3b82f6',
  in_progress: '#f59e0b',
  review:      '#8b5cf6',
  done:        '#10b981',
};

const KANBAN_STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'A Fazer',
  in_progress: 'Em Progresso',
  review: 'Revisão',
  done: 'Concluído',
};

const SPRINT_STATUS_CONFIG: Record<string, { badge: string; label: string; node: React.ReactNode }> = {
  completed: {
    label: 'Concluído',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    node: (
      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 ring-4 ring-emerald-500/20">
        <CheckCircle2 className="w-4 h-4 text-white" />
      </div>
    ),
  },
  active: {
    label: 'Em Andamento',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    node: (
      <div className="relative">
        <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-30" />
        <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/30 ring-4 ring-blue-500/20">
          <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
        </div>
      </div>
    ),
  },
  planned: {
    label: 'Planejado',
    badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    node: (
      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center ring-4 ring-slate-200/20 dark:ring-slate-700/20">
        <div className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500" />
      </div>
    ),
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const SkeletonCard: React.FC = () => (
  <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-3xl p-5 animate-pulse">
    <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl mb-4" />
    <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg mb-2" />
    <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full" />
  </div>
);

const SkeletonChart: React.FC = () => (
  <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-3xl p-6 animate-pulse">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      <div className="space-y-2">
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-3 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>
    </div>
    <div className="h-[300px] bg-slate-200/50 dark:bg-slate-700/50 rounded-2xl" />
  </div>
);

const SkeletonTimeline: React.FC = () => (
  <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-3xl p-6 animate-pulse">
    <div className="flex items-center gap-3 mb-8">
      <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      <div className="space-y-2">
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-3 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>
    </div>
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-64 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

type ViewMode = 'executiva' | 'tecnica';

interface ITProjectDashboardProps {
  projectId: string | null;
}

const ITProjectDashboard: React.FC<ITProjectDashboardProps> = ({ projectId }) => {
  const { isDark } = useTheme();
  const [viewMode, setViewMode] = useState<ViewMode>('executiva');
  const { data, isLoading, error, refetch } = useITProjectDashboard(projectId);

  const progressPct = useMemo(() => {
    if (!data || data.metrics.total_tasks === 0) return 0;
    return Math.round((data.metrics.completed_tasks / data.metrics.total_tasks) * 100);
  }, [data]);

  const sprintProgressPct = useMemo(() => {
    if (!data || data.metrics.total_sprints === 0) return 0;
    return Math.round((data.metrics.completed_sprints / data.metrics.total_sprints) * 100);
  }, [data]);

  const healthStatus = progressPct >= 60
    ? { label: 'No Prazo', color: 'emerald', glow: 'shadow-emerald-500/20 border-emerald-500/30' }
    : progressPct >= 40
      ? { label: 'Atenção', color: 'amber', glow: 'shadow-amber-500/20 border-amber-500/30' }
      : { label: 'Crítico', color: 'red', glow: 'shadow-red-500/20 border-red-500/30' };

  const activeSprint = useMemo(
    () => data?.sprints_timeline.find(s => s.status === 'active') ?? null,
    [data]
  );

  const areaChartData = useMemo(() => {
    if (!data) return [];
    return data.sprints_timeline.map(s => ({
      name: s.name,
      total: s.total_tasks,
      completed: s.completed_tasks,
    }));
  }, [data]);

  const donutData = useMemo(() => {
    if (!data) return [];
    return data.status_distribution.map(d => ({
      name: KANBAN_STATUS_LABELS[d.kanban_status] ?? d.kanban_status,
      value: d.count,
      status: d.kanban_status,
    }));
  }, [data]);

  // ── Loading State ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-3xl p-6 lg:p-8 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
            <div className="space-y-2">
              <div className="h-6 w-64 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
        </div>

        {/* KPI skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>

        {/* Chart skeletons */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <SkeletonChart />
          <SkeletonChart />
        </div>

        {/* Timeline skeleton */}
        <SkeletonTimeline />
      </div>
    );
  }

  // ── Error / Empty State ───────────────────────────────────────────────
  if (error || !projectId) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center max-w-md">
          <div className="relative mx-auto w-20 h-20 mb-6">
            <div className="absolute inset-0 bg-slate-300 dark:bg-slate-700 rounded-3xl blur-xl opacity-30" />
            <div className="relative w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center border border-slate-200 dark:border-slate-700">
              <FolderOpen className="w-10 h-10 text-slate-400 dark:text-slate-500" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            {error ? 'Erro ao carregar dados' : 'Nenhum projeto selecionado'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            {error
              ? error
              : 'Selecione um projeto de TI no gerenciador para visualizar o dashboard.'}
          </p>
          {error && (
            <button
              onClick={refetch}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── No data after load ────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Activity className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Sem dados disponíveis para este projeto.</p>
        </div>
      </div>
    );
  }

  // ── KPI Cards ─────────────────────────────────────────────────────────
  const kpiCards = [
    {
      label: 'Progresso Global',
      value: `${progressPct}%`,
      icon: Target,
      gradient: 'from-violet-500 to-purple-600',
      shadow: 'shadow-violet-500/30',
      ring: 'ring-violet-500/20',
      progressValue: progressPct,
      progressGradient: 'from-violet-500 to-purple-500',
    },
    {
      label: 'Sprints',
      value: `${data.metrics.completed_sprints} de ${data.metrics.total_sprints}`,
      subtitle: 'concluídas',
      icon: Calendar,
      gradient: 'from-blue-500 to-cyan-600',
      shadow: 'shadow-blue-500/30',
      ring: 'ring-blue-500/20',
      progressValue: sprintProgressPct,
      progressGradient: 'from-blue-500 to-cyan-500',
    },
    {
      label: 'Volume de Tasks',
      value: data.metrics.total_tasks.toLocaleString('pt-BR'),
      subtitle: 'tarefas mapeadas',
      icon: Zap,
      gradient: 'from-amber-500 to-orange-600',
      shadow: 'shadow-amber-500/30',
      ring: 'ring-amber-500/20',
    },
    {
      label: 'Concluídas',
      value: data.metrics.completed_tasks.toLocaleString('pt-BR'),
      subtitle: 'entregas finalizadas',
      icon: CheckCircle2,
      gradient: 'from-emerald-500 to-green-600',
      shadow: 'shadow-emerald-500/30',
      ring: 'ring-emerald-500/20',
    },
  ];

  return (
    <div className="space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className={`relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border rounded-3xl p-6 lg:p-8 shadow-xl ${healthStatus.glow} transition-all duration-500`}
      >
        <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl opacity-15 bg-violet-500 pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full blur-3xl opacity-10 bg-blue-500 pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="relative flex-shrink-0">
              <div className={`absolute inset-0 bg-gradient-to-br ${healthStatus.color === 'emerald' ? 'from-emerald-500 to-green-600' : healthStatus.color === 'amber' ? 'from-amber-500 to-orange-600' : 'from-red-500 to-rose-600'} rounded-2xl blur-lg opacity-40`} />
              <div className={`relative w-14 h-14 bg-gradient-to-br ${healthStatus.color === 'emerald' ? 'from-emerald-500 to-green-600' : healthStatus.color === 'amber' ? 'from-amber-500 to-orange-600' : 'from-red-500 to-rose-600'} rounded-2xl flex items-center justify-center shadow-xl`}>
                <LayoutDashboard className="w-7 h-7 text-white" />
              </div>
            </div>

            <div>
              <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {data.project.name}
              </h1>
              <div className="flex items-center gap-3 mt-1.5">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  healthStatus.color === 'emerald'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : healthStatus.color === 'amber'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    healthStatus.color === 'emerald' ? 'bg-emerald-500' : healthStatus.color === 'amber' ? 'bg-amber-500 animate-pulse' : 'bg-red-500 animate-pulse'
                  }`} />
                  {healthStatus.label}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {viewMode === 'executiva' ? 'Visão Executiva' : 'Visão Técnica'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-slate-200/50 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-1 shadow-inner border border-white/20 dark:border-slate-700/30">
              {(['executiva', 'tecnica'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
                    viewMode === mode
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {mode === 'executiva' ? 'Executiva' : 'Técnica'}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={refetch}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-all border border-transparent hover:border-slate-200/60 dark:hover:border-slate-600/60"
              title="Atualizar dados"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Cards Grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        {kpiCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="group relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-3xl p-5 hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
              style={{ animationDelay: `${0.1 + i * 0.06}s` }}
            >
              <div className={`absolute -right-8 -top-8 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-20 bg-gradient-to-br ${card.gradient} transition-opacity duration-500 pointer-events-none`} />

              <div className={`relative w-10 h-10 bg-gradient-to-br ${card.gradient} rounded-xl flex items-center justify-center shadow-lg ${card.shadow} ring-4 ${card.ring} mb-4`}>
                <Icon className="w-5 h-5 text-white" />
              </div>

              <div className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-none mb-1">
                {card.value}
              </div>

              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                {card.label}
              </p>

              {card.subtitle && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 -mt-1 mb-3">
                  {card.subtitle}
                </p>
              )}

              {card.progressValue !== undefined && (
                <div className="mt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                      {card.progressValue}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200/60 dark:bg-slate-700/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${card.progressGradient} rounded-full transition-all duration-700 ease-out`}
                      style={{ width: `${card.progressValue}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Analysis Charts Grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Area Chart — Sprint Evolution */}
        <div className="group bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 rounded-xl blur-lg opacity-30" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">
                Evolução de Entregas
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">Total vs concluídas por Sprint</p>
            </div>
          </div>

          {areaChartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-slate-400 dark:text-slate-500 gap-3">
              <TrendingUp className="w-8 h-8 opacity-40" />
              <span className="text-sm font-medium">Sem dados de sprints</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={areaChartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                    <stop offset="50%" stopColor="#3B82F6" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                    <stop offset="50%" stopColor="#10B981" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'rgba(148,163,184,0.8)' }}
                  axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'rgba(148,163,184,0.8)' }}
                  axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '12px',
                    border: `1px solid ${isDark ? 'rgba(51,65,85,0.6)' : 'rgba(226,232,240,0.6)'}`,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                    color: isDark ? '#f1f5f9' : '#1e293b',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    padding: '10px 14px',
                  }}
                  labelStyle={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600, fontSize: 12, marginBottom: 4 }}
                  itemStyle={{ color: isDark ? '#e2e8f0' : '#334155', fontSize: 12 }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif', paddingTop: 12 }}
                />

                <Area
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  fill="url(#gradTotal)"
                  fillOpacity={1}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, fill: isDark ? '#0f172a' : '#fff' }}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Concluídas"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fill="url(#gradCompleted)"
                  fillOpacity={1}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, fill: isDark ? '#0f172a' : '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut Chart — Task Distribution */}
        <div className="group bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500 rounded-xl blur-lg opacity-30" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                <PieChartIcon className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">
                Distribuição por Status
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">Tasks por estágio do pipeline</p>
            </div>
          </div>

          {donutData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-slate-400 dark:text-slate-500 gap-3">
              <PieChartIcon className="w-8 h-8 opacity-40" />
              <span className="text-sm font-medium">Sem dados de distribuição</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="transparent"
                      strokeWidth={0}
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={KANBAN_STATUS_COLORS[entry.status] ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)',
                        backdropFilter: 'blur(12px)',
                        borderRadius: '12px',
                        border: `1px solid ${isDark ? 'rgba(51,65,85,0.6)' : 'rgba(226,232,240,0.6)'}`,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                        color: isDark ? '#f1f5f9' : '#1e293b',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        padding: '10px 14px',
                      }}
                      labelStyle={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600, fontSize: 12, marginBottom: 4 }}
                      itemStyle={{ color: isDark ? '#e2e8f0' : '#334155', fontSize: 12 }}
                      formatter={(value: number) => [`${value} tasks`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend pills */}
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {donutData.map((item) => (
                  <div key={item.status} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/60 dark:bg-slate-800/40">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: KANBAN_STATUS_COLORS[item.status] ?? '#94a3b8' }} />
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{item.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Roadmap Timeline ───────────────────────────────────────────── */}
      <div className="space-y-5">

        {/* Milestone Alert — Sprint Atual */}
        {activeSprint && (
          <div className="relative overflow-hidden bg-gradient-to-r from-violet-500/10 via-blue-500/10 to-cyan-500/10 dark:from-violet-500/20 dark:via-blue-500/20 dark:to-cyan-500/20 backdrop-blur-xl border border-violet-500/30 dark:border-violet-500/40 rounded-3xl p-5 shadow-lg shadow-violet-500/10">
            <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full blur-3xl opacity-20 bg-violet-500 pointer-events-none" />
            <div className="relative flex items-start gap-4">
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 bg-violet-500 rounded-xl blur-lg opacity-40" />
                <div className="relative w-12 h-12 bg-gradient-to-br from-violet-500 to-blue-600 rounded-xl flex items-center justify-center shadow-xl shadow-violet-500/30">
                  <Zap className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
                    Sprint Atual
                  </span>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                    <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-300">Em Progresso</span>
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {activeSprint.name}
                </h3>
                {activeSprint.goal && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {activeSprint.goal}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-2">
                  {activeSprint.start_date && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(activeSprint.start_date).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                  {activeSprint.end_date && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(activeSprint.end_date).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {activeSprint.completed_tasks}/{activeSprint.total_tasks} tasks
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timeline Container */}
        <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 rounded-xl blur-lg opacity-30" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">
                Roadmap do Projeto
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">Timeline de sprints e entregas</p>
            </div>
          </div>

          {data.sprints_timeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500 gap-3">
              <Calendar className="w-8 h-8 opacity-40" />
              <span className="text-sm font-medium">Nenhuma sprint criada para este projeto</span>
            </div>
          ) : (
            <div className="relative space-y-0">
              {data.sprints_timeline.map((sprint, index) => {
                const isLast = index === data.sprints_timeline.length - 1;
                const config = SPRINT_STATUS_CONFIG[sprint.status] ?? SPRINT_STATUS_CONFIG.planned;

                return (
                  <div key={sprint.id} className="relative flex gap-4">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      {config.node}
                      {!isLast && (
                        <div className="w-0.5 h-full min-h-[60px] bg-gradient-to-b from-slate-200 dark:from-slate-700 to-transparent mt-2" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-8">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {sprint.name}
                          </h4>
                          {sprint.goal && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {sprint.goal}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${config.badge}`}>
                            {config.label}
                          </span>
                          {sprint.total_tasks > 0 && (
                            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
                              {sprint.completed_tasks}/{sprint.total_tasks}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        {sprint.start_date && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(sprint.start_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        {sprint.end_date && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(sprint.end_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        {sprint.total_tasks > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500"
                                style={{ width: `${sprint.progress_pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
                              {sprint.progress_pct}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ITProjectDashboard;
