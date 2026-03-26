import React, { useEffect, useState } from 'react';
import {
  DollarSign,
  Calendar,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertTriangle,
  Building2,
  FileText,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Banknote
} from 'lucide-react';
import { useBilling } from '../../../hooks/useBilling';
import { 
  Recebimento, 
  RecebimentoStatus, 
  RecebimentoAgrupado,
  RecebimentoBaixaInput 
} from '../../billing/types';

// ============================================================================
// COMPONENTE: RecebimentosList
// Lista de contas a receber e histórico de recebimentos
// ============================================================================

const RecebimentosList: React.FC = () => {
  const {
    loading,
    error,
    recebimentos,
    fetchRecebimentos,
    fetchRecebimentosAgrupados,
    registerRecebimento,
    formatCurrency,
    clearError
  } = useBilling();

  const [viewMode, setViewMode] = useState<'agrupado' | 'lista'>('agrupado');
  const [filtroStatus, setFiltroStatus] = useState<RecebimentoStatus | 'todos'>('todos');
  const [recebimentosAgrupados, setRecebimentosAgrupados] = useState<RecebimentoAgrupado[]>([]);
  const [showBaixaModal, setShowBaixaModal] = useState(false);
  const [selectedRecebimento, setSelectedRecebimento] = useState<Recebimento | null>(null);
  const [baixaForm, setBaixaForm] = useState<RecebimentoBaixaInput>({
    data_receb: new Date().toISOString().split('T')[0],
    valor_recebido: 0,
    banco_nome: '',
    banco_conta: '',
    observacoes: ''
  });

  // Carregar dados iniciais
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (viewMode === 'agrupado') {
      const grupos = await fetchRecebimentosAgrupados();
      setRecebimentosAgrupados(grupos);
    } else {
      const filters = filtroStatus !== 'todos' ? { status: filtroStatus } : undefined;
      await fetchRecebimentos(filters);
    }
  };

  useEffect(() => {
    loadData();
  }, [viewMode, filtroStatus]);

  // Status badge helper
  const getStatusBadge = (status: RecebimentoStatus) => {
    const styles: Record<RecebimentoStatus, { bg: string; text: string; icon: React.ReactNode }> = {
      previsto: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', icon: <Clock size={14} /> },
      recebido: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', icon: <CheckCircle size={14} /> },
      parcial: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', icon: <AlertTriangle size={14} /> },
      cancelado: { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-300', icon: <Clock size={14} /> }
    };
    const { bg, text, icon } = styles[status];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
        {icon}
        {status}
      </span>
    );
  };

  // Período badge helper
  const getPeriodoBadge = (periodo: string) => {
    const styles: Record<string, { bg: string; text: string }> = {
      'vencido': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
      '30dias': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
      '60dias': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' },
      '90dias': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' }
    };
    const labels: Record<string, string> = {
      'vencido': 'Vencido',
      '30dias': 'Próx. 30 dias',
      '60dias': '30-60 dias',
      '90dias': '60-90 dias'
    };
    const { bg, text } = styles[periodo] || styles['90dias'];
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${bg} ${text}`}>
        {labels[periodo] || periodo}
      </span>
    );
  };

  // Abrir modal de baixa
  const handleOpenBaixa = (recebimento: Recebimento) => {
    setSelectedRecebimento(recebimento);
    setBaixaForm({
      data_receb: new Date().toISOString().split('T')[0],
      valor_recebido: recebimento.valor_previsto,
      banco_nome: '',
      banco_conta: '',
      observacoes: ''
    });
    setShowBaixaModal(true);
  };

  // Registrar baixa
  const handleRegistrarBaixa = async () => {
    if (!selectedRecebimento) return;

    // Aqui você pegaria o nome do usuário logado
    const userName = 'Usuário Sistema'; // TODO: Pegar do contexto de auth

    const result = await registerRecebimento(
      selectedRecebimento.id_receb,
      baixaForm,
      userName
    );

    if (result.success) {
      setShowBaixaModal(false);
      setSelectedRecebimento(null);
      loadData();

      if (result.glosaGerada) {
        alert(`Atenção: Foi identificada uma glosa de ${formatCurrency(result.glosaGerada.valor)}`);
      }
    } else {
      alert(result.error || 'Erro ao registrar baixa');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-green-600" />
            Contas a Receber
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestão de recebimentos e baixas financeiras
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('agrupado')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'agrupado'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Visão Agrupada
          </button>
          <button
            onClick={() => setViewMode('lista')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'lista'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Lista Detalhada
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <button onClick={clearError} className="ml-auto text-red-600 hover:text-red-800">×</button>
          </div>
        </div>
      )}

      {/* Visão Agrupada por Período */}
      {viewMode === 'agrupado' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {recebimentosAgrupados.map((grupo) => (
            <div
              key={grupo.periodo}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 ${
                grupo.periodo === 'vencido' && grupo.quantidade > 0
                  ? 'ring-2 ring-red-500'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                {getPeriodoBadge(grupo.periodo)}
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {grupo.quantidade}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Valor Total</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(grupo.valorTotal)}
                  </span>
                </div>
              </div>

              {grupo.quantidade > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {grupo.recebimentos.slice(0, 5).map((rec) => (
                      <div
                        key={rec.id_receb}
                        className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-700/50 rounded p-2"
                      >
                        <span className="text-gray-600 dark:text-gray-300 truncate flex-1">
                          {rec.nota?.numero_nota || `Receb. ${rec.id_receb.slice(0, 8)}`}
                        </span>
                        <button
                          onClick={() => handleOpenBaixa(rec)}
                          className="ml-2 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                        >
                          Baixar
                        </button>
                      </div>
                    ))}
                    {grupo.quantidade > 5 && (
                      <p className="text-xs text-gray-500 text-center">
                        +{grupo.quantidade - 5} itens
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Visão Lista Detalhada */}
      {viewMode === 'lista' && (
        <>
          {/* Filtros */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtros:</span>
              </div>
              
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value as RecebimentoStatus | 'todos')}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="todos">Todos os Status</option>
                <option value="previsto">Previsto</option>
                <option value="recebido">Recebido</option>
                <option value="parcial">Parcial</option>
              </select>
            </div>
          </div>

          {/* Tabela de Recebimentos */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
              </div>
            ) : recebimentos.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Nenhum recebimento encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Nota / Referência
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Operadora
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Data Prevista
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Valor Previsto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Valor Recebido
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {recebimentos.map((rec) => (
                      <tr key={rec.id_receb} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-gray-400" />
                            <span className="font-medium text-gray-900 dark:text-white">
                              {rec.nota?.numero_nota || '-'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Building2 size={16} className="text-gray-400" />
                            <span className="text-gray-600 dark:text-gray-300">
                              {rec.nota?.operadora?.nome || '-'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-gray-400" />
                            <span className="text-gray-600 dark:text-gray-300">
                              {new Date(rec.data_prevista).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatCurrency(rec.valor_previsto)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`font-medium ${
                            rec.valor_recebido > 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {rec.valor_recebido > 0 ? formatCurrency(rec.valor_recebido) : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(rec.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {rec.status === 'previsto' && (
                            <button
                              onClick={() => handleOpenBaixa(rec)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                            >
                              <Banknote size={16} />
                              Registrar Baixa
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal de Baixa */}
      {showBaixaModal && selectedRecebimento && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowBaixaModal(false)} />
            
            <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Banknote className="h-5 w-5 text-green-600" />
                Registrar Baixa
              </h3>
              
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <strong>Nota:</strong> {selectedRecebimento.nota?.numero_nota || '-'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <strong>Valor Previsto:</strong> {formatCurrency(selectedRecebimento.valor_previsto)}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Data do Recebimento
                  </label>
                  <input
                    type="date"
                    value={baixaForm.data_receb}
                    onChange={(e) => setBaixaForm({ ...baixaForm, data_receb: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valor Recebido
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={baixaForm.valor_recebido}
                    onChange={(e) => setBaixaForm({ ...baixaForm, valor_recebido: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  {baixaForm.valor_recebido < selectedRecebimento.valor_previsto && (
                    <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                      <AlertTriangle size={14} />
                      Será gerada uma glosa de {formatCurrency(selectedRecebimento.valor_previsto - baixaForm.valor_recebido)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Banco
                  </label>
                  <input
                    type="text"
                    value={baixaForm.banco_nome || ''}
                    onChange={(e) => setBaixaForm({ ...baixaForm, banco_nome: e.target.value })}
                    placeholder="Ex: Banco do Brasil"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Observações
                  </label>
                  <textarea
                    value={baixaForm.observacoes || ''}
                    onChange={(e) => setBaixaForm({ ...baixaForm, observacoes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowBaixaModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRegistrarBaixa}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Confirmar Baixa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecebimentosList;
