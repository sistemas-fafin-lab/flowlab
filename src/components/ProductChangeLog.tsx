import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, 
  User, 
  Calendar, 
  Clock, 
  FileText, 
  Filter, 
  Search,
  X,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  Archive
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { ProductChangeLog } from '../types';

const ITEMS_PER_PAGE = 25;

const ProductChangeLogComponent: React.FC = () => {
  const { changeLogs } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  
  // Card filter states
  const [selectedPeriodFilters, setSelectedPeriodFilters] = useState<Set<string>>(new Set());
  const [selectedUserFilters, setSelectedUserFilters] = useState<Set<string>>(new Set());

  // Period labels and colors
  const periodLabels: Record<string, string> = {
    'today': 'Hoje',
    'week': 'Esta Semana',
    'month': 'Este Mês',
    'older': 'Anteriores'
  };

  const periodColors: Record<string, { bg: string; bgActive: string; text: string; textActive: string; border: string; borderActive: string }> = {
    'today': {
      bg: 'bg-green-100 dark:bg-green-900/50',
      bgActive: 'bg-green-500',
      text: 'text-green-600 dark:text-green-400',
      textActive: 'text-white',
      border: 'border-gray-100 dark:border-gray-700 hover:border-green-200 dark:hover:border-green-700',
      borderActive: 'border-green-400 ring-2 ring-green-400/30 bg-green-50 dark:bg-green-900/20'
    },
    'week': {
      bg: 'bg-blue-100 dark:bg-blue-900/50',
      bgActive: 'bg-blue-500',
      text: 'text-blue-600 dark:text-blue-400',
      textActive: 'text-white',
      border: 'border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700',
      borderActive: 'border-blue-400 ring-2 ring-blue-400/30 bg-blue-50 dark:bg-blue-900/20'
    },
    'month': {
      bg: 'bg-purple-100 dark:bg-purple-900/50',
      bgActive: 'bg-purple-500',
      text: 'text-purple-600 dark:text-purple-400',
      textActive: 'text-white',
      border: 'border-gray-100 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-700',
      borderActive: 'border-purple-400 ring-2 ring-purple-400/30 bg-purple-50 dark:bg-purple-900/20'
    },
    'older': {
      bg: 'bg-gray-200 dark:bg-gray-600',
      bgActive: 'bg-gray-500',
      text: 'text-gray-600 dark:text-gray-300',
      textActive: 'text-white',
      border: 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
      borderActive: 'border-gray-400 ring-2 ring-gray-400/30 bg-gray-100 dark:bg-gray-700'
    }
  };

  // Helper function to get period for a date
  const getPeriodForDate = (dateStr: string): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const logDate = new Date(dateStr);
    logDate.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - logDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays <= 7) return 'week';
    if (diffDays <= 30) return 'month';
    return 'older';
  };

  // Get unique users from change logs
  const uniqueUsers = useMemo(() => {
    const users = new Map<string, number>();
    changeLogs.forEach(log => {
      users.set(log.changedBy, (users.get(log.changedBy) || 0) + 1);
    });
    // Sort by count descending and take top 4
    return Array.from(users.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name]) => name);
  }, [changeLogs]);

  // Count logs by period
  const getCountByPeriod = (period: string): number => {
    return changeLogs.filter(log => getPeriodForDate(log.changeDate) === period).length;
  };

  // Count logs by user
  const getCountByUser = (user: string): number => {
    return changeLogs.filter(log => log.changedBy === user).length;
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    return changeLogs.filter(log => {
      // Period filter
      const matchesPeriod = selectedPeriodFilters.size === 0 || 
        selectedPeriodFilters.has(getPeriodForDate(log.changeDate));
      
      // User filter
      const matchesUser = selectedUserFilters.size === 0 || 
        selectedUserFilters.has(log.changedBy);
      
      // Date filter
      const matchesDate = !dateFilter || log.changeDate === dateFilter;
      
      // Search filter
      const matchesSearch = !searchTerm || 
        log.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.changedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.changeReason.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesPeriod && matchesUser && matchesDate && matchesSearch;
    });
  }, [changeLogs, selectedPeriodFilters, selectedUserFilters, dateFilter, searchTerm]);

  // Pagination
  const displayedLogs = filteredLogs.slice(0, displayCount);
  const hasMoreItems = filteredLogs.length > displayCount;
  const remainingItems = filteredLogs.length - displayCount;
  const nextBatchSize = Math.min(ITEMS_PER_PAGE, remainingItems);

  const handleShowMore = () => {
    setDisplayCount(prev => prev + ITEMS_PER_PAGE);
  };

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
  }, [selectedPeriodFilters, selectedUserFilters, dateFilter, searchTerm]);

  // Toggle period filter
  const togglePeriodFilter = (period: string) => {
    setSelectedPeriodFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(period)) {
        newSet.delete(period);
      } else {
        newSet.add(period);
      }
      return newSet;
    });
  };

  // Toggle user filter
  const toggleUserFilter = (user: string) => {
    setSelectedUserFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(user)) {
        newSet.delete(user);
      } else {
        newSet.add(user);
      }
      return newSet;
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setDateFilter('');
    setSelectedPeriodFilters(new Set());
    setSelectedUserFilters(new Set());
  };

  // Check if any filter is active
  const hasActiveFilters = selectedPeriodFilters.size > 0 || selectedUserFilters.size > 0 || dateFilter || searchTerm;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">Histórico de Alterações</h2>
        <p className="text-gray-500 dark:text-gray-400">Registro de todas as modificações realizadas nos produtos</p>
      </div>

      {/* Period Filter Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        {/* Hoje */}
        <button
          onClick={() => togglePeriodFilter('today')}
          className={`bg-white dark:bg-gray-800 rounded-xl p-3 md:p-4 border shadow-sm hover:shadow-md transition-all duration-200 text-left ${
            selectedPeriodFilters.has('today') 
              ? periodColors['today'].borderActive 
              : periodColors['today'].border
          }`}
        >
          <div className="flex items-center gap-2 md:gap-3">
            <div className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center ${
              selectedPeriodFilters.has('today') 
                ? periodColors['today'].bgActive 
                : periodColors['today'].bg
            }`}>
              <CalendarDays className={`w-4 h-4 md:w-5 md:h-5 ${
                selectedPeriodFilters.has('today') 
                  ? periodColors['today'].textActive 
                  : periodColors['today'].text
              }`} />
            </div>
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">
                {getCountByPeriod('today')}
              </p>
              <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium truncate">Hoje</p>
            </div>
          </div>
        </button>

        {/* Esta Semana */}
        <button
          onClick={() => togglePeriodFilter('week')}
          className={`bg-white dark:bg-gray-800 rounded-xl p-3 md:p-4 border shadow-sm hover:shadow-md transition-all duration-200 text-left ${
            selectedPeriodFilters.has('week') 
              ? periodColors['week'].borderActive 
              : periodColors['week'].border
          }`}
        >
          <div className="flex items-center gap-2 md:gap-3">
            <div className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center ${
              selectedPeriodFilters.has('week') 
                ? periodColors['week'].bgActive 
                : periodColors['week'].bg
            }`}>
              <CalendarRange className={`w-4 h-4 md:w-5 md:h-5 ${
                selectedPeriodFilters.has('week') 
                  ? periodColors['week'].textActive 
                  : periodColors['week'].text
              }`} />
            </div>
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">
                {getCountByPeriod('week')}
              </p>
              <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium truncate">Esta Semana</p>
            </div>
          </div>
        </button>

        {/* Este Mês */}
        <button
          onClick={() => togglePeriodFilter('month')}
          className={`bg-white dark:bg-gray-800 rounded-xl p-3 md:p-4 border shadow-sm hover:shadow-md transition-all duration-200 text-left ${
            selectedPeriodFilters.has('month') 
              ? periodColors['month'].borderActive 
              : periodColors['month'].border
          }`}
        >
          <div className="flex items-center gap-2 md:gap-3">
            <div className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center ${
              selectedPeriodFilters.has('month') 
                ? periodColors['month'].bgActive 
                : periodColors['month'].bg
            }`}>
              <CalendarClock className={`w-4 h-4 md:w-5 md:h-5 ${
                selectedPeriodFilters.has('month') 
                  ? periodColors['month'].textActive 
                  : periodColors['month'].text
              }`} />
            </div>
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">
                {getCountByPeriod('month')}
              </p>
              <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium truncate">Este Mês</p>
            </div>
          </div>
        </button>

        {/* Anteriores */}
        <button
          onClick={() => togglePeriodFilter('older')}
          className={`bg-white dark:bg-gray-800 rounded-xl p-3 md:p-4 border shadow-sm hover:shadow-md transition-all duration-200 text-left ${
            selectedPeriodFilters.has('older') 
              ? periodColors['older'].borderActive 
              : periodColors['older'].border
          }`}
        >
          <div className="flex items-center gap-2 md:gap-3">
            <div className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center ${
              selectedPeriodFilters.has('older') 
                ? periodColors['older'].bgActive 
                : periodColors['older'].bg
            }`}>
              <Archive className={`w-4 h-4 md:w-5 md:h-5 ${
                selectedPeriodFilters.has('older') 
                  ? periodColors['older'].textActive 
                  : periodColors['older'].text
              }`} />
            </div>
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">
                {getCountByPeriod('older')}
              </p>
              <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium truncate">Anteriores</p>
            </div>
          </div>
        </button>
      </div>

      {/* User Filter Cards - Only show if there are users */}
      {uniqueUsers.length > 0 && (
        <div className="animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Filtrar por Usuário:</p>
          <div className="flex flex-wrap gap-2">
            {uniqueUsers.map(user => (
              <button
                key={user}
                onClick={() => toggleUserFilter(user)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  selectedUserFilters.has(user)
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600'
                }`}
              >
                <User className="w-4 h-4" />
                <span className="truncate max-w-[120px]">{user}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-xs ${
                  selectedUserFilters.has(user)
                    ? 'bg-blue-400/50'
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  {getCountByUser(user)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Filters Indicator */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 animate-fade-in">
          <span className="text-sm text-gray-500 dark:text-gray-400">Filtros ativos:</span>
          {Array.from(selectedPeriodFilters).map(period => (
            <span 
              key={period}
              className={`px-2.5 py-1 text-xs font-medium rounded-full ${periodColors[period]?.bg} ${periodColors[period]?.text}`}
            >
              {periodLabels[period]}
            </span>
          ))}
          {Array.from(selectedUserFilters).map(user => (
            <span 
              key={user}
              className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"
            >
              {user}
            </span>
          ))}
          {dateFilter && (
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400">
              Data: {dateFilter}
            </span>
          )}
          {searchTerm && (
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">
              Busca: "{searchTerm}"
            </span>
          )}
          <button
            onClick={clearFilters}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            title="Limpar filtros"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      )}

      {/* Search and Date Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 md:p-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Produto, usuário ou motivo..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Data Específica</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg">
            <Filter className="w-4 h-4 mr-2" />
            <span className="font-medium text-gray-700 dark:text-gray-300">{filteredLogs.length}</span>&nbsp;resultado(s)
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 font-medium text-sm"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Change Logs */}
      <div className="space-y-4">
        {displayedLogs.map((log, index) => (
          <div 
            key={log.id} 
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-lg hover:border-blue-100 dark:hover:border-blue-800 transition-all duration-300 animate-fade-in-up"
            style={{ animationDelay: `${Math.min(index * 0.05, 0.25)}s` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mr-3 shadow-md shadow-blue-500/25">
                  <History className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{log.productName}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Alteração registrada</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <Calendar className="w-4 h-4 mr-1" />
                  {log.changeDate}
                </div>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="w-4 h-4 mr-1" />
                  {log.changeTime}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="flex items-center p-3 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 rounded-xl">
                <User className="w-4 h-4 text-blue-500 mr-2" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Alterado por</p>
                  <p className="font-medium text-gray-800 dark:text-gray-100">{log.changedBy}</p>
                </div>
              </div>

              <div className="flex items-center p-3 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 rounded-xl">
                <FileText className="w-4 h-4 text-blue-500 mr-2" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Motivo</p>
                  <p className="font-medium text-gray-800 dark:text-gray-100">{log.changeReason}</p>
                </div>
              </div>
            </div>

            {/* Field Changes */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Campos Alterados:</h4>
              <div className="space-y-2">
                {log.fieldChanges.map((change, index) => (
                  <div key={index} className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 rounded-xl p-3 border border-gray-100 dark:border-gray-600">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{change.field}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Valor Anterior</p>
                        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-1.5 rounded-lg">
                          {change.oldValue}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Novo Valor</p>
                        <p className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-3 py-1.5 rounded-lg">
                          {change.newValue}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Show More Button and Footer */}
      {hasMoreItems && (
        <div className="flex flex-col items-center gap-2 animate-fade-in">
          <button
            onClick={handleShowMore}
            className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 font-medium text-sm"
          >
            Exibir mais {nextBatchSize}
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Exibindo {displayCount} de {filteredLogs.length} • {remainingItems} restante(s)
          </span>
        </div>
      )}

      {/* Footer info when all items are displayed */}
      {!hasMoreItems && displayedLogs.length > 0 && filteredLogs.length > ITEMS_PER_PAGE && (
        <div className="text-center">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Exibindo {displayedLogs.length} de {filteredLogs.length} registro(s)
          </span>
        </div>
      )}

      {displayedLogs.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center border border-gray-100 dark:border-gray-700">
          <History className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Nenhum registro encontrado</h3>
          <p className="text-gray-500 dark:text-gray-400">
            {changeLogs.length === 0 
              ? 'Ainda não há registros de alterações de produtos.'
              : 'Nenhum registro corresponde aos filtros aplicados.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default ProductChangeLogComponent;