import React, { useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  AlertTriangle,
  Calendar,
  TrendingUp,
  Loader2,
  DollarSign,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  PieChart as PieChartIcon,
  Activity,
  Eye,
  EyeOff,
  LineChart,
  Building2,
  ClipboardList,
  ShoppingCart,
  Wrench,
  CreditCard,
  Clock,
  GripVertical,
  Lock,
  Unlock,
  RotateCcw
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { useMaintenanceRequest } from '../hooks/useMaintenanceRequest';
import { usePaymentRequest } from '../hooks/usePaymentRequest';
import { useTheme } from '../hooks/useTheme';
import DetailModal from './DetailModal';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  LineChart as RechartsLineChart,
  Line
} from 'recharts';
import {
  WidthProvider,
  Responsive,
  type Layout,
  type LayoutItem,
  type ResponsiveLayouts
} from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const CHART_KEYS = ['inventory-status-chart', 'categories-pie-chart', 'movements-area-chart', 'category-value-bar'];

type Layouts = ResponsiveLayouts;

const GRID_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480 };
const GRID_COLS        = { lg: 12, md: 10, sm: 6, xs: 2 };
const GRID_ROW_HEIGHT  = 50;
const LAYOUT_STORAGE_KEY = 'flowLab_dashboard_layout';

// ─── Layout padrão (fallback para primeiro acesso) ───────────────
const DEFAULT_LAYOUTS: Layouts = {
  lg: [
    { i: 'stats-summary',         x: 0,  y: 0,  w: 12, h: 3,  minW: 6,  minH: 2 },
    { i: 'charts-toggle',         x: 0,  y: 3,  w: 12, h: 1,  minW: 4,  minH: 1, static: true },
    { i: 'inventory-status-chart', x: 0,  y: 4,  w: 4,  h: 6,  minW: 3,  minH: 4 },
    { i: 'categories-pie-chart',  x: 4,  y: 4,  w: 4,  h: 6,  minW: 3,  minH: 4 },
    { i: 'movements-area-chart',  x: 8,  y: 4,  w: 4,  h: 7,  minW: 3,  minH: 5 },
    { i: 'category-value-bar',    x: 0,  y: 10, w: 12, h: 6,  minW: 6,  minH: 4 },
    { i: 'financial-stats',       x: 0,  y: 16, w: 12, h: 4,  minW: 6,  minH: 3 },
    { i: 'categories-list',       x: 0,  y: 20, w: 6,  h: 6,  minW: 4,  minH: 4 },
    { i: 'department-ranking',    x: 6,  y: 20, w: 6,  h: 6,  minW: 4,  minH: 4 },
    { i: 'recent-movements',      x: 0,  y: 26, w: 12, h: 6,  minW: 6,  minH: 4 },
    { i: 'top-value',             x: 0,  y: 32, w: 6,  h: 6,  minW: 4,  minH: 4 },
    { i: 'low-stock',             x: 6,  y: 32, w: 6,  h: 6,  minW: 4,  minH: 4 },
    { i: 'expiring',              x: 0,  y: 38, w: 6,  h: 6,  minW: 4,  minH: 4 },
    { i: 'financial-summary',     x: 0,  y: 44, w: 12, h: 5,  minW: 6,  minH: 3 },
    { i: 'request-metrics',       x: 0,  y: 49, w: 12, h: 9,  minW: 6,  minH: 6 },
  ],
  md: [
    { i: 'stats-summary',         x: 0, y: 0,  w: 10, h: 3 },
    { i: 'charts-toggle',         x: 0, y: 3,  w: 10, h: 1, static: true },
    { i: 'inventory-status-chart', x: 0, y: 4,  w: 5,  h: 6 },
    { i: 'categories-pie-chart',  x: 5, y: 4,  w: 5,  h: 6 },
    { i: 'movements-area-chart',  x: 0, y: 10, w: 10, h: 7 },
    { i: 'category-value-bar',    x: 0, y: 17, w: 10, h: 6 },
    { i: 'financial-stats',       x: 0, y: 23, w: 10, h: 4 },
    { i: 'categories-list',       x: 0, y: 27, w: 5,  h: 6 },
    { i: 'department-ranking',    x: 5, y: 27, w: 5,  h: 6 },
    { i: 'recent-movements',      x: 0, y: 33, w: 10, h: 6 },
    { i: 'top-value',             x: 0, y: 39, w: 5,  h: 6 },
    { i: 'low-stock',             x: 5, y: 39, w: 5,  h: 6 },
    { i: 'expiring',              x: 0, y: 45, w: 5,  h: 6 },
    { i: 'financial-summary',     x: 0, y: 51, w: 10, h: 5 },
    { i: 'request-metrics',       x: 0, y: 56, w: 10, h: 9 },
  ],
  sm: [
    { i: 'stats-summary',         x: 0, y: 0,  w: 6, h: 5 },
    { i: 'charts-toggle',         x: 0, y: 5,  w: 6, h: 1, static: true },
    { i: 'inventory-status-chart', x: 0, y: 6,  w: 6, h: 6 },
    { i: 'categories-pie-chart',  x: 0, y: 12, w: 6, h: 6 },
    { i: 'movements-area-chart',  x: 0, y: 18, w: 6, h: 7 },
    { i: 'category-value-bar',    x: 0, y: 25, w: 6, h: 6 },
    { i: 'financial-stats',       x: 0, y: 31, w: 6, h: 5 },
    { i: 'categories-list',       x: 0, y: 36, w: 6, h: 6 },
    { i: 'department-ranking',    x: 0, y: 42, w: 6, h: 6 },
    { i: 'recent-movements',      x: 0, y: 48, w: 6, h: 6 },
    { i: 'top-value',             x: 0, y: 54, w: 6, h: 6 },
    { i: 'low-stock',             x: 0, y: 60, w: 6, h: 6 },
    { i: 'expiring',              x: 0, y: 66, w: 6, h: 6 },
    { i: 'financial-summary',     x: 0, y: 72, w: 6, h: 5 },
    { i: 'request-metrics',       x: 0, y: 77, w: 6, h: 10 },
  ],
  xs: [
    { i: 'stats-summary',         x: 0, y: 0,   w: 2, h: 9 },
    { i: 'charts-toggle',         x: 0, y: 9,   w: 2, h: 1, static: true },
    { i: 'inventory-status-chart', x: 0, y: 10,  w: 2, h: 6 },
    { i: 'categories-pie-chart',  x: 0, y: 16,  w: 2, h: 6 },
    { i: 'movements-area-chart',  x: 0, y: 22,  w: 2, h: 7 },
    { i: 'category-value-bar',    x: 0, y: 29,  w: 2, h: 7 },
    { i: 'financial-stats',       x: 0, y: 36,  w: 2, h: 7 },
    { i: 'categories-list',       x: 0, y: 43,  w: 2, h: 6 },
    { i: 'department-ranking',    x: 0, y: 49,  w: 2, h: 6 },
    { i: 'recent-movements',      x: 0, y: 55,  w: 2, h: 6 },
    { i: 'top-value',             x: 0, y: 61,  w: 2, h: 6 },
    { i: 'low-stock',             x: 0, y: 67,  w: 2, h: 6 },
    { i: 'expiring',              x: 0, y: 73,  w: 2, h: 6 },
    { i: 'financial-summary',     x: 0, y: 79,  w: 2, h: 6 },
    { i: 'request-metrics',       x: 0, y: 85,  w: 2, h: 12 },
  ],
};

// ─── Drag Handle (6-dots) ────────────────────────────────────────
const DragHandle: React.FC = () => (
  <div className="drag-handle cursor-grab active:cursor-grabbing absolute top-2 right-2 z-10 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100">
    <GripVertical className="w-4 h-4" />
  </div>
);

// Paleta moderna — azul primário + ciano neon + tons complementares
const CHART_COLORS = [
  '#3B82F6', '#22D3EE', '#6366F1', '#38BDF8',
  '#818CF8', '#2DD4BF', '#A78BFA', '#67E8F9'
];

