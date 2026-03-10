import React, { useState, useEffect } from 'react';
import {
  Plus,
  RefreshCcw,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
  Timer,
  TrendingDown,
  Users,
  Search,
  Building2,
  Calendar,
  ChevronRight,
  SortAsc,
  SortDesc,
  Filter,
  BarChart3,
} from 'lucide-react';
import { useQuotation } from '../hooks/useQuotation';
import { 
  Quotation, 
  QuotationStatus,
  QuotationStatusLabels, 
  QuotationStatusColors,
  QuotationSortField
} from '../types';
import { QuotationDrawer } from './QuotationDrawer';
import { CreateQuotationModal } from './CreateQuotationModal';

// Helper functions
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: value >= 100000 ? 'compact' : 'standard',
  }).format(value);
};

const getRelativeTime = (date: string) => {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays} dias`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} sem`;
  return `${Math.floor(diffDays / 30)} mês`;
};

const formatHours = (hours: number) => {
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const STATUS_FILTER_OPTIONS: { value: QuotationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'sent_to_suppliers', label: 'Enviadas' },
  { value: 'waiting_responses', label: 'Aguardando' },
  { value: 'under_review', label: 'Em Análise' },
  { value: 'awaiting_approval', label: 'Aprovação' },
  { value: 'approved', label: 'Aprovadas' },
  { value: 'rejected', label: 'Rejeitadas' },
];

const SORT_OPTIONS: { value: QuotationSortField; label: string }[] = [
  { value: 'createdAt', label: 'Data' },
  { value: 'estimatedTotalAmount', label: 'Valor' },
  { value: 'priority', label: 'Prioridade' },
  { value: 'status', label: 'Status' },
];

