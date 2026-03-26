import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Building2,
  Calendar,
  Filter,
  ArrowRight,
  Undo2,
  MessageSquare,
  User
} from 'lucide-react';
import { useBilling } from '../../../hooks/useBilling';
import { Glosa, GlosaStatus, GlosaRecursoInput } from '../../billing/types';

// ============================================================================
// COMPONENTE: GlosasRecursos
// Gestão de glosas e recursos junto às operadoras
// ============================================================================

const GlosasRecursos: React.FC = () => {
  const {
    loading,
    error,
    glosas,
    fetchGlosas,
    updateGlosaStatus,
    formatCurrency,
    clearError
  } = useBilling();

  const [filtroStatus, setFiltroStatus] = useState<GlosaStatus | 'todas'>('todas');
  const [showRecursoModal, setShowRecursoModal] = useState(false);
  const [selectedGlosa, setSelectedGlosa] = useState<Glosa | null>(null);
  const [recursoForm, setRecursoForm] = useState<GlosaRecursoInput>({
    status: 'em_recurso',
    responsavel: ''
  });

  // Carregar dados iniciais
  useEffect(() => {
    loadGlosas();
  }, [filtroStatus]);

  const loadGlosas = async () => {
    const filters = filtroStatus !== 'todas' ? { status: filtroStatus } : undefined;
    await fetchGlosas(filters);
  };

  // Status badge helper
  const getStatusBadge = (status: GlosaStatus) => {
    const styles: Record<GlosaStatus, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
      aberta: { 
        bg: 'bg-red-100 dark:bg-red-900/30', 
        text: 'text-red-700 dark:text-red-300', 
        icon: <AlertCircle size={14} />,
        label: 'Aberta'
      },
      em_recurso: { 
        bg: 'bg-yellow-100 dark:bg-yellow-900/30', 
        text: 'text-yellow-700 dark:text-yellow-300', 
        icon: <Clock size={14} />,
        label: 'Em Recurso'
      },
      revertida: { 
        bg: 'bg-green-100 dark:bg-green-900/30', 
        text: 'text-green-700 dark:text-green-300', 
        icon: <CheckCircle size={14} />,
        label: 'Revertida'
      },
      definitiva: { 
        bg: 'bg-gray-100 dark:bg-gray-900/30', 
        text: 'text-gray-700 dark:text-gray-300', 
        icon: <XCircle size={14} />,
        label: 'Definitiva'
      }
    };
    const { bg, text, icon, label } = styles[status];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
        {icon}
        {label}
      </span>
    );
  };

  // Calcular totais
  const totais = {
    abertas: glosas.filter(g => g.status === 'aberta').reduce((sum, g) => sum + g.valor, 0),
    emRecurso: glosas.filter(g => g.status === 'em_recurso').reduce((sum, g) => sum + g.valor, 0),
    revertidas: glosas.filter(g => g.status === 'revertida').reduce((sum, g) => sum + g.valor, 0),
    definitivas: glosas.filter(g => g.status === 'definitiva').reduce((sum, g) => sum + g.valor, 0)
  };

  // Handlers de ação
  const handleIniciarRecurso = (glosa: Glosa) => {
    setSelectedGlosa(glosa);
    setRecursoForm({
      status: 'em_recurso',
      responsavel: '',
      data_recurso: new Date().toISOString().split('T')[0]
    });
    setShowRecursoModal(true);
  };

  const handleMarcarRevertida = async (glosa: Glosa) => {
    if (!confirm('Confirma que esta glosa foi REVERTIDA pela operadora?')) return;
    
    await updateGlosaStatus(glosa.id_glosa, {
      status: 'revertida',
      resultado_recurso: 'Glosa revertida - valor será creditado'
    });
    loadGlosas();
  };

  const handleMarcarDefinitiva = async (glosa: Glosa) => {
    if (!confirm('Confirma que esta glosa é DEFINITIVA e não será revertida?')) return;
    
    await updateGlosaStatus(glosa.id_glosa, {
      status: 'definitiva',
      resultado_recurso: 'Recurso negado - glosa mantida'
    });
    loadGlosas();
  };

  const handleSalvarRecurso = async () => {
    if (!selectedGlosa) return;
    
    await updateGlosaStatus(selectedGlosa.id_glosa, recursoForm);
    setShowRecursoModal(false);
    setSelectedGlosa(null);
    loadGlosas();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertCircle className="h-7 w-7 text-red-600" />
            Gestão de Glosas
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Controle de glosas e recursos junto às operadoras
          </p>
        </div>

        <button
          onClick={loadGlosas}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
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

      {/* Cards de Totais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-200 dark:border-red-800 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Glosas Abertas</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {formatCurrency(totais.abertas)}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {glosas.filter(g => g.status === 'aberta').length} pendentes
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-yellow-200 dark:border-yellow-800 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Em Recurso</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                {formatCurrency(totais.emRecurso)}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {glosas.filter(g => g.status === 'em_recurso').length} aguardando
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-green-200 dark:border-green-800 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Revertidas</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {formatCurrency(totais.revertidas)}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {glosas.filter(g => g.status === 'revertida').length} recuperadas
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Definitivas</p>
              <p className="text-2xl font-bold text-gray-600 dark:text-gray-400 mt-1">
                {formatCurrency(totais.definitivas)}
              </p>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <XCircle className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {glosas.filter(g => g.status === 'definitiva').length} finalizadas
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtrar por:</span>
          </div>
          
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as GlosaStatus | 'todas')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="todas">Todos os Status</option>
            <option value="aberta">Abertas</option>
            <option value="em_recurso">Em Recurso</option>
            <option value="revertida">Revertidas</option>
            <option value="definitiva">Definitivas</option>
          </select>
        </div>
      </div>

      {/* Lista de Glosas */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Glosas ({glosas.length})
          </h3>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
        ) : glosas.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Nenhuma glosa encontrada</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {glosas.map((glosa) => (
              <div
                key={glosa.id_glosa}
                className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Informações da Glosa */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      {getStatusBadge(glosa.status)}
                      <span className="text-lg font-bold text-red-600 dark:text-red-400">
                        {formatCurrency(glosa.valor)}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <FileText size={14} />
                        {glosa.nota?.numero_nota || glosa.recebimento?.nota?.numero_nota || '-'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 size={14} />
                        {glosa.recebimento?.nota?.operadora?.nome || '-'}
                      </span>
                      {glosa.codigo_glosa && (
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          Cód: {glosa.codigo_glosa}
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      <strong>Motivo:</strong> {glosa.motivo}
                    </div>

                    {glosa.recurso && (
                      <div className="text-sm space-y-1">
                        {glosa.data_recurso && (
                          <p className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Calendar size={14} />
                            Recurso em: {new Date(glosa.data_recurso).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                        {glosa.responsavel && (
                          <p className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <User size={14} />
                            Responsável: {glosa.responsavel}
                          </p>
                        )}
                        {glosa.resultado_recurso && (
                          <p className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <MessageSquare size={14} />
                            {glosa.resultado_recurso}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2">
                    {glosa.status === 'aberta' && (
                      <button
                        onClick={() => handleIniciarRecurso(glosa)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors"
                      >
                        <ArrowRight size={16} />
                        Iniciar Recurso
                      </button>
                    )}
                    
                    {glosa.status === 'em_recurso' && (
                      <>
                        <button
                          onClick={() => handleMarcarRevertida(glosa)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Undo2 size={16} />
                          Revertida
                        </button>
                        <button
                          onClick={() => handleMarcarDefinitiva(glosa)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          <XCircle size={16} />
                          Definitiva
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Recurso */}
      {showRecursoModal && selectedGlosa && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowRecursoModal(false)} />
            
            <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <ArrowRight className="h-5 w-5 text-yellow-600" />
                Iniciar Recurso de Glosa
              </h3>
              
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300">
                  <strong>Valor da Glosa:</strong> {formatCurrency(selectedGlosa.valor)}
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  <strong>Motivo:</strong> {selectedGlosa.motivo}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Data do Recurso
                  </label>
                  <input
                    type="date"
                    value={recursoForm.data_recurso || ''}
                    onChange={(e) => setRecursoForm({ ...recursoForm, data_recurso: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Responsável pelo Recurso
                  </label>
                  <input
                    type="text"
                    value={recursoForm.responsavel || ''}
                    onChange={(e) => setRecursoForm({ ...recursoForm, responsavel: e.target.value })}
                    placeholder="Nome do responsável"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Observações (opcional)
                  </label>
                  <textarea
                    value={recursoForm.resultado_recurso || ''}
                    onChange={(e) => setRecursoForm({ ...recursoForm, resultado_recurso: e.target.value })}
                    rows={3}
                    placeholder="Detalhes do recurso enviado..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowRecursoModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvarRecurso}
                  disabled={loading || !recursoForm.responsavel}
                  className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Confirmar Recurso'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlosasRecursos;
