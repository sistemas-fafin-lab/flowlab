import React, { useEffect, useState } from 'react';
import {
  FileText,
  DollarSign,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Calendar,
  RefreshCw,
  Building2,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Filter
} from 'lucide-react';
import { useBilling } from '../../../hooks/useBilling';
import { Nota, NotaStatus, BillingMetrics } from '../../billing/types';

// ============================================================================
// COMPONENTE: FaturasDashboard
// Painel principal do módulo de faturamento
// ============================================================================

const FaturasDashboard: React.FC = () => {
  const {
    loading,
    error,
    notas,
    operadoras,
    metrics,
    fetchNotas,
    fetchOperadoras,
    fetchMetrics,
    fetchSyncLogs,
    formatCurrency,
    clearError
  } = useBilling();

  const [filtroStatus, setFiltroStatus] = useState<NotaStatus | 'todas'>('todas');
  const [filtroOperadora, setFiltroOperadora] = useState<string>('todas');
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Carregar dados iniciais
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchOperadoras(),
        fetchNotas(),
        fetchMetrics()
      ]);
      
      // Buscar última sincronização
      const logs = await fetchSyncLogs(1);
      if (logs.length > 0) {
        setLastSync(new Date(logs[0].started_at).toLocaleString('pt-BR'));
      }
    };
    loadData();
  }, [fetchNotas, fetchOperadoras, fetchMetrics, fetchSyncLogs]);

  // Aplicar filtros
  useEffect(() => {
    const filters: { status?: NotaStatus; operadora_id?: string } = {};
    if (filtroStatus !== 'todas') filters.status = filtroStatus;
    if (filtroOperadora !== 'todas') filters.operadora_id = filtroOperadora;
    fetchNotas(filters);
  }, [filtroStatus, filtroOperadora, fetchNotas]);

  // Status badge helper
  const getStatusBadge = (status: NotaStatus) => {
    const styles: Record<NotaStatus, { bg: string; text: string; icon: React.ReactNode }> = {
      aberta: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', icon: <Clock size={14} /> },
      parcialmente_recebida: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', icon: <TrendingUp size={14} /> },
      recebida: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', icon: <CheckCircle size={14} /> },
      glosada: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', icon: <XCircle size={14} /> },
      cancelada: { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-300', icon: <XCircle size={14} /> }
    };
    const { bg, text, icon } = styles[status];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
        {icon}
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="h-7 w-7 text-blue-600" />
            Gestão de Faturamento
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Espelho financeiro sincronizado com APLIS
          </p>
        </div>
        
        {lastSync && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <RefreshCw size={14} />
            <span>Última sync: {lastSync}</span>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <button onClick={clearError} className="ml-auto text-red-600 hover:text-red-800">×</button>
          </div>
        </div>
      )}

      {/* Métricas Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total a Receber */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total a Receber</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatCurrency(metrics.valorTotalAReceber)}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="mt-3 flex items-center text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                {metrics.totalNotasAbertas} notas abertas
              </span>
            </div>
          </div>

          {/* Recebido no Mês */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Recebido este Mês</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {formatCurrency(metrics.valorRecebidoMes)}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="mt-3 flex items-center text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                {metrics.notasPorStatus.recebidas} notas recebidas
              </span>
            </div>
          </div>

          {/* Glosado */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Glosado</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                  {formatCurrency(metrics.valorGlosadoMes)}
                </p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div className="mt-3 flex items-center text-sm">
              <span className="text-red-500 dark:text-red-400">
                Taxa: {metrics.taxaGlosa.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Glosas Pendentes */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Glosas Pendentes</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                  {metrics.glosasPendentes + metrics.glosasEmRecurso}
                </p>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <AlertCircle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <div className="mt-3 flex items-center text-sm">
              <span className="text-orange-500 dark:text-orange-400">
                {metrics.glosasEmRecurso} em recurso
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Previsão de Recebimento */}
      {metrics && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Previsão de Recebimento
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Próximos 30 dias</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                {formatCurrency(metrics.previsaoRecebimento.proximo30dias)}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">30 a 60 dias</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                {formatCurrency(metrics.previsaoRecebimento.proximo60dias)}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">60 a 90 dias</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                {formatCurrency(metrics.previsaoRecebimento.proximo90dias)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtros:</span>
          </div>
          
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as NotaStatus | 'todas')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="todas">Todos os Status</option>
            <option value="aberta">Aberta</option>
            <option value="parcialmente_recebida">Parcialmente Recebida</option>
            <option value="recebida">Recebida</option>
            <option value="glosada">Glosada</option>
          </select>

          <select
            value={filtroOperadora}
            onChange={(e) => setFiltroOperadora(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="todas">Todas Operadoras</option>
            {operadoras.map((op) => (
              <option key={op.id_operadora} value={op.id_operadora}>
                {op.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de Notas */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Notas Fiscais / Faturas
          </h3>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
        ) : notas.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Nenhuma nota encontrada</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {notas.map((nota) => (
              <div
                key={nota.id_nota}
                className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {nota.numero_nota}
                      </span>
                      {getStatusBadge(nota.status)}
                    </div>
                    
                    <div className="mt-2 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Building2 size={14} />
                        {nota.operadora?.nome || 'Operadora não identificada'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {new Date(nota.data_emissao).toLocaleDateString('pt-BR')}
                      </span>
                      {nota.competencia && (
                        <span>Comp: {nota.competencia}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatCurrency(nota.valor_total)}
                    </p>
                    {nota.valor_recebido > 0 && (
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Recebido: {formatCurrency(nota.valor_recebido)}
                      </p>
                    )}
                    {nota.valor_glosado > 0 && (
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Glosado: {formatCurrency(nota.valor_glosado)}
                      </p>
                    )}
                  </div>

                  <ChevronRight className="h-5 w-5 text-gray-400 ml-4" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FaturasDashboard;