// Skeleton Component para loading
const SkeletonCard: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="space-y-3 flex-1">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 skeleton"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16 skeleton"></div>
      </div>
      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl skeleton"></div>
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const { getDashboardData, getFinancialMetrics, products, movements, requests, loading, error } = useInventory();
  const { maintenanceRequests } = useMaintenanceRequest();
  const { paymentRequests } = usePaymentRequest();
  const { isDark } = useTheme();
  const [selectedDetail, setSelectedDetail] = useState<string | null>(null);
  const [showCharts, setShowCharts] = useState<boolean>(true);
  const savedChartLayouts = useRef<Record<string, LayoutItem[]>>({});
  const [movementsPeriod, setMovementsPeriod] = useState<7 | 15 | 30 | 'custom'>(7);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [requestsPeriod, setRequestsPeriod] = useState<7 | 15 | 30 | 'custom'>(30);
  const [requestsCustomStart, setRequestsCustomStart] = useState<string>('');
  const [requestsCustomEnd, setRequestsCustomEnd] = useState<string>('');

  // ─── Grid Layout state + persistência localStorage ─────────────
  const [isGridLocked, setIsGridLocked] = useState(true);
  const [layouts, setLayouts] = useState<Layouts>(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (saved) return JSON.parse(saved) as Layouts;
    } catch { /* fallback */ }
    return DEFAULT_LAYOUTS;
  });

  const handleLayoutChange = useCallback((_currentLayout: Layout, allLayouts: Layouts) => {
    if (!isGridLocked) {
      setLayouts(allLayouts);
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(allLayouts));
    }
  }, [isGridLocked]);

  const resetLayout = useCallback(() => {
    setLayouts(DEFAULT_LAYOUTS);
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
  }, []);

  const toggleCharts = useCallback(() => {
    setShowCharts(prev => {
      if (prev) {
        // Hiding charts: save their layout items for each breakpoint
        const saved: Record<string, LayoutItem[]> = {};
        for (const bp of Object.keys(layouts)) {
          saved[bp] = (layouts as Record<string, LayoutItem[]>)[bp].filter((item: LayoutItem) => CHART_KEYS.includes(item.i));
        }
        savedChartLayouts.current = saved;
      } else {
        // Showing charts: restore saved positions into current layouts
        setLayouts(current => {
          const restored: Record<string, LayoutItem[]> = {};
          for (const bp of Object.keys(current)) {
            const currentItems = (current as Record<string, LayoutItem[]>)[bp];
            const savedItems = savedChartLayouts.current[bp] || 
              (DEFAULT_LAYOUTS as Record<string, LayoutItem[]>)[bp].filter((item: LayoutItem) => CHART_KEYS.includes(item.i));
            // Merge: keep non-chart items, add back chart items at saved positions
            const withoutCharts = currentItems.filter((item: LayoutItem) => !CHART_KEYS.includes(item.i));
            restored[bp] = [...withoutCharts, ...savedItems];
          }
          localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(restored));
          return restored as Layouts;
        });
      }
      return !prev;
    });
  }, [layouts]);

  // Configuração visual dos gráficos (tema-aware)
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
  const chartTooltipLabelStyle: React.CSSProperties = { color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600, fontFamily: chartFont };
  const chartTooltipItemStyle: React.CSSProperties = { color: isDark ? '#e2e8f0' : '#334155', fontFamily: chartFont };
  const chartAxisTick = { fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b', fontFamily: chartFont };
  const chartGridColor = isDark ? 'rgba(51,65,85,0.4)' : 'rgba(226,232,240,0.8)';
  const chartAxisLineColor = isDark ? '#334155' : '#e2e8f0';

  // Mover dashboardData e financialMetrics para antes dos hooks
  const dashboardData = !loading && !error ? getDashboardData() : null;
  const financialMetrics = !loading && !error ? getFinancialMetrics() : null;

  // Dados para gráficos - DEVE estar antes de qualquer return condicional
  const chartData = useMemo(() => {
    if (!dashboardData || !products || !movements) {
      return {
        categoryPieData: [],
        categoryValueData: [],
        movementsAreaData: [],
        statusData: []
      };
    }

    // Verificação de segurança para evitar erros
    const allCategories = dashboardData?.allCategories || {};
    const allCategoryValues = dashboardData?.allCategoryValues || {};

    // Dados para gráfico de pizza - Categorias
    const categoryPieData = Object.entries(allCategories).map(([name, count], index) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: count as number,
      color: CHART_COLORS[index % CHART_COLORS.length]
    }));

    // Dados para gráfico de barras - Valor por categoria
    const categoryValueData = Object.entries(allCategoryValues)
      .map(([name, value]) => ({
        name: name.length > 12 ? name.substring(0, 12) + '...' : name,
        fullName: name,
        valor: (value as number) || 0
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6);

    // Dados para gráfico de área - Movimentações por período
    const now = new Date();
    let startDate = new Date();
    
    // Definir período de filtro
    if (movementsPeriod === 'custom' && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
    } else if (typeof movementsPeriod === 'number') {
      startDate.setDate(now.getDate() - movementsPeriod);
    }
    
    const filteredMovements = (movements || []).filter(movement => {
      if (!movement?.date) return false;
      const movDate = new Date(movement.date);
      if (movementsPeriod === 'custom' && customEndDate) {
        return movDate >= startDate && movDate <= new Date(customEndDate);
      }
      return movDate >= startDate;
    });
    
    const movementsByPeriod = filteredMovements.reduce((acc: Record<string, { entradas: number; saidas: number }>, movement) => {
      if (!movement?.date) return acc;
      const date = new Date(movement.date);
      const key = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      
      if (!acc[key]) {
        acc[key] = { entradas: 0, saidas: 0 };
      }
      
      acc[key].saidas += 1; // Conta o número de movimentações, não a quantidade
      return acc;
    }, {});

    const movementsAreaData = Object.entries(movementsByPeriod)
      .sort((a, b) => {
        const [dayA, monthA] = a[0].split('/').map(Number);
        const [dayB, monthB] = b[0].split('/').map(Number);
        return monthA === monthB ? dayA - dayB : monthA - monthB;
      })
      .map(([date, values]) => ({
        date,
        ...values
      }));

    // Dados para indicadores de status
    const statusData = [
      { name: 'Ativos', value: (products || []).filter(p => p.status === 'active').length, color: '#34D399' },
      { name: 'Estoque Baixo', value: (products || []).filter(p => p.status === 'low-stock').length, color: '#FBBF24' },
      { name: 'Vencidos', value: (products || []).filter(p => {
        if (!p?.expirationDate) return false;
        const expDate = new Date(p.expirationDate);
        return expDate < new Date();
      }).length, color: '#F87171' }
    ].filter(item => item.value > 0);

    // Dados para ranking de solicitações por departamento
    const departmentRanking = (requests || []).reduce((acc: Record<string, { total: number; pending: number; approved: number; rejected: number }>, request) => {
      const dept = request.department || 'Não informado';
      if (!acc[dept]) {
        acc[dept] = { total: 0, pending: 0, approved: 0, rejected: 0 };
      }
      acc[dept].total += 1;
      if (request.status === 'pending') acc[dept].pending += 1;
      else if (request.status === 'approved' || request.status === 'completed') acc[dept].approved += 1;
      else if (request.status === 'rejected') acc[dept].rejected += 1;
      return acc;
    }, {});

    const departmentRankingData = Object.entries(departmentRanking)
      .map(([name, data]) => ({
        name,
        ...data
      }))
      .sort((a, b) => b.total - a.total);

    return {
      categoryPieData,
      categoryValueData,
      movementsAreaData,
      statusData,
      departmentRankingData
    };
  }, [dashboardData, products, movements, requests, movementsPeriod, customStartDate, customEndDate]);

  // ═══════════════════════════════════════════════════════════════════
  // MÉTRICAS DE SOLICITAÇÕES — useMemo otimizado para volume, SLA, status e sparklines
  // ═══════════════════════════════════════════════════════════════════
  const requestMetrics = useMemo(() => {
    const now = new Date();
    
    // Calcular datas de início/fim do período atual
    let periodStart = new Date();
    let periodEnd = new Date();
    
    if (requestsPeriod === 'custom' && requestsCustomStart && requestsCustomEnd) {
      periodStart = new Date(requestsCustomStart);
      periodEnd = new Date(requestsCustomEnd);
    } else if (typeof requestsPeriod === 'number') {
      periodStart.setDate(now.getDate() - requestsPeriod);
      periodEnd = now;
    }
    
    // Calcular período anterior para tendência
    const periodDays = typeof requestsPeriod === 'number' ? requestsPeriod : 
      Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const prevPeriodStart = new Date(periodStart);
    prevPeriodStart.setDate(prevPeriodStart.getDate() - periodDays);
    const prevPeriodEnd = new Date(periodStart);
    prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 1);

    // Helper: checa se uma data está no período
    const isInPeriod = (dateStr: string | undefined | null, start: Date, end: Date): boolean => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d >= start && d <= end;
    };

    // Helper: converte milissegundos em dias
    const msToDays = (ms: number) => ms / (1000 * 60 * 60 * 24);

    // Helper: gerar dados para sparkline (agrupa por dia)
    const generateSparkline = (items: Array<{ date: string }>, days: number) => {
      const data: Array<{ day: number; count: number }> = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr = d.toISOString().split('T')[0];
        const count = items.filter(item => item.date.startsWith(dayStr)).length;
        data.push({ day: days - i, count });
      }
      return data;
    };

    // ─────────────────────────────────────────────────────────────────
    // 1. COMPRAS / MATERIAIS
    // ─────────────────────────────────────────────────────────────────
    const comprasCurrent = (requests || []).filter(r => isInPeriod(r.requestDate, periodStart, periodEnd));
    const comprasPrev = (requests || []).filter(r => isInPeriod(r.requestDate, prevPeriodStart, prevPeriodEnd));
    const comprasVolume = comprasCurrent.length;
    const comprasPrevVolume = comprasPrev.length;
    const comprasTrend = comprasPrevVolume > 0 ? ((comprasVolume - comprasPrevVolume) / comprasPrevVolume) * 100 : 0;
    
    // Status breakdown
    const comprasPending = comprasCurrent.filter(r => r.status === 'pending').length;
    const comprasApproved = comprasCurrent.filter(r => r.status === 'approved' || r.status === 'completed').length;
    const comprasRejected = comprasCurrent.filter(r => r.status === 'rejected').length;

    // SLA
    const comprasResponseTimes: number[] = [];
    comprasCurrent.forEach(req => {
      if (req.status === 'completed') {
        const movement = (movements || []).find(m => m.requestId === req.id);
        if (movement) {
          const start = new Date(req.requestDate).getTime();
          const end = new Date(movement.date).getTime();
          if (end >= start) comprasResponseTimes.push(msToDays(end - start));
        }
      }
    });
    const comprasAvgDays = comprasResponseTimes.length > 0
      ? comprasResponseTimes.reduce((a, b) => a + b, 0) / comprasResponseTimes.length
      : null;

    // Sparkline
    const comprasSparkline = generateSparkline(
      comprasCurrent.map(r => ({ date: r.requestDate })),
      typeof requestsPeriod === 'number' ? requestsPeriod : periodDays
    );

    // ─────────────────────────────────────────────────────────────────
    // 2. MANUTENÇÃO
    // ─────────────────────────────────────────────────────────────────
    const manutencaoCurrent = (maintenanceRequests || []).filter(r => isInPeriod(r.createdAt, periodStart, periodEnd));
    const manutencaoPrev = (maintenanceRequests || []).filter(r => isInPeriod(r.createdAt, prevPeriodStart, prevPeriodEnd));
    const manutencaoVolume = manutencaoCurrent.length;
    const manutencaoPrevVolume = manutencaoPrev.length;
    const manutencaoTrend = manutencaoPrevVolume > 0 ? ((manutencaoVolume - manutencaoPrevVolume) / manutencaoPrevVolume) * 100 : 0;
    
    // Status breakdown
    const manutencaoPending = manutencaoCurrent.filter(r => r.status === 'pending' || r.status === 'in_progress').length;
    const manutencaoApproved = manutencaoCurrent.filter(r => r.status === 'completed').length;
    const manutencaoRejected = manutencaoCurrent.filter(r => r.status === 'cancelled').length;

    // SLA
    const manutencaoResponseTimes: number[] = [];
    manutencaoCurrent.forEach(req => {
      const finalStatuses = ['completed', 'concluido', 'finalizado'];
      if (finalStatuses.includes(req.status?.toLowerCase() || '') && req.updatedAt && req.createdAt) {
        const start = new Date(req.createdAt).getTime();
        const end = new Date(req.updatedAt).getTime();
        if (end >= start) manutencaoResponseTimes.push(msToDays(end - start));
      }
    });
    const manutencaoAvgDays = manutencaoResponseTimes.length > 0
      ? manutencaoResponseTimes.reduce((a, b) => a + b, 0) / manutencaoResponseTimes.length
      : null;

    // Sparkline
    const manutencaoSparkline = generateSparkline(
      manutencaoCurrent.map(r => ({ date: r.createdAt || '' })),
      typeof requestsPeriod === 'number' ? requestsPeriod : periodDays
    );

    // ─────────────────────────────────────────────────────────────────
    // 3. PAGAMENTOS
    // ─────────────────────────────────────────────────────────────────
    const pagamentosCurrent = (paymentRequests || []).filter(r => isInPeriod(r.createdAt, periodStart, periodEnd));
    const pagamentosPrev = (paymentRequests || []).filter(r => isInPeriod(r.createdAt, prevPeriodStart, prevPeriodEnd));
    const pagamentosVolume = pagamentosCurrent.length;
    const pagamentosPrevVolume = pagamentosPrev.length;
    const pagamentosTrend = pagamentosPrevVolume > 0 ? ((pagamentosVolume - pagamentosPrevVolume) / pagamentosPrevVolume) * 100 : 0;
    
    // Status breakdown
    const pagamentosPending = pagamentosCurrent.filter(r => r.status === 'pending').length;
    const pagamentosApproved = pagamentosCurrent.filter(r => r.status === 'paid' || r.status === 'approved').length;
    const pagamentosRejected = pagamentosCurrent.filter(r => r.status === 'cancelled').length;

    // SLA
    const pagamentosResponseTimes: number[] = [];
    pagamentosCurrent.forEach(req => {
      const finalStatuses = ['paid', 'approved', 'completed', 'pago', 'aprovado'];
      if (finalStatuses.includes(req.status?.toLowerCase() || '') && req.updatedAt && req.createdAt) {
        const start = new Date(req.createdAt).getTime();
        const end = new Date(req.updatedAt).getTime();
        if (end >= start) pagamentosResponseTimes.push(msToDays(end - start));
      }
    });
    const pagamentosAvgDays = pagamentosResponseTimes.length > 0
      ? pagamentosResponseTimes.reduce((a, b) => a + b, 0) / pagamentosResponseTimes.length
      : null;

    // Sparkline
    const pagamentosSparkline = generateSparkline(
      pagamentosCurrent.map(r => ({ date: r.createdAt || '' })),
      typeof requestsPeriod === 'number' ? requestsPeriod : periodDays
    );

    // ─────────────────────────────────────────────────────────────────
    // MÉDIA GERAL
    // ─────────────────────────────────────────────────────────────────
    const allTimes = [...comprasResponseTimes, ...manutencaoResponseTimes, ...pagamentosResponseTimes];
    const avgGeral = allTimes.length > 0
      ? allTimes.reduce((a, b) => a + b, 0) / allTimes.length
      : null;

    return {
      compras: { 
        volume: comprasVolume, 
        avgDays: comprasAvgDays,
        trend: comprasTrend,
        pending: comprasPending,
        approved: comprasApproved,
        rejected: comprasRejected,
        sparkline: comprasSparkline,
        slaMeta: 3 // Meta em dias
      },
      manutencao: { 
        volume: manutencaoVolume, 
        avgDays: manutencaoAvgDays,
        trend: manutencaoTrend,
        pending: manutencaoPending,
        approved: manutencaoApproved,
        rejected: manutencaoRejected,
        sparkline: manutencaoSparkline,
        slaMeta: 2
      },
      pagamentos: { 
        volume: pagamentosVolume, 
        avgDays: pagamentosAvgDays,
        trend: pagamentosTrend,
        pending: pagamentosPending,
        approved: pagamentosApproved,
        rejected: pagamentosRejected,
        sparkline: pagamentosSparkline,
        slaMeta: 1
      },
      avgGeral,
    };
  }, [requests, movements, maintenanceRequests, paymentRequests, requestsPeriod, requestsCustomStart, requestsCustomEnd]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-48 h-8 bg-gray-200 rounded skeleton"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-6 animate-fade-in">
        <div className="flex items-center">
          <AlertTriangle className="w-6 h-6 text-red-500 mr-3" />
          <span className="text-red-700 dark:text-red-300 font-medium">Erro ao carregar dados: {error}</span>
        </div>
      </div>
    );
  }

  if (!dashboardData || !financialMetrics) {
    return null;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return <ArrowUpRight className="w-4 h-4 text-green-600 dark:text-green-400" />;
    if (value < 0) return <ArrowDownRight className="w-4 h-4 text-red-600 dark:text-red-400" />;
    return <Minus className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
  };

  const getTrendColor = (value: number) => {
    if (value > 0) return 'text-green-600 dark:text-green-400';
    if (value < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const stats = [
    {
      name: 'Total de Produtos',
      value: dashboardData.totalProducts,
      icon: Package,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      detailKey: 'allProducts'
    },
    {
      name: 'Estoque Baixo',
      value: dashboardData.lowStockProducts,
      icon: AlertTriangle,
      color: 'bg-orange-500',
      textColor: 'text-orange-600',
      detailKey: 'lowStock'
    },
    {
      name: 'Próximos ao Vencimento',
      value: dashboardData.expiringProducts,
      icon: Calendar,
      color: 'bg-red-500',
      textColor: 'text-red-600',
      detailKey: 'expiring'
    },
    {
      name: 'Movimentações Recentes',
      value: dashboardData.recentMovements,
      icon: TrendingUp,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      detailKey: 'recentMovements'
    }
  ];

  const financialStats = [
    {
      name: 'Valor Total do Estoque',
      value: formatCurrency(dashboardData.totalInventoryValue),
      change: dashboardData.monthlyInventoryChangePercent,
      changeValue: formatCurrency(dashboardData.monthlyInventoryChange),
      icon: DollarSign,
      color: 'bg-emerald-500',
      detailKey: 'financialStats'
    },
    {
      name: 'Movimentações do Mês',
      value: formatCurrency(dashboardData.monthlyMovementsValue),
      change: dashboardData.monthlyMovementsChangePercent,
      changeValue: formatCurrency(dashboardData.monthlyMovementsChange),
      icon: BarChart3,
      color: 'bg-purple-500',
      detailKey: 'financialStats'
    },
    {
      name: 'Valor Médio por Produto',
      value: formatCurrency(dashboardData.averageProductValue),
      change: 0, // Pode ser calculado se necessário
      changeValue: formatCurrency(0),
      icon: Package,
      color: 'bg-indigo-500',
      detailKey: 'financialStats'
    }
  ];

  const lowStockProducts = products.filter(p => p.status === 'low-stock');
  const expiringProducts = products.filter(p => {
    if (p.quantity <= 0) return false; // Não exibir produtos sem estoque
    const expirationDate = new Date(p.expirationDate);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expirationDate <= thirtyDaysFromNow;
  });

  const recentMovements = movements.slice(0, 5);

  const getModalTitle = (detail: string): string => {
    const titles: Record<string, string> = {
      lowStock: 'Produtos com Estoque Baixo',
      expiring: 'Produtos Próximos ao Vencimento',
      recentMovements: 'Movimentações Recentes',
      topValue: 'Produtos de Maior Valor',
      financialStats: 'Métricas Financeiras Detalhadas',
      categories: 'Produtos por Categoria',
      allProducts: 'Todos os Produtos',
      departmentRanking: 'Solicitações por Departamento - Controle de Custos'
    };
    return titles[detail] || 'Detalhes';
  };

  const renderModalContent = (
    detail: string, 
    dashboardData: any, 
    financialMetrics: any, 
    products: any[], 
    movements: any[], 
    formatCurrency: (value: number) => string
  ) => {
    switch (detail) {
      case 'lowStock':
        const lowStockProducts = products.filter(p => p.status === 'low-stock');
        return (
          <div className="space-y-4">
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              {lowStockProducts.length} produto(s) com estoque abaixo do mínimo
            </p>
            <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs sm:text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produto</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Atual</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Mín</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Valor</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Local</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {lowStockProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                        <div>
                          <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">{product.name}</div>
                          <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{product.code}</div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-orange-600 dark:text-orange-400 font-medium">
                        {product.quantity} {product.unit}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                        {product.minStock} {product.unit}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100 hidden sm:table-cell">
                        {formatCurrency(product.totalValue || 0)}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                        {product.location}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'expiring':
        const expiringProducts = products
          .filter(p => {
            if (p.quantity <= 0) return false; // Não exibir produtos sem estoque
            const expirationDate = new Date(p.expirationDate);
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
            return expirationDate <= thirtyDaysFromNow;
          })
          .sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());
        
        return (
          <div className="space-y-4">
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              {expiringProducts.length} produto(s) próximos ao vencimento (próximos 30 dias)
            </p>
            <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs sm:text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produto</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Validade</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Dias</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Qtd</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Valor</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {expiringProducts.map((product) => {
                    const daysUntilExpiration = Math.ceil(
                      (new Date(product.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <tr key={product.id}>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                          <div>
                            <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">{product.name}</div>
                            <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{product.code}</div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                          {product.expirationDate}
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                          <span className={`text-xs sm:text-sm font-medium ${
                            daysUntilExpiration < 0 ? 'text-red-600 dark:text-red-400' : 
                            daysUntilExpiration <= 7 ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'
                          }`}>
                            {daysUntilExpiration < 0 ? `${Math.abs(daysUntilExpiration)}d` : 
                             `${daysUntilExpiration}d`}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100 hidden sm:table-cell">
                          {product.quantity} {product.unit}
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100 hidden md:table-cell">
                          {formatCurrency(product.totalValue || 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'recentMovements':
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthlyMovements = movements.filter(movement => {
          const moveDate = new Date(movement.date);
          return moveDate.getMonth() === currentMonth && moveDate.getFullYear() === currentYear;
        });
        
        return (
          <div className="space-y-4">
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              {monthlyMovements.length} movimentação(ões) no mês atual
            </p>
            <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs sm:text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Data</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produto</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qtd</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Motivo</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Valor</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden lg:table-cell">Por</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {monthlyMovements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                        {movement.date}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                        {movement.productName}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-red-600 dark:text-red-400 font-medium">
                        -{movement.quantity}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                        <span className="px-2 py-1 text-[10px] sm:text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full">
                          {movement.reason === 'sale' && 'Saída'}
                          {movement.reason === 'internal-consumption' && 'Consumo'}
                          {movement.reason === 'internal-transfer' && 'Transfer.'}
                          {movement.reason === 'return' && 'Devolução'}
                          {movement.reason === 'other' && 'Outros'}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100 hidden md:table-cell">
                        {formatCurrency(movement.totalValue || 0)}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                        {movement.authorizedBy || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'topValue':
        const sortedProducts = [...products].sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0));
        
        return (
          <div className="space-y-3 sm:space-y-4">
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Todos os produtos ordenados por valor total (decrescente)
            </p>
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Pos.</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produto</th>
                    <th className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qtd</th>
                    <th className="hidden md:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Preço Unit.</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                    <th className="hidden lg:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Categoria</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {sortedProducts.map((product, index) => (
                    <tr key={product.id}>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                        #{index + 1}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                        <div>
                          <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">{product.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{product.code}</div>
                          <div className="sm:hidden text-xs text-gray-500 dark:text-gray-400">{product.quantity} {product.unit}</div>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                        {product.quantity} {product.unit}
                      </td>
                      <td className="hidden md:table-cell px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                        {formatCurrency(product.unitPrice || 0)}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(product.totalValue || 0)}
                      </td>
                      <td className="hidden lg:table-cell px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          product.category === 'general' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200' : 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200'
                        }`}>
                          {product.category === 'general' ? 'Uso Geral' : 'Insumo Técnico'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'financialStats':
        return (
          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-blue-50 dark:bg-blue-900/30 p-3 sm:p-4 rounded-lg">
                <h4 className="text-base sm:text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2 sm:mb-3">Mês Atual</h4>
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex justify-between text-sm sm:text-base">
                    <span className="text-blue-700 dark:text-blue-300">Valor do Estoque:</span>
                    <span className="font-medium text-blue-900 dark:text-blue-100">{formatCurrency(financialMetrics.currentMonth.inventoryValue)}</span>
                  </div>
                  <div className="flex justify-between text-sm sm:text-base">
                    <span className="text-blue-700 dark:text-blue-300">Movimentações:</span>
                    <span className="font-medium text-blue-900 dark:text-blue-100">{formatCurrency(financialMetrics.currentMonth.movementsValue)}</span>
                  </div>
                  <div className="flex justify-between text-sm sm:text-base">
                    <span className="text-blue-700 dark:text-blue-300">Nº Movimentações:</span>
                    <span className="font-medium text-blue-900 dark:text-blue-100">{financialMetrics.currentMonth.movementsCount}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700/50 p-3 sm:p-4 rounded-lg">
                <h4 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2 sm:mb-3">Mês Anterior</h4>
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex justify-between text-sm sm:text-base">
                    <span className="text-gray-700 dark:text-gray-300">Valor do Estoque:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(financialMetrics.previousMonth.inventoryValue)}</span>
                  </div>
                  <div className="flex justify-between text-sm sm:text-base">
                    <span className="text-gray-700 dark:text-gray-300">Movimentações:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(financialMetrics.previousMonth.movementsValue)}</span>
                  </div>
                  <div className="flex justify-between text-sm sm:text-base">
                    <span className="text-gray-700 dark:text-gray-300">Nº Movimentações:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{financialMetrics.previousMonth.movementsCount}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg">
              <h4 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-3">Variações</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-xs sm:text-sm text-green-700 dark:text-green-300">Valor do Estoque</div>
                  <div className={`text-base sm:text-lg font-bold ${getTrendColor(financialMetrics.trends.inventoryValueChangePercent)}`}>
                    {formatCurrency(financialMetrics.trends.inventoryValueChange)}
                  </div>
                  <div className={`text-xs sm:text-sm ${getTrendColor(financialMetrics.trends.inventoryValueChangePercent)}`}>
                    {formatPercentage(financialMetrics.trends.inventoryValueChangePercent)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs sm:text-sm text-green-700 dark:text-green-300">Movimentações</div>
                  <div className={`text-base sm:text-lg font-bold ${getTrendColor(financialMetrics.trends.movementsValueChangePercent)}`}>
                    {formatCurrency(financialMetrics.trends.movementsValueChange)}
                  </div>
                  <div className={`text-xs sm:text-sm ${getTrendColor(financialMetrics.trends.movementsValueChangePercent)}`}>
                    {formatPercentage(financialMetrics.trends.movementsValueChangePercent)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs sm:text-sm text-green-700 dark:text-green-300">Nº Movimentações</div>
                  <div className={`text-base sm:text-lg font-bold ${getTrendColor(financialMetrics.trends.movementsCountChangePercent)}`}>
                    {financialMetrics.trends.movementsCountChange >= 0 ? '+' : ''}{financialMetrics.trends.movementsCountChange}
                  </div>
                  <div className={`text-xs sm:text-sm ${getTrendColor(financialMetrics.trends.movementsCountChangePercent)}`}>
                    {formatPercentage(financialMetrics.trends.movementsCountChangePercent)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'categories':
        // Gerar dados de categoria dinamicamente a partir de todas as categorias
        const categoryColors = [
          { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', accent: 'bg-blue-500' },
          { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300', accent: 'bg-green-500' },
          { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-700 dark:text-purple-300', accent: 'bg-purple-500' },
          { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-300', accent: 'bg-orange-500' },
          { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300', accent: 'bg-red-500' },
          { bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-200 dark:border-indigo-800', text: 'text-indigo-700 dark:text-indigo-300', accent: 'bg-indigo-500' },
          { bg: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-200 dark:border-pink-800', text: 'text-pink-700 dark:text-pink-300', accent: 'bg-pink-500' },
          { bg: 'bg-teal-50 dark:bg-teal-900/20', border: 'border-teal-200 dark:border-teal-800', text: 'text-teal-700 dark:text-teal-300', accent: 'bg-teal-500' }
        ];

        const allCategoryData = Object.entries(dashboardData.allCategories)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .map(([categoryName, count], index) => ({
            name: categoryName,
            count: count as number,
            value: dashboardData.allCategoryValues[categoryName] || 0,
            products: products.filter(p => p.category === categoryName),
            colors: categoryColors[index % categoryColors.length]
          }));
        
        return (
          <div className="space-y-4 sm:space-y-6">
            {/* Resumo Geral */}
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800 rounded-xl p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="text-center">
                  <p className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">{allCategoryData.length}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Categorias</p>
                </div>
                <div className="text-center">
                  <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{products.length}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Produtos</p>
                </div>
                <div className="text-center">
                  <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(dashboardData.totalInventoryValue)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Valor Total</p>
                </div>
                <div className="text-center">
                  <p className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{formatCurrency(dashboardData.averageProductValue)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Valor Médio</p>
                </div>
              </div>
            </div>

            {/* Grid de Categorias */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allCategoryData.map((category) => (
                <div 
                  key={category.name} 
                  className={`${category.colors.bg} ${category.colors.border} border rounded-xl p-4 transition-all duration-200 hover:shadow-md`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${category.colors.accent}`}></div>
                      <h4 className={`text-sm font-semibold ${category.colors.text} capitalize`}>{category.name}</h4>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${category.colors.bg} ${category.colors.text} border ${category.colors.border}`}>
                      {category.count} {category.count === 1 ? 'item' : 'itens'}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Valor Total:</span>
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{formatCurrency(category.value)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Valor Médio:</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {formatCurrency(category.count > 0 ? category.value / category.count : 0)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Lista de Produtos da Categoria */}
                  {category.products.length > 0 && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                      <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Produtos:</h5>
                      <div className="max-h-32 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                        {category.products.map((product) => (
                          <div key={product.id} className="flex justify-between items-center text-xs bg-white/50 dark:bg-gray-700/50 rounded-lg px-2 py-1.5">
                            <span className="text-gray-700 dark:text-gray-300 truncate flex-1 mr-2">{product.name}</span>
                            <span className="text-gray-800 dark:text-gray-100 font-medium whitespace-nowrap">{formatCurrency(product.totalValue || 0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 'allProducts':
        return (
          <div className="space-y-3 sm:space-y-4">
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              {products.length} produto(s) cadastrado(s) no sistema
            </p>
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produto</th>
                    <th className="hidden md:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Categoria</th>
                    <th className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qtd</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Valor</th>
                    <th className="hidden lg:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Validade</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                        <div>
                          <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">{product.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{product.code}</div>
                          <div className="sm:hidden text-xs text-gray-500 dark:text-gray-400">{product.quantity} {product.unit}</div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          product.category === 'general' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200' : 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200'
                        }`}>
                          {product.category === 'general' ? 'Uso Geral' : 'Insumo Técnico'}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                        {product.quantity} {product.unit}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                        <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-medium rounded-full ${
                          product.status === 'active' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' :
                          product.status === 'low-stock' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200' :
                          'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200'
                        }`}>
                          {product.status === 'active' ? 'Ativo' :
                           product.status === 'low-stock' ? 'Baixo' : 'Vencido'}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                        {formatCurrency(product.totalValue || 0)}
                      </td>
                      <td className="hidden lg:table-cell px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                        {product.expirationDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'departmentRanking':
        return (
          <div className="space-y-3 sm:space-y-4">
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Análise de solicitações por centro de custo - Total de {requests.length} solicitação(ões)
            </p>
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">#</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Depto</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Total</th>
                    <th className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Pend.</th>
                    <th className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Aprov.</th>
                    <th className="hidden md:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Rejeit.</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Taxa</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {chartData.departmentRankingData.map((dept, index) => {
                    const approvalRate = dept.total > 0 ? ((dept.approved / dept.total) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={dept.name} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                          <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">{index + 1}</span>
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="hidden sm:block p-2 rounded-lg bg-slate-100 dark:bg-slate-700 mr-3">
                              <Building2 className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                            </div>
                            <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">{dept.name}</span>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                          <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100">{dept.total}</span>
                        </td>
                        <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                          <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200">
                            {dept.pending}
                          </span>
                        </td>
                        <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                          <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-medium rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200">
                            {dept.approved}
                          </span>
                        </td>
                        <td className="hidden md:table-cell px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                          <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-medium rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200">
                            {dept.rejected}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="hidden sm:block w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2 mr-2">
                              <div
                                className="bg-emerald-500 h-2 rounded-full transition-all"
                                style={{ width: `${approvalRate}%` }}
                              ></div>
                            </div>
                            <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">{approvalRate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );

      default:
        return <div className="text-gray-500 dark:text-gray-400">Conteúdo não encontrado</div>;
    }
  };

  return (
    <>
      {/* ─── Toolbar do Grid ─────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-2 mb-3">
        <button
          onClick={() => setIsGridLocked(prev => !prev)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
            isGridLocked
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              : 'bg-blue-500 text-white shadow-md hover:bg-blue-600'
          }`}
          title={isGridLocked ? 'Desbloquear layout para arrastar/redimensionar' : 'Bloquear layout'}
        >
          {isGridLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          {isGridLocked ? 'Editar Layout' : 'Bloqueado'}
        </button>
        {!isGridLocked && (
          <button
            onClick={resetLayout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
            title="Restaurar layout padrão"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Resetar
          </button>
        )}
      </div>

      {/* ─── Grid Responsivo com Drag & Drop ─────────────────────── */}
      <div className="animate-fade-in">
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={GRID_BREAKPOINTS}
        cols={GRID_COLS}
        rowHeight={GRID_ROW_HEIGHT}
        onLayoutChange={handleLayoutChange}
        isDraggable={!isGridLocked}
        isResizable={!isGridLocked}
        draggableHandle=".drag-handle"
        margin={[16, 16]}
        containerPadding={[0, 0]}
      >
        {/* ════ Widget: Stats Summary ═════════════════════════════ */}
        <div key="stats-summary" className="group">
          <div className="h-full bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden p-4">
            <DragHandle />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div 
              key={stat.name} 
              className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm p-3 sm:p-6 border border-gray-100 dark:border-gray-700 cursor-pointer hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-300 hover-lift card-interactive animate-fade-in-up"
              style={{ animationDelay: `${index * 0.05}s` }}
              onClick={() => setSelectedDetail(stat.detailKey)}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{stat.name}</p>
                  <p className={`text-xl sm:text-3xl font-bold ${stat.textColor} mt-1 sm:mt-2`}>{stat.value}</p>
                </div>
                <div className={`p-2 sm:p-4 rounded-xl sm:rounded-2xl ${stat.color} shadow-lg flex-shrink-0 ml-2`}>
                  <Icon className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
          </div>
        </div>

        {/* ════ Widget: Charts Toggle ════════════════════════════ */}
        <div key="charts-toggle">
          <div className="h-full flex items-center">
      <div className="flex items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg flex-shrink-0">
            <LineChart className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <h2 className="text-sm sm:text-lg font-semibold text-gray-800 dark:text-gray-200 truncate">Gráficos e Indicadores</h2>
        </div>
        <button
          onClick={toggleCharts}
          className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm transition-all duration-300 flex-shrink-0 ${
            showCharts 
              ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/70' 
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {showCharts ? (
            <>
              <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Ocultar</span>
              <span className="hidden sm:inline"> Gráficos</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Mostrar</span>
              <span className="hidden sm:inline"> Gráficos</span>
            </>
          )}
        </button>
      </div>
          </div>
        </div>

        {/* ════ Widget: Inventory Status Chart (Pie) ═════════════ */}
        <div key="inventory-status-chart" className="group">
          <div className="h-full flex flex-col bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden p-4 sm:p-6">
            <DragHandle />
            <AnimatePresence mode="wait">
            {showCharts && (
              <motion.div
                key="inventory-status-content"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="flex flex-col flex-1 min-h-0"
              >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-sm sm:text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center">
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-emerald-500 shadow-lg mr-2 sm:mr-3">
                <PieChartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              Status do Estoque
            </h3>
          </div>
          <div className="flex-1 min-h-0">
            {chartData.statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    <linearGradient id="pieStatusGrad-0" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34D399" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.8}/>
                    </linearGradient>
                    <linearGradient id="pieStatusGrad-1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FBBF24" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#D97706" stopOpacity={0.8}/>
                    </linearGradient>
                    <linearGradient id="pieStatusGrad-2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F87171" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#DC2626" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  <Pie
                    data={chartData.statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                    cornerRadius={6}
                  >
                    {chartData.statusData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={`url(#pieStatusGrad-${index})`} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={chartTooltipStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span className="text-sm text-gray-600 dark:text-gray-300">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <PieChartIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sem dados de status</p>
                </div>
              </div>
            )}
          </div>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>

        {/* ════ Widget: Categories Pie Chart ═════════════════════ */}
        <div key="categories-pie-chart" className="group">
          <div className="h-full flex flex-col bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden p-4 sm:p-6">
            <DragHandle />
            <AnimatePresence mode="wait">
            {showCharts && (
              <motion.div
                key="categories-pie-content"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="flex flex-col flex-1 min-h-0"
              >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-sm sm:text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center">
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-purple-500 shadow-lg mr-2 sm:mr-3">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              Categorias
            </h3>
          </div>
          <div className="flex-1 min-h-0">
            {chartData.categoryPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {CHART_COLORS.map((color, i) => {
                      const ends = ['#1D4ED8','#0E7490','#4338CA','#0369A1','#4F46E5','#0F766E','#7C3AED','#0891B2'];
                      return (
                        <linearGradient key={i} id={`pieCatGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={1}/>
                          <stop offset="100%" stopColor={ends[i % ends.length]} stopOpacity={0.8}/>
                        </linearGradient>
                      );
                    })}
                  </defs>
                  <Pie
                    data={chartData.categoryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                    cornerRadius={5}
                  >
                    {chartData.categoryPieData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={`url(#pieCatGrad-${index % CHART_COLORS.length})`} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={chartTooltipStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                    formatter={(value: number) => [`${value} produtos`, 'Quantidade']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sem categorias cadastradas</p>
                </div>
              </div>
            )}
          </div>
          {chartData.categoryPieData.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {chartData.categoryPieData.slice(0, 4).map((cat, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }}></div>
                  <span className="text-gray-600 dark:text-gray-300 capitalize">{cat.name}</span>
                </div>
              ))}
            </div>
          )}
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>

        {/* ════ Widget: Movements Area Chart ════════════════════ */}
        <div key="movements-area-chart" className="group">
          <div className="h-full flex flex-col bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden p-4 sm:p-6">
            <DragHandle />
            <AnimatePresence mode="wait">
            {showCharts && (
              <motion.div
                key="movements-area-content"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="flex flex-col flex-1 min-h-0"
              >
          <div className="mb-3 sm:mb-4">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h3 className="text-sm sm:text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center">
                <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-blue-500 shadow-lg mr-2 sm:mr-3">
                  <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                Movimentações
              </h3>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <button
                onClick={() => setMovementsPeriod(7)}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium rounded-lg transition-all ${
                  movementsPeriod === 7
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                7d
              </button>
              <button
                onClick={() => setMovementsPeriod(15)}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium rounded-lg transition-all ${
                  movementsPeriod === 15
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                15d
              </button>
              <button
                onClick={() => setMovementsPeriod(30)}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium rounded-lg transition-all ${
                  movementsPeriod === 30
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                30d
              </button>
              <button
                onClick={() => setMovementsPeriod('custom')}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium rounded-lg transition-all ${
                  movementsPeriod === 'custom'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Custom
              </button>
              {movementsPeriod === 'custom' && (
                <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto mt-2 sm:mt-0 sm:ml-2">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="flex-1 sm:flex-none px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">até</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="flex-1 sm:flex-none px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {chartData.movementsAreaData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.movementsAreaData}>
                  <defs>
                    <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : chartGridColor} opacity={isDark ? 0.4 : 0.8} vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tick={chartAxisTick}
                    axisLine={{ stroke: chartAxisLineColor }}
                    tickLine={{ stroke: chartAxisLineColor }}
                  />
                  <YAxis 
                    tick={chartAxisTick}
                    axisLine={{ stroke: chartAxisLineColor }}
                    tickLine={{ stroke: chartAxisLineColor }}
                  />
                  <Tooltip 
                    contentStyle={chartTooltipStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="saidas" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorSaidas)"
                    name="Saídas"
                    dot={false}
                    activeDot={{ r: 5, fill: '#3B82F6', stroke: isDark ? '#1e293b' : '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Activity className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sem movimentações recentes</p>
                </div>
              </div>
            )}
          </div>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>

        {/* ════ Widget: Category Value Bar Chart ════════════════ */}
        <div key="category-value-bar" className="group">
          <div className="h-full flex flex-col bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden p-4 sm:p-6">
            <DragHandle />
            <AnimatePresence mode="wait">
            {showCharts && (
              <motion.div
                key="category-value-content"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="flex flex-col flex-1 min-h-0"
              >
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-indigo-500 shadow-lg mr-2 sm:mr-3">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <span className="hidden xs:inline">Valor em Estoque por </span>Categoria
          </h3>
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300">
            Top 6
          </span>
        </div>
        <div className="flex-1 min-h-0">
          {chartData.categoryValueData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.categoryValueData} layout="vertical">
                <defs>
                  {CHART_COLORS.map((color, i) => (
                    <linearGradient key={i} id={`barGrad-${i}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={color} stopOpacity={0.65} />
                      <stop offset="100%" stopColor={color} stopOpacity={1} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : chartGridColor} opacity={isDark ? 0.4 : 0.8} horizontal={true} vertical={false} />
                <XAxis 
                  type="number" 
                  tick={chartAxisTick}
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  axisLine={{ stroke: chartAxisLineColor }}
                  tickLine={{ stroke: chartAxisLineColor }}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={chartAxisTick}
                  width={100}
                  axisLine={{ stroke: chartAxisLineColor }}
                  tickLine={{ stroke: chartAxisLineColor }}
                />
                <Tooltip 
                  contentStyle={chartTooltipStyle}
                  labelStyle={chartTooltipLabelStyle}
                  itemStyle={chartTooltipItemStyle}
                  formatter={(value: number) => [formatCurrency(value), 'Valor']}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                  cursor={{ fill: isDark ? 'rgba(51,65,85,0.3)' : 'rgba(226,232,240,0.5)' }}
                />
                <Bar 
                  dataKey="valor" 
                  radius={[0, 8, 8, 0]}
                  name="Valor em Estoque"
                >
                  {chartData.categoryValueData.map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`url(#barGrad-${index % CHART_COLORS.length})`}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      strokeWidth={1}
                      strokeOpacity={0.3}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sem dados disponíveis</p>
              </div>
            </div>
          )}
        </div>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>

        {/* ════ Widget: Financial Stats ═════════════════════════ */}
        <div key="financial-stats" className="group">
          <div className="h-full bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden p-4 sm:p-6">
            <DragHandle />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
        {financialStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div 
              key={stat.name} 
              className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm p-3 sm:p-6 border border-gray-100 dark:border-gray-700 cursor-pointer hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-300 hover-lift card-interactive animate-fade-in-up"
              style={{ animationDelay: `${(index + 4) * 0.05}s` }}
              onClick={() => setSelectedDetail(stat.detailKey)}
            >
              <div className="flex items-center justify-between mb-2 sm:mb-4">
                <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${stat.color} shadow-lg`}>
                  <Icon className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex items-center space-x-1 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-gray-50 dark:bg-gray-700">
                  {getTrendIcon(stat.change)}
                  <span className={`text-xs sm:text-sm font-medium ${getTrendColor(stat.change)}`}>
                    {formatPercentage(stat.change)}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">{stat.name}</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-100 mt-0.5 sm:mt-1">{stat.value}</p>
                <p className={`text-xs sm:text-sm mt-1 sm:mt-2 ${getTrendColor(stat.change)}`}>
                  {stat.change >= 0 ? '+' : ''}{stat.changeValue} <span className="hidden xs:inline">vs mês anterior</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
          </div>
        </div>

        {/* ════ Widget: Categories List ═════════════════════════ */}
        <div key="categories-list" className="group">
          <div className="h-full bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden p-4 sm:p-6 cursor-pointer hover:shadow-lg hover:border-purple-200 dark:hover:border-purple-800 transition-all duration-300"
            onClick={() => setSelectedDetail('categories')}
          >
            <DragHandle />
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-sm sm:text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center">
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-purple-500 shadow-lg mr-2 sm:mr-3">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              Produtos por Categoria
            </h3>
            <span className="text-xs font-medium px-2 sm:px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300">
              {Object.keys(dashboardData.allCategories).length} <span className="hidden xs:inline">categorias</span>
            </span>
          </div>
          <div className="space-y-2 sm:space-y-3 max-h-52 sm:max-h-64 overflow-y-auto pr-1">
            {Object.entries(dashboardData.allCategories)
              .sort(([, a], [, b]) => b - a)
              .map(([category, count], index) => {
                const colorStyles = [
                  { bg: 'bg-blue-100 dark:bg-blue-900/30', bar: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
                  { bg: 'bg-green-100 dark:bg-green-900/30', bar: 'bg-green-500', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' },
                  { bg: 'bg-purple-100 dark:bg-purple-900/30', bar: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
                  { bg: 'bg-orange-100 dark:bg-orange-900/30', bar: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
                  { bg: 'bg-red-100 dark:bg-red-900/30', bar: 'bg-red-500', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
                  { bg: 'bg-indigo-100 dark:bg-indigo-900/30', bar: 'bg-indigo-500', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' },
                  { bg: 'bg-pink-100 dark:bg-pink-900/30', bar: 'bg-pink-500', text: 'text-pink-700 dark:text-pink-300', dot: 'bg-pink-500' },
                  { bg: 'bg-teal-100 dark:bg-teal-900/30', bar: 'bg-teal-500', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' }
                ];
                const style = colorStyles[index % colorStyles.length];
                const percentage = dashboardData.totalProducts > 0 ? (count / dashboardData.totalProducts) * 100 : 0;

                return (
                  <div key={category} className={`flex items-center justify-between p-2 sm:p-2.5 rounded-lg sm:rounded-xl ${style.bg} hover:shadow-sm transition-all`}>
                    <div className="flex items-center flex-1 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full ${style.dot} mr-2.5 flex-shrink-0`}></div>
                      <span className={`text-sm font-medium ${style.text} capitalize truncate`}>{category}</span>
                    </div>
                    <div className="flex items-center ml-2 sm:ml-3">
                      <div className="w-14 sm:w-20 bg-white/60 dark:bg-gray-600/40 rounded-full h-1 sm:h-1.5 mr-2 sm:mr-3">
                        <div
                          className={`${style.bar} h-1 sm:h-1.5 rounded-full transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="text-right min-w-[50px] sm:min-w-[70px]">
                        <span className={`text-xs sm:text-sm font-bold ${style.text}`}>{count}</span>
                        <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">{formatCurrency(dashboardData.allCategoryValues[category] || 0)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          </div>
        </div>

        {/* ════ Widget: Department Ranking ═══════════════════════ */}
        <div key="department-ranking" className="group">
          <div className="h-full bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden p-4 sm:p-6 cursor-pointer hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-300"
            onClick={() => setSelectedDetail('departmentRanking')}
          >
            <DragHandle />
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-sm sm:text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center">
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-slate-700 shadow-lg mr-2 sm:mr-3">
                <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="hidden xs:inline">Solicitações por </span>Departamento
            </h3>
            <span className="text-xs font-medium px-2 sm:px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {chartData.departmentRankingData.length} <span className="hidden sm:inline">centro(s)</span>
            </span>
          </div>
          <div className="space-y-2 max-h-52 sm:max-h-64 overflow-y-auto pr-1">
            {chartData.departmentRankingData.length > 0 ? (
              chartData.departmentRankingData.slice(0, 8).map((dept, index) => {
                const maxTotal = chartData.departmentRankingData[0]?.total || 1;
                const percentage = (dept.total / maxTotal) * 100;
                const approvalRate = dept.total > 0 ? ((dept.approved / dept.total) * 100).toFixed(0) : '0';

                return (
                  <div key={dept.name} className="flex items-center justify-between p-2 sm:p-3 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">
                    <div className="flex items-center flex-1 min-w-0">
                      <span className="w-5 sm:w-6 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mr-2 sm:mr-3">{index + 1}.</span>
                      <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-white dark:bg-gray-800 shadow-sm mr-2 sm:mr-3 hidden xs:block">
                        <Building2 className="w-3 h-3 sm:w-4 sm:h-4 text-slate-600 dark:text-slate-300" />
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{dept.name}</span>
                    </div>
                    <div className="flex items-center ml-2 sm:ml-3 gap-2 sm:gap-3">
                      <div className="w-12 sm:w-20 bg-slate-200 dark:bg-slate-600 rounded-full h-1 sm:h-1.5 hidden xs:block">
                        <div
                          className="bg-slate-600 dark:bg-slate-400 h-1 sm:h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 min-w-[60px] sm:min-w-[90px] justify-end">
                        <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">{dept.total}</span>
                        <span className="text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">{approvalRate}%</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 sm:py-8 text-gray-400">
                <ClipboardList className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 opacity-50" />
                <p className="text-xs sm:text-sm">Nenhuma solicitação registrada</p>
              </div>
            )}
          </div>
          {chartData.departmentRankingData.length > 0 && (
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2 sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400">Total:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{requests.length}</span>
              </div>
              <span className="text-slate-500 dark:text-slate-400 text-xs hidden sm:inline">Clique para análise detalhada →</span>
            </div>
          )}
          </div>
        </div>

        {/* ════ Widget: Recent Movements ════════════════════════ */}
        <div key="recent-movements" className="group">
          <div className="h-full bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden p-4 sm:p-6 cursor-pointer hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-300"
            onClick={() => setSelectedDetail('recentMovements')}
          >
            <DragHandle />
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-blue-500 shadow-lg mr-2 sm:mr-3">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            Movimentações Recentes
          </h3>
          <span className="text-xs font-medium px-2 sm:px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300">
            {recentMovements.length} <span className="hidden xs:inline">itens</span>
          </span>
        </div>
        <div className="space-y-2 max-h-52 sm:max-h-64 overflow-y-auto pr-1">
          {recentMovements.length > 0 ? (
            recentMovements.map((movement) => (
              <div key={movement.id} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg sm:rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{movement.productName}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                    {movement.reason === 'sale' && 'Saída'}
                    {movement.reason === 'internal-consumption' && 'Consumo Int.'}
                    {movement.reason === 'internal-transfer' && 'Transferência'}
                    {movement.reason === 'return' && 'Devolução'}
                    {movement.reason === 'other' && 'Outros'}
                  </p>
                </div>
                <div className="text-right ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm font-bold text-red-600 dark:text-red-400">-{movement.quantity}</p>
                  <p className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-300">{formatCurrency(movement.totalValue || 0)}</p>
                  <p className="text-[10px] sm:text-xs text-gray-400">{movement.date}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-gray-400">
              <TrendingUp className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">Nenhuma movimentação recente</p>
            </div>
          )}
        </div>
          </div>
        </div>

        {/* ════ Widget: Top Value Products ══════════════════════ */}
        <div key="top-value" className="group">
          <div className="h-full bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden p-4 sm:p-6 cursor-pointer hover:shadow-lg hover:border-green-200 dark:hover:border-green-800 transition-all duration-300"
            onClick={() => setSelectedDetail('topValue')}
          >
            <DragHandle />
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-sm sm:text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center">
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-green-500 shadow-lg mr-2 sm:mr-3">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              Produtos de Maior Valor
            </h3>
            <span className="text-xs font-medium px-2 sm:px-3 py-1 rounded-full bg-green-50 dark:bg-green-900/50 text-green-600 dark:text-green-300">
              Top 5
            </span>
          </div>
          <div className="space-y-2 max-h-52 sm:max-h-64 overflow-y-auto pr-1">
            {dashboardData.topValueProducts.slice(0, 5).map((product, index) => (
              <div key={product.id} className="flex items-center justify-between p-2 sm:p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-lg sm:rounded-xl hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900/50 dark:hover:to-emerald-900/50 transition-colors">
                <div className="flex items-center flex-1 min-w-0">
                  <span className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500 text-white text-[10px] sm:text-xs font-bold mr-2 sm:mr-3 flex-shrink-0">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{product.name}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{product.code}</p>
                  </div>
                </div>
                <div className="text-right ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(product.totalValue || 0)}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{product.quantity} {product.unit}</p>
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>

        {/* ════ Widget: Low Stock Alert ═════════════════════════ */}
        {lowStockProducts.length > 0 && (
        <div key="low-stock" className="group">
          <div className="h-full bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden p-4 sm:p-6 cursor-pointer hover:shadow-lg hover:border-orange-200 dark:hover:border-orange-800 transition-all duration-300"
            onClick={() => setSelectedDetail('lowStock')}
          >
            <DragHandle />
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-sm sm:text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center">
                <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-orange-500 shadow-lg mr-2 sm:mr-3">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <span className="hidden xs:inline">Produtos com </span>Estoque Baixo
              </h3>
              <span className="text-xs font-medium px-2 sm:px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-900/50 text-orange-600 dark:text-orange-300">
                {lowStockProducts.length} <span className="hidden xs:inline">{lowStockProducts.length === 1 ? 'item' : 'itens'}</span>
              </span>
            </div>
            <div className="space-y-2 max-h-52 sm:max-h-64 overflow-y-auto pr-1">
              {lowStockProducts.slice(0, 10).map((product) => (
                <div key={product.id} className="flex items-center justify-between p-2 sm:p-3 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/30 rounded-lg sm:rounded-xl hover:from-orange-100 hover:to-amber-100 dark:hover:from-orange-900/50 dark:hover:to-amber-900/50 transition-colors">
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-orange-500 mr-2 sm:mr-3 animate-pulse flex-shrink-0"></div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{product.name}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{product.code}</p>
                    </div>
                  </div>
                  <div className="text-right ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-bold text-orange-600 dark:text-orange-400">{product.quantity} {product.unit}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Mín: {product.minStock}</p>
                    <p className="text-[10px] sm:text-xs text-gray-400">{formatCurrency(product.totalValue || 0)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* ════ Widget: Expiring Products ═══════════════════════ */}
        {expiringProducts.length > 0 && (
        <div key="expiring" className="group">
          <div className="h-full bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden p-4 sm:p-6 cursor-pointer hover:shadow-lg hover:border-red-200 dark:hover:border-red-800 transition-all duration-300"
            onClick={() => setSelectedDetail('expiring')}
          >
            <DragHandle />
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-sm sm:text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center">
                <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-red-500 shadow-lg mr-2 sm:mr-3">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <span className="hidden xs:inline">Produtos </span>Próximos ao Vencimento
              </h3>
              <span className="text-xs font-medium px-2 sm:px-3 py-1 rounded-full bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-300">
                {expiringProducts.length} <span className="hidden xs:inline">{expiringProducts.length === 1 ? 'item' : 'itens'}</span>
              </span>
            </div>
            <div className="space-y-2 max-h-52 sm:max-h-64 overflow-y-auto pr-1">
              {expiringProducts.map((product) => {
                const daysUntilExpiration = Math.ceil(
                  (new Date(product.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                );
                const isExpired = daysUntilExpiration < 0;
                const isCritical = daysUntilExpiration <= 7;
                
                return (
                  <div key={product.id} className={`flex items-center justify-between p-2 sm:p-3 rounded-lg sm:rounded-xl transition-colors ${
                    isExpired ? 'bg-gradient-to-r from-red-100 to-red-50 dark:from-red-900/40 dark:to-red-900/20' : 
                    isCritical ? 'bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/30 dark:to-orange-900/20' : 
                    'bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/30 dark:to-yellow-900/20'
                  } hover:shadow-sm`}>
                    <div className="flex items-center flex-1 min-w-0">
                      <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full mr-2 sm:mr-3 flex-shrink-0 ${isExpired || isCritical ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`}></div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{product.name}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{product.code}</p>
                      </div>
                    </div>
                    <div className="text-right ml-3 sm:ml-4">
                      <p className={`text-xs sm:text-sm font-bold ${isExpired ? 'text-red-700 dark:text-red-400' : isCritical ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
                        {isExpired ? `Vencido ${Math.abs(daysUntilExpiration)}d` : `${daysUntilExpiration}d`}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{product.quantity} {product.unit}</p>
                      <p className="text-[10px] sm:text-xs text-gray-400">{formatCurrency(product.totalValue || 0)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        )}

        {/* ════ Widget: Financial Summary ═══════════════════════ */}
        <div key="financial-summary" className="group">
          <div className="h-full bg-gradient-to-br from-blue-50/70 via-indigo-50/70 to-purple-50/70 dark:from-blue-900/30 dark:via-indigo-900/30 dark:to-purple-900/30 backdrop-blur-xl rounded-2xl border border-blue-200/80 dark:border-blue-900/50 shadow-sm overflow-hidden p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-all duration-300"
            onClick={() => setSelectedDetail('financialStats')}
          >
            <DragHandle />
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg mr-2 sm:mr-3">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            Resumo Financeiro<span className="hidden sm:inline"> do Mês</span>
          </h3>
        </div>
        <div className="grid grid-cols-1 xs:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 border border-blue-100 dark:border-blue-900/50 text-center hover:bg-white/80 dark:hover:bg-gray-800/80 transition-colors">
            <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-blue-500 shadow-lg mb-2 sm:mb-3">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Valor em Estoque</p>
            <p className="text-base sm:text-xl font-bold text-blue-600 dark:text-blue-400 mt-0.5 sm:mt-1">{formatCurrency(financialMetrics.currentMonth.inventoryValue)}</p>
            <div className="flex items-center justify-center mt-1.5 sm:mt-2 px-2 py-0.5 sm:py-1 rounded-full bg-gray-50 dark:bg-gray-700/50 w-fit mx-auto">
              {getTrendIcon(financialMetrics.trends.inventoryValueChangePercent)}
              <span className={`text-[10px] sm:text-xs font-medium ml-1 ${getTrendColor(financialMetrics.trends.inventoryValueChangePercent)}`}>
                {formatPercentage(financialMetrics.trends.inventoryValueChangePercent)}
              </span>
            </div>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 border border-purple-100 dark:border-purple-900/50 text-center hover:bg-white/80 dark:hover:bg-gray-800/80 transition-colors">
            <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-purple-500 shadow-lg mb-2 sm:mb-3">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Movimentações</p>
            <p className="text-base sm:text-xl font-bold text-purple-600 dark:text-purple-400 mt-0.5 sm:mt-1">{formatCurrency(financialMetrics.currentMonth.movementsValue)}</p>
            <div className="flex items-center justify-center mt-1.5 sm:mt-2 px-2 py-0.5 sm:py-1 rounded-full bg-gray-50 dark:bg-gray-700/50 w-fit mx-auto">
              {getTrendIcon(financialMetrics.trends.movementsValueChangePercent)}
              <span className={`text-[10px] sm:text-xs font-medium ml-1 ${getTrendColor(financialMetrics.trends.movementsValueChangePercent)}`}>
                {formatPercentage(financialMetrics.trends.movementsValueChangePercent)}
              </span>
            </div>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 border border-green-100 dark:border-green-900/50 text-center hover:bg-white/80 dark:hover:bg-gray-800/80 transition-colors">
            <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-green-500 shadow-lg mb-2 sm:mb-3">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nº Movimentações</p>
            <p className="text-base sm:text-xl font-bold text-green-600 dark:text-green-400 mt-0.5 sm:mt-1">{financialMetrics.currentMonth.movementsCount}</p>
            <div className="flex items-center justify-center mt-1.5 sm:mt-2 px-2 py-0.5 sm:py-1 rounded-full bg-gray-50 dark:bg-gray-700/50 w-fit mx-auto">
              {getTrendIcon(financialMetrics.trends.movementsCountChangePercent)}
              <span className={`text-[10px] sm:text-xs font-medium ml-1 ${getTrendColor(financialMetrics.trends.movementsCountChangePercent)}`}>
                {formatPercentage(financialMetrics.trends.movementsCountChangePercent)}
              </span>
            </div>
          </div>
        </div>
          </div>
        </div>

        {/* ════ Widget: Request Metrics ═════════════════════════ */}
        <div key="request-metrics" className="group">
          <div className="h-full bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden p-4 sm:p-6">
            <DragHandle />
        {/* Header com filtros de período */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <h2 className="text-sm sm:text-lg font-semibold text-gray-800 dark:text-gray-200">Métricas de Solicitações</h2>
          </div>
          
          {/* Filtros de período */}
          <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
            {([7, 15, 30] as const).map((days) => (
              <button
                key={days}
                onClick={() => setRequestsPeriod(days)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                  requestsPeriod === days
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600/50'
                }`}
              >
                {days}d
              </button>
            ))}
            <button
              onClick={() => setRequestsPeriod('custom')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                requestsPeriod === 'custom'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600/50'
              }`}
            >
              Custom
            </button>
          </div>
        </div>

        {/* Custom date inputs */}
        {requestsPeriod === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 dark:text-gray-400">De:</label>
              <input
                type="date"
                value={requestsCustomStart}
                onChange={(e) => setRequestsCustomStart(e.target.value)}
                className="px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 dark:text-gray-400">Até:</label>
              <input
                type="date"
                value={requestsCustomEnd}
                onChange={(e) => setRequestsCustomEnd(e.target.value)}
                className="px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* Card: Compras / Materiais */}
          {(() => {
            const { volume, avgDays, trend, pending, approved, rejected, sparkline, slaMeta } = requestMetrics.compras;
            const slaColor = avgDays === null ? 'text-gray-400' : avgDays <= slaMeta ? 'text-emerald-500' : avgDays <= slaMeta * 2 ? 'text-amber-500' : 'text-rose-500';
            const slaBg = avgDays === null ? 'bg-gray-100 dark:bg-gray-700' : avgDays <= slaMeta ? 'bg-emerald-50 dark:bg-emerald-900/30' : avgDays <= slaMeta * 2 ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-rose-50 dark:bg-rose-900/30';
            const slaStatus = avgDays === null ? 'N/A' : avgDays <= slaMeta ? 'Dentro da meta' : avgDays <= slaMeta * 2 ? 'Atenção' : 'Acima da meta';
            const TrendIcon = trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : Minus;
            const trendColor = trend > 0 ? 'text-emerald-500' : trend < 0 ? 'text-rose-500' : 'text-gray-400';
            return (
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-lg transition-shadow duration-300">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                    <ShoppingCart className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">Compras</span>
                </div>

                {/* Volume + Trend */}
                <div className="flex items-end gap-2 mb-1">
                  <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{volume}</p>
                  <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700/50 mb-1 ${trendColor}`}>
                    <TrendIcon className="w-3 h-3" />
                    <span className="text-xs font-medium">{Math.abs(trend).toFixed(0)}%</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">solicitações no período</p>

                {/* Status Breakdown */}
                <div className="flex items-center gap-3 text-xs mb-3">
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span> {pending} pend.
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> {approved} aprov.
                  </span>
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span> {rejected} rej.
                  </span>
                </div>

                {/* Mini Sparkline */}
                <div className="h-10 mb-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={sparkline}>
                      <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} dot={false} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>

                {/* SLA with meta */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${slaBg}`}>
                  <div className="flex items-center gap-2">
                    <Clock className={`w-4 h-4 ${slaColor}`} />
                    <span className={`text-sm font-medium ${slaColor}`}>
                      {avgDays !== null ? `${avgDays.toFixed(1)}d` : '—'}
                    </span>
                  </div>
                  <span className={`text-xs font-medium ${slaColor}`}>
                    {slaStatus} (meta: {slaMeta}d)
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Card: Manutenção */}
          {(() => {
            const { volume, avgDays, trend, pending, approved, rejected, sparkline, slaMeta } = requestMetrics.manutencao;
            const slaColor = avgDays === null ? 'text-gray-400' : avgDays <= slaMeta ? 'text-emerald-500' : avgDays <= slaMeta * 2 ? 'text-amber-500' : 'text-rose-500';
            const slaBg = avgDays === null ? 'bg-gray-100 dark:bg-gray-700' : avgDays <= slaMeta ? 'bg-emerald-50 dark:bg-emerald-900/30' : avgDays <= slaMeta * 2 ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-rose-50 dark:bg-rose-900/30';
            const slaStatus = avgDays === null ? 'N/A' : avgDays <= slaMeta ? 'Dentro da meta' : avgDays <= slaMeta * 2 ? 'Atenção' : 'Acima da meta';
            const TrendIcon = trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : Minus;
            const trendColor = trend > 0 ? 'text-emerald-500' : trend < 0 ? 'text-rose-500' : 'text-gray-400';
            return (
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-lg transition-shadow duration-300">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25">
                    <Wrench className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">Manutenção</span>
                </div>

                {/* Volume + Trend */}
                <div className="flex items-end gap-2 mb-1">
                  <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{volume}</p>
                  <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700/50 mb-1 ${trendColor}`}>
                    <TrendIcon className="w-3 h-3" />
                    <span className="text-xs font-medium">{Math.abs(trend).toFixed(0)}%</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">solicitações no período</p>

                {/* Status Breakdown */}
                <div className="flex items-center gap-3 text-xs mb-3">
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span> {pending} pend.
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> {approved} aprov.
                  </span>
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span> {rejected} rej.
                  </span>
                </div>

                {/* Mini Sparkline */}
                <div className="h-10 mb-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={sparkline}>
                      <Line type="monotone" dataKey="count" stroke="#F59E0B" strokeWidth={2} dot={false} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>

                {/* SLA with meta */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${slaBg}`}>
                  <div className="flex items-center gap-2">
                    <Clock className={`w-4 h-4 ${slaColor}`} />
                    <span className={`text-sm font-medium ${slaColor}`}>
                      {avgDays !== null ? `${avgDays.toFixed(1)}d` : '—'}
                    </span>
                  </div>
                  <span className={`text-xs font-medium ${slaColor}`}>
                    {slaStatus} (meta: {slaMeta}d)
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Card: Pagamentos */}
          {(() => {
            const { volume, avgDays, trend, pending, approved, rejected, sparkline, slaMeta } = requestMetrics.pagamentos;
            const slaColor = avgDays === null ? 'text-gray-400' : avgDays <= slaMeta ? 'text-emerald-500' : avgDays <= slaMeta * 2 ? 'text-amber-500' : 'text-rose-500';
            const slaBg = avgDays === null ? 'bg-gray-100 dark:bg-gray-700' : avgDays <= slaMeta ? 'bg-emerald-50 dark:bg-emerald-900/30' : avgDays <= slaMeta * 2 ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-rose-50 dark:bg-rose-900/30';
            const slaStatus = avgDays === null ? 'N/A' : avgDays <= slaMeta ? 'Dentro da meta' : avgDays <= slaMeta * 2 ? 'Atenção' : 'Acima da meta';
            const TrendIcon = trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : Minus;
            const trendColor = trend > 0 ? 'text-emerald-500' : trend < 0 ? 'text-rose-500' : 'text-gray-400';
            return (
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-lg transition-shadow duration-300">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">Pagamentos</span>
                </div>

                {/* Volume + Trend */}
                <div className="flex items-end gap-2 mb-1">
                  <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{volume}</p>
                  <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700/50 mb-1 ${trendColor}`}>
                    <TrendIcon className="w-3 h-3" />
                    <span className="text-xs font-medium">{Math.abs(trend).toFixed(0)}%</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">solicitações no período</p>

                {/* Status Breakdown */}
                <div className="flex items-center gap-3 text-xs mb-3">
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span> {pending} pend.
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> {approved} aprov.
                  </span>
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span> {rejected} rej.
                  </span>
                </div>

                {/* Mini Sparkline */}
                <div className="h-10 mb-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={sparkline}>
                      <Line type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} dot={false} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>

                {/* SLA with meta */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${slaBg}`}>
                  <div className="flex items-center gap-2">
                    <Clock className={`w-4 h-4 ${slaColor}`} />
                    <span className={`text-sm font-medium ${slaColor}`}>
                      {avgDays !== null ? `${avgDays.toFixed(1)}d` : '—'}
                    </span>
                  </div>
                  <span className={`text-xs font-medium ${slaColor}`}>
                    {slaStatus} (meta: {slaMeta}d)
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
          </div>
        </div>

      </ResponsiveGridLayout>
      </div>

      {/* Detail Modal */}
      {selectedDetail && (
        <DetailModal
          title={getModalTitle(selectedDetail)}
          onClose={() => setSelectedDetail(null)}
          icon={
            selectedDetail === 'lowStock' ? <AlertTriangle className="w-5 h-5 text-white" /> :
            selectedDetail === 'expiring' ? <Calendar className="w-5 h-5 text-white" /> :
            selectedDetail === 'recentMovements' ? <TrendingUp className="w-5 h-5 text-white" /> :
            selectedDetail === 'topValue' ? <DollarSign className="w-5 h-5 text-white" /> :
            selectedDetail === 'financialStats' ? <BarChart3 className="w-5 h-5 text-white" /> :
            selectedDetail === 'categories' ? <Package className="w-5 h-5 text-white" /> :
            <Package className="w-5 h-5 text-white" />
          }
          accentColor={
            selectedDetail === 'lowStock' ? 'orange' :
            selectedDetail === 'expiring' ? 'red' :
            selectedDetail === 'recentMovements' ? 'blue' :
            selectedDetail === 'topValue' ? 'green' :
            selectedDetail === 'financialStats' ? 'purple' :
            selectedDetail === 'categories' ? 'purple' :
            'blue'
          }
        >
          {renderModalContent(selectedDetail, dashboardData, financialMetrics, products, movements, formatCurrency)}
        </DetailModal>
      )}
    </>
  );
};

export default Dashboard;