export const QuotationManagementPage: React.FC = () => {
  const {
    quotations,
    filteredQuotations,
    suppliers,
    loading,
    metrics,
    getPermissions,
    refresh,
    createQuotation,
    sendToSuppliers,
    submitProposal,
    selectWinner,
    submitForApproval,
    approveQuotation,
    rejectQuotation,
    cancelQuotation,
    convertToPurchase,
    setFilters,
    setSort,
    filters,
    sort,
  } = useQuotation();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<Set<QuotationStatus>>(new Set());

  const permissions = getPermissions();

  useEffect(() => {
    refresh();
  }, []);

  const handleSelectQuotation = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setShowDrawer(true);
  };

  const handleCloseDrawer = () => {
    setShowDrawer(false);
    setTimeout(() => setSelectedQuotation(null), 300);
  };

  const handleCreateQuotation = async (data: any) => {
    try {
      const newQuotation = await createQuotation(data);
      if (newQuotation) {
        setShowCreateModal(false);
        await refresh();
      }
    } catch (error) {
      console.error('Error creating quotation:', error);
    }
  };

  const handleRefreshAfterAction = async () => {
    await refresh();
    if (selectedQuotation) {
      const updated = quotations.find(q => q.id === selectedQuotation.id);
      if (updated) {
        setSelectedQuotation(updated);
      }
    }
  };

  // Filter handlers
  const toggleStatusCardFilter = (status: QuotationStatus) => {
    const newSet = new Set(selectedStatusFilters);
    if (newSet.has(status)) {
      newSet.delete(status);
    } else {
      newSet.add(status);
    }
    setSelectedStatusFilters(newSet);
    
    if (newSet.size === 0) {
      setFilters({ ...filters, status: undefined });
    } else {
      setFilters({ ...filters, status: Array.from(newSet) });
    }
  };

  const clearStatusCardFilters = () => {
    setSelectedStatusFilters(new Set());
    setFilters({ ...filters, status: undefined });
  };

  const handleSortField = (field: QuotationSortField) => {
    if (sort.field === field) {
      setSort({ ...sort, order: sort.order === 'asc' ? 'desc' : 'asc' });
    } else {
      setSort({ field, order: 'desc' });
    }
  };

  const activeStatusFilter = filters.status?.[0] || 'all';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mr-4 shadow-lg shadow-blue-500/25">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Gestão de Cotações</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Crie, gerencie e acompanhe cotações de fornecedores</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors shadow-sm"
            title="Atualizar"
          >
            <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {permissions.canCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-semibold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Nova Cotação</span>
              <span className="sm:hidden">Nova</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Filters - Interactive Cards */}
      <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Filtrar por Status</span>
          {selectedStatusFilters.size > 0 && (
            <button
              onClick={() => setSelectedStatusFilters(new Set())}
              className="ml-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Ativas (Draft) */}
          <button
            onClick={() => toggleStatusCardFilter('draft')}
            className={`group bg-white dark:bg-gray-800 rounded-xl p-4 border-2 shadow-sm hover:shadow-md transition-all duration-200 text-left cursor-pointer ${
              selectedStatusFilters.has('draft') 
                ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                selectedStatusFilters.has('draft') ? 'bg-blue-500' : 'bg-blue-100 dark:bg-blue-900/50 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50'
              }`}>
                <FileText className={`w-5 h-5 ${selectedStatusFilters.has('draft') ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{metrics.totalActive}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Ativas</p>
              </div>
              {selectedStatusFilters.has('draft') && (
                <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
              )}
            </div>
          </button>

          {/* Aguardando Aprovação */}
          <button
            onClick={() => toggleStatusCardFilter('awaiting_approval')}
            className={`group bg-white dark:bg-gray-800 rounded-xl p-4 border-2 shadow-sm hover:shadow-md transition-all duration-200 text-left cursor-pointer ${
              selectedStatusFilters.has('awaiting_approval') 
                ? 'border-orange-500 ring-2 ring-orange-500/20 bg-orange-50 dark:bg-orange-900/20' 
                : 'border-gray-200 dark:border-gray-600 hover:border-orange-400 dark:hover:border-orange-500'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                selectedStatusFilters.has('awaiting_approval') ? 'bg-orange-500' : 'bg-orange-100 dark:bg-orange-900/50 group-hover:bg-orange-200 dark:group-hover:bg-orange-800/50'
              }`}>
                <Clock className={`w-5 h-5 ${selectedStatusFilters.has('awaiting_approval') ? 'text-white' : 'text-orange-600 dark:text-orange-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{metrics.totalAwaitingApproval}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Aguardando</p>
              </div>
              {selectedStatusFilters.has('awaiting_approval') && (
                <CheckCircle2 className="w-5 h-5 text-orange-500 flex-shrink-0" />
              )}
            </div>
          </button>

          {/* Aprovadas */}
          <button
            onClick={() => toggleStatusCardFilter('approved')}
            className={`group bg-white dark:bg-gray-800 rounded-xl p-4 border-2 shadow-sm hover:shadow-md transition-all duration-200 text-left cursor-pointer ${
              selectedStatusFilters.has('approved') 
                ? 'border-green-500 ring-2 ring-green-500/20 bg-green-50 dark:bg-green-900/20' 
                : 'border-gray-200 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-500'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                selectedStatusFilters.has('approved') ? 'bg-green-500' : 'bg-green-100 dark:bg-green-900/50 group-hover:bg-green-200 dark:group-hover:bg-green-800/50'
              }`}>
                <CheckCircle2 className={`w-5 h-5 ${selectedStatusFilters.has('approved') ? 'text-white' : 'text-green-600 dark:text-green-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{metrics.totalApproved}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Aprovadas</p>
              </div>
              {selectedStatusFilters.has('approved') && (
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              )}
            </div>
          </button>

          {/* Rejeitadas */}
          <button
            onClick={() => toggleStatusCardFilter('rejected')}
            className={`group bg-white dark:bg-gray-800 rounded-xl p-4 border-2 shadow-sm hover:shadow-md transition-all duration-200 text-left cursor-pointer ${
              selectedStatusFilters.has('rejected') 
                ? 'border-red-500 ring-2 ring-red-500/20 bg-red-50 dark:bg-red-900/20' 
                : 'border-gray-200 dark:border-gray-600 hover:border-red-400 dark:hover:border-red-500'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                selectedStatusFilters.has('rejected') ? 'bg-red-500' : 'bg-red-100 dark:bg-red-900/50 group-hover:bg-red-200 dark:group-hover:bg-red-800/50'
              }`}>
                <XCircle className={`w-5 h-5 ${selectedStatusFilters.has('rejected') ? 'text-white' : 'text-red-600 dark:text-red-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{metrics.totalRejected}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Rejeitadas</p>
              </div>
              {selectedStatusFilters.has('rejected') && (
                <CheckCircle2 className="w-5 h-5 text-red-500 flex-shrink-0" />
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Indicators - Non-Interactive Stats */}
      <div className="animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Indicadores</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Valor em Análise */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-xl p-4 border border-indigo-100 dark:border-indigo-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/50">
                <DollarSign className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 font-medium">Valor em Análise</p>
                <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{formatCurrency(metrics.totalValueUnderAnalysis)}</p>
              </div>
            </div>
          </div>

          {/* Tempo Médio */}
          <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-950/30 dark:to-fuchsia-950/30 rounded-xl p-4 border border-purple-100 dark:border-purple-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-100 dark:bg-purple-900/50">
                <Timer className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-purple-600/70 dark:text-purple-400/70 font-medium">Tempo Médio</p>
                <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{formatHours(metrics.averageResponseTime)}</p>
              </div>
            </div>
          </div>

          {/* Economia Média */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-xl p-4 border border-emerald-100 dark:border-emerald-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/50">
                <TrendingDown className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 font-medium">Economia Média</p>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{metrics.averageSavingsPercentage}%</p>
              </div>
            </div>
          </div>

          {/* Propostas Recebidas */}
          <div className="bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950/30 dark:to-sky-950/30 rounded-xl p-4 border border-cyan-100 dark:border-cyan-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-cyan-100 dark:bg-cyan-900/50">
                <Users className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-cyan-600/70 dark:text-cyan-400/70 font-medium">Propostas</p>
                <p className="text-lg font-bold text-cyan-700 dark:text-cyan-300">{metrics.proposalsReceived}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Filters Indicator */}
      {selectedStatusFilters.size > 0 && (
        <div className="flex items-center gap-2 animate-fade-in">
          <span className="text-sm text-gray-500 dark:text-gray-400">Filtros ativos:</span>
          {Array.from(selectedStatusFilters).map(status => (
            <span 
              key={status}
              className={`px-2.5 py-1 text-xs font-medium rounded-full ${QuotationStatusColors[status]}`}
            >
              {QuotationStatusLabels[status]}
            </span>
          ))}
          <button
            onClick={clearStatusCardFilters}
            className="ml-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filters.search || ''}
              onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
              placeholder="Buscar cotações..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50/50 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
            />
          </div>

          {/* Mobile Status Filter */}
          <div className="sm:hidden">
            <select
              value={activeStatusFilter}
              onChange={(e) => {
                const value = e.target.value as QuotationStatus | 'all';
                if (value === 'all') {
                  setFilters({ ...filters, status: undefined });
                } else {
                  setFilters({ ...filters, status: [value] });
                }
              }}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-gray-50/50 dark:bg-gray-700 dark:text-gray-100"
            >
              {STATUS_FILTER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">Ordenar:</span>
            <div className="flex rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleSortField(opt.value)}
                  className={`px-3 py-2 text-xs font-medium flex items-center gap-1 transition-colors ${
                    sort.field === opt.value
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  {opt.label}
                  {sort.field === opt.value && (
                    sort.order === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Desktop Status Pills */}
        <div className="hidden sm:flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          {STATUS_FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                if (opt.value === 'all') {
                  setFilters({ ...filters, status: undefined });
                } else {
                  setFilters({ ...filters, status: [opt.value] });
                }
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                activeStatusFilter === opt.value
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quotations List */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredQuotations.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center animate-fade-in-up">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Nenhuma cotação encontrada</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {filters.search || filters.status
                ? 'Tente ajustar os filtros para ver mais resultados.'
                : 'Crie uma nova cotação para começar.'}
            </p>
          </div>
        ) : (
          filteredQuotations.map((quotation, index) => (
            <button
              key={quotation.id}
              onClick={() => handleSelectQuotation(quotation)}
              className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 hover:shadow-xl hover:border-blue-200 dark:hover:border-blue-700 transition-all duration-300 animate-fade-in-up group hover:-translate-y-0.5 text-left"
              style={{ animationDelay: `${Math.min(index * 0.05, 0.25)}s` }}
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                {/* Left side - Icon and Title */}
                <div className="flex items-center">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-500 shadow-blue-500/25 rounded-xl flex items-center justify-center mr-3 shadow-md group-hover:scale-105 transition-transform duration-300 flex-shrink-0">
                    <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{quotation.code}</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      {quotation.title}
                    </h3>
                  </div>
                </div>
                
                {/* Right side - Tags */}
                <div className="flex flex-wrap sm:flex-nowrap items-start gap-2 sm:gap-3 sm:ml-4">
                  {/* Priority */}
                  {quotation.priority === 'urgent' && (
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-1">Prioridade</span>
                      <span className="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold rounded-full whitespace-nowrap bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-700">
                        Urgente
                      </span>
                    </div>
                  )}
                  {/* Status */}
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-1">Status</span>
                    <span className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold rounded-full whitespace-nowrap ${QuotationStatusColors[quotation.status]}`}>
                      {QuotationStatusLabels[quotation.status]}
                    </span>
                  </div>
                  {/* Arrow */}
                  <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all flex-shrink-0 hidden sm:block self-center mt-3" />
                </div>
              </div>

              {/* Value Highlight */}
              <div className="mb-4">
                <div className="flex items-center p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl border border-blue-100 dark:border-blue-800">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mr-3 sm:mr-4 shadow-md shadow-blue-500/25 flex-shrink-0">
                    <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Valor Estimado</p>
                    <p className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(quotation.finalTotalAmount || quotation.estimatedTotalAmount)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
                <div className="flex items-center p-2.5 sm:p-3 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-purple-500 to-violet-500 rounded-lg flex items-center justify-center mr-2 sm:mr-3 shadow-sm shadow-purple-500/25 flex-shrink-0">
                    <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">Itens</p>
                    <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100">{quotation.items.length}</p>
                  </div>
                </div>

                <div className="flex items-center p-2.5 sm:p-3 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-lg flex items-center justify-center mr-2 sm:mr-3 shadow-sm shadow-teal-500/25 flex-shrink-0">
                    <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">Fornecedores</p>
                    <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100">{quotation.invitedSuppliers.length}</p>
                  </div>
                </div>

                <div className="flex items-center p-2.5 sm:p-3 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center mr-2 sm:mr-3 shadow-sm shadow-amber-500/25 flex-shrink-0">
                    <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">Propostas</p>
                    <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100">{quotation.proposals.length}</p>
                  </div>
                </div>

                <div className="flex items-center p-2.5 sm:p-3 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-rose-500 to-pink-500 rounded-lg flex items-center justify-center mr-2 sm:mr-3 shadow-sm shadow-rose-500/25 flex-shrink-0">
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">Criada</p>
                    <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100">{getRelativeTime(quotation.createdAt)}</p>
                  </div>
                </div>
              </div>

              {/* Progress for waiting responses */}
              {['sent_to_suppliers', 'waiting_responses'].includes(quotation.status) && quotation.invitedSuppliers.length > 0 && (
                <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-gray-500 dark:text-gray-400">Respostas recebidas</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {quotation.proposals.length}/{quotation.invitedSuppliers.length}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
                      style={{ width: `${(quotation.proposals.length / quotation.invitedSuppliers.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Approval pending indicator */}
              {quotation.status === 'awaiting_approval' && (
                <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Aguardando aprovação</span>
                </div>
              )}
            </button>
          ))
        )}
      </div>

      {/* Stats Footer */}
      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        Exibindo {filteredQuotations.length} de {quotations.length} cotações
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateQuotationModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateQuotation}
          suppliers={suppliers}
        />
      )}

      {/* Detail Drawer */}
      {selectedQuotation && (
        <QuotationDrawer
          isOpen={showDrawer}
          quotation={selectedQuotation}
          permissions={permissions}
          onClose={handleCloseDrawer}
          onSendToSuppliers={async () => {
            await sendToSuppliers(selectedQuotation.id);
            await handleRefreshAfterAction();
          }}
          onSelectWinner={async (proposalId) => {
            await selectWinner(selectedQuotation.id, proposalId);
            await handleRefreshAfterAction();
          }}
          onSubmitForApproval={async () => {
            await submitForApproval(selectedQuotation.id);
            await handleRefreshAfterAction();
          }}
          onApprove={async (comment) => {
            await approveQuotation(selectedQuotation.id, comment);
            await handleRefreshAfterAction();
          }}
          onReject={async (comment) => {
            await rejectQuotation(selectedQuotation.id, comment);
            await handleRefreshAfterAction();
          }}
          onCancel={async (reason) => {
            await cancelQuotation(selectedQuotation.id, reason);
            await handleRefreshAfterAction();
          }}
          onConvertToPurchase={async () => {
            await convertToPurchase(selectedQuotation.id);
            await handleRefreshAfterAction();
          }}
          onSubmitProposal={async (quotationId, data) => {
            await submitProposal({ ...data, quotationId });
            await handleRefreshAfterAction();
          }}
        />
      )}
    </div>
  );
};

export default QuotationManagementPage;
