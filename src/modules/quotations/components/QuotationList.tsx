import React from 'react';
import {
  FileText,
  Building2,
  Calendar,
  DollarSign,
  Clock,
  ChevronRight,
  Filter,
  SortAsc,
  SortDesc,
  Search,
  AlertCircle,
} from 'lucide-react';
import {
  Quotation,
  QuotationStatus,
  QuotationStatusLabels,
  QuotationStatusColors,
  QuotationFilters,
  QuotationSort,
  QuotationSortField,
} from '../types';

interface QuotationListProps {
  quotations: Quotation[];
  filters: QuotationFilters;
  sort: QuotationSort;
  onFiltersChange: (filters: QuotationFilters) => void;
  onSortChange: (sort: QuotationSort) => void;
  onSelect: (quotation: Quotation) => void;
  loading?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: value >= 100000 ? 'compact' : 'standard',
  }).format(value);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
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

export const QuotationList: React.FC<QuotationListProps> = ({
  quotations,
  filters,
  sort,
  onFiltersChange,
  onSortChange,
  onSelect,
  loading,
}) => {
  const handleStatusFilter = (status: QuotationStatus | 'all') => {
    if (status === 'all') {
      onFiltersChange({ ...filters, status: undefined });
    } else {
      onFiltersChange({ ...filters, status: [status] });
    }
  };

  const handleSortField = (field: QuotationSortField) => {
    if (sort.field === field) {
      onSortChange({ ...sort, order: sort.order === 'asc' ? 'desc' : 'asc' });
    } else {
      onSortChange({ field, order: 'desc' });
    }
  };

  const activeStatusFilter = filters.status?.[0] || 'all';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filters.search || ''}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
              placeholder="Buscar cotações..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter - Mobile Dropdown */}
          <div className="sm:hidden">
            <select
              value={activeStatusFilter}
              onChange={(e) => handleStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {STATUS_FILTER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 hidden sm:inline">Ordenar:</span>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleSortField(opt.value)}
                  className={`px-2 sm:px-3 py-1.5 text-xs font-medium flex items-center gap-1 ${
                    sort.field === opt.value
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
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

        {/* Status Filter - Desktop Pills */}
        <div className="hidden sm:flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
          {STATUS_FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleStatusFilter(opt.value)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                activeStatusFilter === opt.value
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : quotations.length === 0 ? (
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 p-8 sm:p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma cotação encontrada</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            {filters.search || filters.status
              ? 'Tente ajustar os filtros para ver mais resultados.'
              : 'Crie uma nova cotação para começar.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {quotations.map(quotation => (
            <button
              key={quotation.id}
              onClick={() => onSelect(quotation)}
              className="w-full bg-white rounded-xl sm:rounded-2xl border border-gray-200 p-4 sm:p-5 hover:border-blue-300 hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-start gap-3 sm:gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-gray-400">{quotation.code}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${QuotationStatusColors[quotation.status]}`}>
                          {QuotationStatusLabels[quotation.status]}
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                        {quotation.title}
                      </h3>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </div>

                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs sm:text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" />
                      {formatCurrency(quotation.finalTotalAmount || quotation.estimatedTotalAmount)}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {quotation.items.length} item(ns)
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      {quotation.invitedSuppliers.length} fornec.
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {getRelativeTime(quotation.createdAt)}
                    </span>
                  </div>

                  {/* Progress indicators for active quotations */}
                  {['sent_to_suppliers', 'waiting_responses'].includes(quotation.status) && quotation.invitedSuppliers.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-500">Respostas recebidas</span>
                        <span className="font-medium text-gray-700">
                          {quotation.proposals.length}/{quotation.invitedSuppliers.length}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${(quotation.proposals.length / quotation.invitedSuppliers.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Approval pending indicator */}
                  {quotation.status === 'awaiting_approval' && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-amber-600">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Aguardando aprovação</span>
                    </div>
                  )}

                  {/* Priority indicator for urgent */}
                  {quotation.priority === 'urgent' && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span className="font-medium">Urgente</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuotationList;
