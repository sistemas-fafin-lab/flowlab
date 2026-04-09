// src/components/Home.tsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../utils/permissions';
import { supabase } from '../lib/supabase';
import {
  LayoutDashboard,
  Package,
  Plus,
  History,
  FileText,
  AlertTriangle,
  Clock,
  Users,
  Building2,
  DollarSign,
  ArrowRight,
  ShoppingCart,
  Wrench,
  TrendingUp,
  CheckCircle2,
  ClipboardList,
  AlertCircle,
  Sparkles,
  CalendarDays,
  Receipt,
  ChevronRight,
  Settings2,
  X,
  Eye,
  EyeOff,
  RotateCcw,
  LucideIcon,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

type WidgetSize = 'small' | 'medium' | 'large' | 'hero';

interface WidgetConfig {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  size: WidgetSize;
  requiredPermission: string | null; // null = always visible
  category: 'action' | 'stats' | 'alert' | 'shortcut';
}

interface QuickStats {
  pendingRequests: number;
  approvedRequests: number;
  lowStockCount: number;
  expiringCount: number;
  myPendingRequests: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

const getFormattedDate = (): string => {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
};

const getLocalStorageKey = (userId: string) => `flowLab_home_prefs_${userId}`;

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGETS CATALOG (WIDGETS_CONFIG)
// ═══════════════════════════════════════════════════════════════════════════════

const WIDGETS_CONFIG: WidgetConfig[] = [
  // ─── Hero / Large Actions ────────────────────────────────────────────────────
  {
    id: 'hero-new-request',
    title: 'Nova Solicitação',
    description: 'Crie solicitações de compra ou serviço',
    icon: ShoppingCart,
    size: 'hero',
    requiredPermission: 'canViewRequests',
    category: 'action',
  },
  {
    id: 'dashboard-main',
    title: 'Dashboard',
    description: 'Visão completa do sistema',
    icon: LayoutDashboard,
    size: 'large',
    requiredPermission: 'canViewDashboard',
    category: 'action',
  },
  {
    id: 'add-product',
    title: 'Adicionar Produto',
    description: 'Cadastrar novo item no estoque',
    icon: Plus,
    size: 'large',
    requiredPermission: 'canAddProducts',
    category: 'action',
  },

  // ─── Medium Actions ──────────────────────────────────────────────────────────
  {
    id: 'pending-approvals',
    title: 'Aprovações Pendentes',
    description: 'Revisar e aprovar solicitações',
    icon: ClipboardList,
    size: 'medium',
    requiredPermission: 'canApproveRequests',
    category: 'action',
  },
  {
    id: 'my-requests',
    title: 'Minhas Solicitações',
    description: 'Acompanhe suas solicitações',
    icon: FileText,
    size: 'medium',
    requiredPermission: null, // Always visible for logged users
    category: 'stats',
  },

  // ─── Stats Widgets ───────────────────────────────────────────────────────────
  {
    id: 'stats-pending',
    title: 'Pendentes',
    description: 'Solicitações aguardando',
    icon: Clock,
    size: 'small',
    requiredPermission: null,
    category: 'stats',
  },
  {
    id: 'stats-approved',
    title: 'Aprovadas (30d)',
    description: 'Últimos 30 dias',
    icon: CheckCircle2,
    size: 'small',
    requiredPermission: null,
    category: 'stats',
  },

  // ─── Alerts ──────────────────────────────────────────────────────────────────
  {
    id: 'alert-low-stock',
    title: 'Estoque Baixo',
    description: 'Produtos precisando reposição',
    icon: AlertTriangle,
    size: 'medium',
    requiredPermission: 'canViewProducts',
    category: 'alert',
  },
  {
    id: 'alert-expiring',
    title: 'Vencimentos',
    description: 'Produtos próximos do vencimento',
    icon: AlertCircle,
    size: 'medium',
    requiredPermission: 'canViewExpiration',
    category: 'alert',
  },

  // ─── Shortcuts ───────────────────────────────────────────────────────────────
  {
    id: 'shortcut-products',
    title: 'Produtos',
    description: 'Visualizar estoque',
    icon: Package,
    size: 'small',
    requiredPermission: 'canViewProducts',
    category: 'shortcut',
  },
  {
    id: 'shortcut-movements',
    title: 'Movimentações',
    description: 'Registrar entrada/saída',
    icon: History,
    size: 'small',
    requiredPermission: 'canViewMovements',
    category: 'shortcut',
  },
  {
    id: 'shortcut-suppliers',
    title: 'Fornecedores',
    description: 'Gerenciar parceiros',
    icon: Building2,
    size: 'small',
    requiredPermission: 'canManageSuppliers',
    category: 'shortcut',
  },
  {
    id: 'shortcut-quotations',
    title: 'Cotações',
    description: 'Comparar preços',
    icon: DollarSign,
    size: 'small',
    requiredPermission: 'canManageQuotations',
    category: 'shortcut',
  },
  {
    id: 'shortcut-users',
    title: 'Usuários',
    description: 'Gerenciar acessos',
    icon: Users,
    size: 'small',
    requiredPermission: 'canManageUsers',
    category: 'shortcut',
  },
  {
    id: 'shortcut-payments',
    title: 'Pagamentos',
    description: 'Solicitar pagamento ou reembolso',
    icon: Receipt,
    size: 'small',
    requiredPermission: 'canViewRequests',
    category: 'shortcut',
  },
  {
    id: 'shortcut-maintenance',
    title: 'Manutenção',
    description: 'Solicitar reparo',
    icon: Wrench,
    size: 'small',
    requiredPermission: 'canViewRequests',
    category: 'shortcut',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SIZE TO GRID CLASS MAPPING (Layout only - no styling here)
// ═══════════════════════════════════════════════════════════════════════════════

const SIZE_CLASSES: Record<WidgetSize, string> = {
  small: 'col-span-1',
  medium: 'col-span-1 md:col-span-2',
  large: 'col-span-1 md:col-span-2 lg:col-span-2 row-span-2',
  hero: 'col-span-1 md:col-span-2 lg:col-span-4',
};

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface WidgetProps {
  stats: QuickStats;
  loading: boolean;
}

// Hero: Nova Solicitação
const HeroNewRequestWidget: React.FC<WidgetProps> = () => (
  <div className="relative overflow-hidden w-full h-full rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-6 md:p-8 shadow-2xl shadow-blue-500/20 min-h-[220px] transition-all duration-300 hover:-translate-y-1 hover:shadow-blue-500/30">
    {/* Decorative pattern */}
    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
    {/* Glow effects */}
    <div className="absolute -right-20 -top-20 w-60 h-60 bg-white/10 rounded-full blur-3xl pointer-events-none" />
    <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
    
    <div className="relative z-10 h-full flex flex-col gap-4">
      {/* Tag */}
      <div className="flex items-center gap-2 text-blue-200 text-sm font-medium">
        <Sparkles className="w-4 h-4" />
        <span>Ação Rápida</span>
      </div>
      
      {/* Content */}
      <div className="flex-1 flex flex-col justify-center gap-2">
        <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">Precisa de algo?</h2>
        <p className="text-blue-100 text-sm md:text-base max-w-md leading-relaxed">
          Crie uma nova solicitação em poucos cliques.
        </p>
      </div>
      
      {/* Actions */}
      <div className="flex flex-wrap gap-3 mt-auto">
        <Link
          to="/requests"
          className="group inline-flex items-center gap-2 px-5 py-3 bg-white text-blue-700 font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200"
        >
          <ShoppingCart className="w-4 h-4" />
          Nova Solicitação
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link
          to="/requests/maintenance"
          className="group inline-flex items-center gap-2 px-4 py-3 bg-white/20 backdrop-blur-sm text-white font-semibold rounded-xl border border-white/30 hover:bg-white/30 transition-all duration-200"
        >
          <Wrench className="w-4 h-4" />
          Manutenção
        </Link>
      </div>
    </div>
  </div>
);

// Large: Dashboard Principal
const DashboardWidget: React.FC<WidgetProps> = () => (
  <Link
    to="/dashboard"
    className="group relative overflow-hidden w-full h-full rounded-3xl bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 p-6 shadow-xl shadow-slate-800/20 border border-slate-700/50 min-h-[200px] flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-800/30"
  >
    {/* Gradient overlay */}
    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 pointer-events-none" />
    {/* Glow */}
    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
    
    <div className="relative z-10 h-full flex flex-col gap-4">
      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
        <LayoutDashboard className="w-7 h-7 text-white" />
      </div>
      
      {/* Content */}
      <div className="mt-auto flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-white">Dashboard</h3>
        <p className="text-sm text-slate-400">Visão completa do sistema</p>
      </div>
      
      {/* Arrow indicator */}
      <ArrowRight className="absolute bottom-6 right-6 w-6 h-6 text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all" />
    </div>
  </Link>
);

// Large: Adicionar Produto
const AddProductWidget: React.FC<WidgetProps> = () => (
  <Link
    to="/add-product"
    className="group relative overflow-hidden w-full h-full rounded-3xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 p-6 shadow-xl shadow-blue-500/20 border border-blue-400/30 min-h-[200px] flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/30"
  >
    {/* Glow */}
    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
    
    <div className="relative z-10 h-full flex flex-col gap-4">
      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
        <Plus className="w-7 h-7 text-white" />
      </div>
      
      {/* Content */}
      <div className="mt-auto flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-white">Adicionar Produto</h3>
        <p className="text-sm text-blue-100">Cadastrar novo item no estoque</p>
      </div>
      
      {/* Arrow indicator */}
      <ArrowRight className="absolute bottom-6 right-6 w-6 h-6 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all" />
    </div>
  </Link>
);

// Medium: Aprovações Pendentes
const PendingApprovalsWidget: React.FC<WidgetProps> = ({ stats }) => (
  <Link
    to="/requests"
    className="group relative w-full h-full rounded-3xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-6 border border-gray-100 dark:border-gray-700 shadow-xl min-h-[160px] flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-amber-300 dark:hover:border-amber-600"
  >
    <div className="h-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
          <ClipboardList className="w-6 h-6 text-white" />
        </div>
        {stats.pendingRequests > 0 && (
          <span className="px-2.5 py-1 text-xs font-bold bg-amber-500 text-white rounded-full">
            {stats.pendingRequests}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="mt-auto flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
          Aprovações
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {stats.pendingRequests > 0 ? `${stats.pendingRequests} pendente${stats.pendingRequests > 1 ? 's' : ''}` : 'Revisar solicitações'}
        </p>
      </div>
    </div>

    {/* Arrow indicator */}
    <ChevronRight className="absolute bottom-6 right-6 w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
  </Link>
);

// Medium: Minhas Solicitações
const MyRequestsWidget: React.FC<WidgetProps> = ({ stats, loading }) => (
  <Link
    to="/requests"
    className="group relative w-full h-full rounded-3xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-6 border border-gray-100 dark:border-gray-700 shadow-xl min-h-[160px] flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-blue-300 dark:hover:border-blue-600"
  >
    <div className="h-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
          <FileText className="w-6 h-6 text-white" />
        </div>
        {stats.myPendingRequests > 0 && (
          <span className="px-2.5 py-1 text-xs font-bold bg-blue-500 text-white rounded-full">
            {stats.myPendingRequests}
          </span>
        )}
      </div>
      
      {/* Content */}
      <div className="mt-auto flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          Minhas Solicitações
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {loading ? '...' : `${stats.myPendingRequests} em andamento`}
        </p>
      </div>
    </div>
    
    {/* Arrow indicator */}
    <ChevronRight className="absolute bottom-6 right-6 w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
  </Link>
);

// Small: Stats Pendentes
const StatsPendingWidget: React.FC<WidgetProps> = ({ stats, loading }) => (
  <div className="w-full h-full rounded-3xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-6 border border-gray-100 dark:border-gray-700 shadow-xl flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
    {/* Header */}
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
        <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
      </div>
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Pendentes</span>
    </div>
    
    {/* Value */}
    <div className="flex items-end justify-between mt-auto">
      <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
        {loading ? '...' : stats.pendingRequests}
      </span>
      <Link to="/requests" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
        Ver →
      </Link>
    </div>
  </div>
);

// Small: Stats Aprovadas
const StatsApprovedWidget: React.FC<WidgetProps> = ({ stats, loading }) => (
  <div className="w-full h-full rounded-3xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-6 border border-gray-100 dark:border-gray-700 shadow-xl flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
    {/* Header */}
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
      </div>
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Aprovadas</span>
    </div>
    
    {/* Value */}
    <div className="flex items-end justify-between mt-auto">
      <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
        {loading ? '...' : stats.approvedRequests}
      </span>
      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
        <TrendingUp className="w-3 h-3" /> 30d
      </span>
    </div>
  </div>
);

// Medium: Alerta Estoque Baixo
const LowStockAlertWidget: React.FC<WidgetProps> = ({ stats }) => (
  <Link
    to="/products?filter=low-stock"
    className="group w-full h-full rounded-3xl bg-gradient-to-r from-red-50/90 to-orange-50/90 dark:from-red-900/30 dark:to-orange-900/30 backdrop-blur-sm p-6 border border-red-100 dark:border-red-900/50 shadow-xl min-h-[160px] flex items-center gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-red-300 dark:hover:border-red-700"
  >
    {/* Icon */}
    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/25 flex-shrink-0">
      <AlertTriangle className="w-7 h-7 text-white" />
    </div>
    
    {/* Content */}
    <div className="flex-1 min-w-0 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">Estoque Baixo</h3>
        {stats.lowStockCount > 0 && (
          <span className="px-2.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full animate-pulse">
            {stats.lowStockCount}
          </span>
        )}
      </div>
      <p className="text-sm text-red-600/70 dark:text-red-300/70 truncate">
        {stats.lowStockCount > 0 
          ? `${stats.lowStockCount} produto${stats.lowStockCount > 1 ? 's' : ''} precisam de reposição`
          : 'Nenhum alerta no momento'}
      </p>
    </div>
    
    {/* Arrow */}
    <ChevronRight className="w-5 h-5 text-red-300 group-hover:text-red-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
  </Link>
);

// Medium: Alerta Vencimentos
const ExpiringAlertWidget: React.FC<WidgetProps> = ({ stats }) => (
  <Link
    to="/expiration"
    className="group w-full h-full rounded-3xl bg-gradient-to-r from-amber-50/90 to-yellow-50/90 dark:from-amber-900/30 dark:to-yellow-900/30 backdrop-blur-sm p-6 border border-amber-100 dark:border-amber-900/50 shadow-xl min-h-[160px] flex items-center gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-amber-300 dark:hover:border-amber-700"
  >
    {/* Icon */}
    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/25 flex-shrink-0">
      <AlertCircle className="w-7 h-7 text-white" />
    </div>
    
    {/* Content */}
    <div className="flex-1 min-w-0 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-400">Vencimentos</h3>
        {stats.expiringCount > 0 && (
          <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-500 text-white rounded-full">
            {stats.expiringCount}
          </span>
        )}
      </div>
      <p className="text-sm text-amber-600/70 dark:text-amber-300/70 truncate">
        {stats.expiringCount > 0 
          ? `${stats.expiringCount} produto${stats.expiringCount > 1 ? 's' : ''} vencem em 30 dias`
          : 'Nenhum vencimento próximo'}
      </p>
    </div>
    
    {/* Arrow */}
    <ChevronRight className="w-5 h-5 text-amber-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
  </Link>
);

// Generic Small Shortcut Widget
interface ShortcutWidgetProps extends WidgetProps {
  config: WidgetConfig;
  to: string;
  gradient: string;
  shadowColor: string;
}

const ShortcutWidget: React.FC<ShortcutWidgetProps> = ({ config, to, gradient, shadowColor }) => {
  const Icon = config.icon;
  return (
    <Link
      to={to}
      className="group w-full h-full rounded-3xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-6 border border-gray-100 dark:border-gray-700 shadow-xl min-h-[140px] flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-blue-300 dark:hover:border-blue-600"
    >
      {/* Icon */}
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg ${shadowColor}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      
      {/* Content */}
      <div className="mt-auto flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {config.title}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{config.description}</p>
      </div>
    </Link>
  );
};

// Shortcut routes and styles mapping
const SHORTCUT_CONFIG: Record<string, { to: string; gradient: string; shadowColor: string }> = {
  'shortcut-products': { to: '/products', gradient: 'from-indigo-500 to-purple-500', shadowColor: 'shadow-indigo-500/25' },
  'shortcut-movements': { to: '/movements', gradient: 'from-cyan-500 to-blue-500', shadowColor: 'shadow-cyan-500/25' },
  'shortcut-suppliers': { to: '/suppliers', gradient: 'from-blue-500 to-cyan-500', shadowColor: 'shadow-blue-500/25' },
  'shortcut-quotations': { to: '/quotations', gradient: 'from-emerald-500 to-teal-500', shadowColor: 'shadow-emerald-500/25' },
  'shortcut-users': { to: '/users', gradient: 'from-purple-500 to-pink-500', shadowColor: 'shadow-purple-500/25' },
  'shortcut-payments': { to: '/requests/payments', gradient: 'from-emerald-500 to-teal-500', shadowColor: 'shadow-emerald-500/25' },
  'shortcut-maintenance': { to: '/requests/maintenance', gradient: 'from-orange-500 to-amber-500', shadowColor: 'shadow-orange-500/25' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET RENDERER - Maps config ID to component
// ═══════════════════════════════════════════════════════════════════════════════

const renderWidget = (config: WidgetConfig, stats: QuickStats, loading: boolean): React.ReactNode => {
  const props: WidgetProps = { stats, loading };

  switch (config.id) {
    case 'hero-new-request':
      return <HeroNewRequestWidget {...props} />;
    case 'dashboard-main':
      return <DashboardWidget {...props} />;
    case 'add-product':
      return <AddProductWidget {...props} />;
    case 'pending-approvals':
      return <PendingApprovalsWidget {...props} />;
    case 'my-requests':
      return <MyRequestsWidget {...props} />;
    case 'stats-pending':
      return <StatsPendingWidget {...props} />;
    case 'stats-approved':
      return <StatsApprovedWidget {...props} />;
    case 'alert-low-stock':
      return <LowStockAlertWidget {...props} />;
    case 'alert-expiring':
      return <ExpiringAlertWidget {...props} />;
    default:
      // Handle shortcuts
      if (config.id.startsWith('shortcut-')) {
        const shortcutConfig = SHORTCUT_CONFIG[config.id];
        if (shortcutConfig) {
          return <ShortcutWidget config={config} {...shortcutConfig} {...props} />;
        }
      }
      return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMIZE MODAL
// ═══════════════════════════════════════════════════════════════════════════════

interface CustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableWidgets: WidgetConfig[];
  hiddenWidgets: string[];
  onToggleWidget: (widgetId: string) => void;
  onReset: () => void;
}

const CustomizeModal: React.FC<CustomizeModalProps> = ({
  isOpen,
  onClose,
  availableWidgets,
  hiddenWidgets,
  onToggleWidget,
  onReset,
}) => {
  // Fechar com Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = {
    action: 'Ações Principais',
    stats: 'Estatísticas',
    alert: 'Alertas',
    shortcut: 'Atalhos Rápidos',
  };

  const groupedWidgets = availableWidgets.reduce((acc, widget) => {
    if (!acc[widget.category]) acc[widget.category] = [];
    acc[widget.category].push(widget);
    return acc;
  }, {} as Record<string, WidgetConfig[]>);

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — altura controlada via flex no próprio elemento */}
      <div className="relative z-10 w-full max-w-lg flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-2xl" style={{ maxHeight: 'min(85vh, 640px)' }}>

        {/* Header */}
        <div className="flex-none flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
              <Settings2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-gray-100">Personalizar Home</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Escolha quais widgets exibir</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content — ocupa o espaço restante e scrolla */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {Object.entries(categories).map(([key, label]) => {
            const widgets = groupedWidgets[key];
            if (!widgets?.length) return null;

            return (
              <div key={key}>
                <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                  {label}
                </h3>
                <div className="space-y-2">
                  {widgets.map((widget) => {
                    const Icon = widget.icon;
                    const isHidden = hiddenWidgets.includes(widget.id);

                    return (
                      <button
                        key={widget.id}
                        onClick={() => onToggleWidget(widget.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                          isHidden
                            ? 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 opacity-60'
                            : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          isHidden ? 'bg-gray-200 dark:bg-gray-700' : 'bg-blue-100 dark:bg-blue-900/30'
                        }`}>
                          <Icon className={`w-4 h-4 ${
                            isHidden ? 'text-gray-400' : 'text-blue-600 dark:text-blue-400'
                          }`} />
                        </div>
                        <div className="flex-1 text-left">
                          <p className={`font-medium text-sm ${
                            isHidden ? 'text-gray-400' : 'text-gray-900 dark:text-gray-100'
                          }`}>
                            {widget.title}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{widget.description}</p>
                        </div>
                        {isHidden ? (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-emerald-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex-none flex items-center justify-between p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Restaurar Padrão
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:scale-[1.02] transition-all duration-200"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const Home: React.FC = () => {
  const { userProfile } = useAuth();
  const userPermissions = userProfile?.permissions || [];
  const userId = userProfile?.id || '';

  // Stats state
  const [stats, setStats] = useState<QuickStats>({
    pendingRequests: 0,
    approvedRequests: 0,
    lowStockCount: 0,
    expiringCount: 0,
    myPendingRequests: 0,
  });
  const [loading, setLoading] = useState(true);

  // Customization state
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  // Load user preferences from localStorage
  useEffect(() => {
    if (!userId) return;
    const stored = localStorage.getItem(getLocalStorageKey(userId));
    if (stored) {
      try {
        setHiddenWidgets(JSON.parse(stored));
      } catch {
        setHiddenWidgets([]);
      }
    }
  }, [userId]);

  // Save preferences to localStorage
  const savePreferences = useCallback((hidden: string[]) => {
    if (!userId) return;
    localStorage.setItem(getLocalStorageKey(userId), JSON.stringify(hidden));
  }, [userId]);

  // Toggle widget visibility
  const handleToggleWidget = useCallback((widgetId: string) => {
    setHiddenWidgets((prev) => {
      const next = prev.includes(widgetId)
        ? prev.filter((id) => id !== widgetId)
        : [...prev, widgetId];
      savePreferences(next);
      return next;
    });
  }, [savePreferences]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    setHiddenWidgets([]);
    if (userId) {
      localStorage.removeItem(getLocalStorageKey(userId));
    }
  }, [userId]);

  // Filter widgets by permission
  const availableWidgets = useMemo(() => {
    return WIDGETS_CONFIG.filter((widget) => {
      if (widget.requiredPermission === null) return true;
      return hasPermission(userPermissions, widget.requiredPermission);
    });
  }, [userPermissions]);

  // Final visible widgets (permission + not hidden)
  const visibleWidgets = useMemo(() => {
    return availableWidgets.filter((widget) => !hiddenWidgets.includes(widget.id));
  }, [availableWidgets, hiddenWidgets]);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Pending requests (global)
        const { count: pending } = await supabase
          .from('requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending');

        // Approved requests (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { count: approved } = await supabase
          .from('requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'approved')
          .gte('created_at', thirtyDaysAgo.toISOString());

        // Low stock products
        const { count: lowStock } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'low-stock');

        // Expiring products (next 30 days)
        const inThirtyDays = new Date();
        inThirtyDays.setDate(inThirtyDays.getDate() + 30);

        const { count: expiring } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .lte('expiration_date', inThirtyDays.toISOString())
          .gt('expiration_date', new Date().toISOString());

        // My pending requests (for current user's department)
        let myPending = 0;
        if (userProfile?.department) {
          const { count } = await supabase
            .from('requests')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending')
            .eq('department', userProfile.department);
          myPending = count || 0;
        }

        setStats({
          pendingRequests: pending || 0,
          approvedRequests: approved || 0,
          lowStockCount: lowStock || 0,
          expiringCount: expiring || 0,
          myPendingRequests: myPending,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userProfile?.department]);

  return (
    <div className="min-h-[calc(100vh-120px)] w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in-down">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-sm">
              <CalendarDays className="w-4 h-4" />
              <span className="capitalize">{getFormattedDate()}</span>
            </div>
            
            {/* Customize Button */}
            <button
              onClick={() => setIsCustomizeOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm transition-all duration-200"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Personalizar
            </button>
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-gray-800 via-blue-800 to-indigo-800 dark:from-gray-100 dark:via-blue-300 dark:to-indigo-300 bg-clip-text text-transparent leading-tight">
            {getGreeting()}, {userProfile?.name?.split(' ')[0]}!
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-base">
            Seu painel personalizado
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in-up">
          {visibleWidgets.map((widget) => (
            <div
              key={widget.id}
              className={SIZE_CLASSES[widget.size]}
            >
              {renderWidget(widget, stats, loading)}
            </div>
          ))}
        </div>

        {/* Empty State */}
        {visibleWidgets.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-white dark:bg-gray-800 shadow-xl border border-gray-100 dark:border-gray-700 flex items-center justify-center">
              <EyeOff className="w-10 h-10 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Nenhum widget visível
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
              Você ocultou todos os widgets disponíveis. Restaure para ver seu painel novamente.
            </p>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:scale-[1.02] transition-all duration-200"
            >
              <RotateCcw className="w-4 h-4" />
              Restaurar Padrão
            </button>
          </div>
        )}
      </div>

      {/* Customize Modal */}
      <CustomizeModal
        isOpen={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
        availableWidgets={availableWidgets}
        hiddenWidgets={hiddenWidgets}
        onToggleWidget={handleToggleWidget}
        onReset={handleReset}
      />
    </div>
  );
};

export default Home;
