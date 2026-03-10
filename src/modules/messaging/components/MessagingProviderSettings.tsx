/**
 * MessagingProviderSettings
 * 
 * Admin panel for managing messaging providers with full CRUD operations
 */

import React, { useEffect, useState } from 'react';
import { useMessaging } from '../../../hooks/useMessaging';
import { MessagingProvider, MessageProviderType } from '../types';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Play,
  Square,
  MessageSquare,
  Mail,
  Phone,
  Globe,
  Eye,
  EyeOff
} from 'lucide-react';

interface ProviderFormData {
  code: string;
  name: string;
  type: MessageProviderType;
  isActive: boolean;
  // WA-HA fields
  apiUrl: string;
  sessionName: string;
  token: string;
}

const emptyFormData: ProviderFormData = {
  code: '',
  name: '',
  type: 'whatsapp',
  isActive: true,
  apiUrl: '',
  sessionName: '',
  token: '',
};

export const MessagingProviderSettings: React.FC = () => {
  const {
    providers,
    loadProviders,
    getAllProviderHealth,
    startProcessor,
    stopProcessor,
    getProcessorStatus,
    createProvider,
    updateProvider,
    deleteProvider,
    testProviderConnection,
  } = useMessaging();

  const [healthData, setHealthData] = useState<any[]>([]);
  const [processorStatus, setProcessorStatus] = useState({ running: false, intervalMs: 0 });
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<MessagingProvider | null>(null);
  const [formData, setFormData] = useState<ProviderFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Test connection state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{id: string; result: any} | null>(null);
  
  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Show/hide token
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    loadData();
    
    const interval = setInterval(() => {
      setProcessorStatus(getProcessorStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    await loadProviders();
    await refreshHealth();
  };

  const refreshHealth = async () => {
    setRefreshing(true);
    try {
      const health = await getAllProviderHealth();
      setHealthData(health);
    } catch (error) {
      console.error('Failed to refresh health:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleProcessor = async () => {
    try {
      if (processorStatus.running) {
        stopProcessor();
      } else {
        await startProcessor();
      }
      setProcessorStatus(getProcessorStatus());
    } catch (error) {
      console.error('Failed to toggle processor:', error);
      alert('Erro ao controlar processador de mensagens');
    }
  };

  const openAddModal = () => {
    setEditingProvider(null);
    setFormData(emptyFormData);
    setFormError(null);
    setShowToken(false);
    setShowModal(true);
  };

  const openEditModal = (provider: MessagingProvider) => {
    setEditingProvider(provider);
    setFormData({
      code: provider.code,
      name: provider.name,
      type: provider.type,
      isActive: provider.isActive,
      apiUrl: (provider.config.apiUrl as string) || '',
      sessionName: (provider.config.sessionName as string) || '',
      token: (provider.config.token as string) || '',
    });
    setFormError(null);
    setShowToken(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProvider(null);
    setFormData(emptyFormData);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      // Validate
      if (!formData.code.trim()) throw new Error('Código é obrigatório');
      if (!formData.name.trim()) throw new Error('Nome é obrigatório');
      
      if (formData.type === 'whatsapp') {
        if (!formData.apiUrl.trim()) throw new Error('URL da API é obrigatória');
        if (!formData.sessionName.trim()) throw new Error('Nome da sessão é obrigatório');
      }

      const config: Record<string, unknown> = {};
      
      if (formData.type === 'whatsapp') {
        config.apiUrl = formData.apiUrl.trim();
        config.sessionName = formData.sessionName.trim();
        if (formData.token.trim()) {
          config.token = formData.token.trim();
        }
      }

      if (editingProvider) {
        // Update
        await updateProvider(editingProvider.id, {
          name: formData.name.trim(),
          config,
          isActive: formData.isActive,
        });
      } else {
        // Create
        await createProvider({
          code: formData.code.trim().toLowerCase().replace(/\s+/g, '_'),
          name: formData.name.trim(),
          type: formData.type,
          config,
          isActive: formData.isActive,
        });
      }

      closeModal();
      await refreshHealth();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erro ao salvar provedor');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (providerId: string) => {
    setTestingId(providerId);
    setTestResult(null);
    
    try {
      const result = await testProviderConnection(providerId);
      setTestResult({ id: providerId, result });
    } catch (error) {
      setTestResult({ 
        id: providerId, 
        result: { 
          success: false, 
          error: error instanceof Error ? error.message : 'Erro desconhecido' 
        } 
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (providerId: string) => {
    try {
      await deleteProvider(providerId);
      setDeletingId(null);
    } catch (error) {
      alert('Erro ao excluir provedor: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const getProviderIcon = (type: MessageProviderType) => {
    switch (type) {
      case 'whatsapp':
        return <MessageSquare className="w-5 h-5 text-green-600" />;
      case 'email':
        return <Mail className="w-5 h-5 text-blue-600" />;
      case 'sms':
        return <Phone className="w-5 h-5 text-purple-600" />;
      default:
        return <Globe className="w-5 h-5 text-gray-600" />;
    }
  };

  const getHealthBadgeColor = (status?: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800';
      case 'unhealthy':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getHealthStatusLabel = (status?: string) => {
    const labels: Record<string, string> = {
      healthy: 'Saudável',
      degraded: 'Degradado',
      unhealthy: 'Fora do Ar',
    };
    return labels[status || ''] || 'Desconhecido';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Provedores de Mensageria</h2>
          <p className="text-sm text-gray-600 mt-1">
            Gerenciar provedores de envio de mensagens (WhatsApp, Email, SMS)
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={refreshHealth}
            disabled={refreshing}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
          
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo Provedor
          </button>
        </div>
      </div>

      {/* Message Processor Status */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Processador de Mensagens</h3>
            <p className="text-sm text-gray-600 mt-1">
              {processorStatus.running
                ? `Rodando (verifica a cada ${processorStatus.intervalMs / 1000}s)`
                : 'Parado'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${
                processorStatus.running
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {processorStatus.running ? (
                <>
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Ativo
                </>
              ) : (
                <>
                  <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                  Inativo
                </>
              )}
            </span>

            <button
              onClick={handleToggleProcessor}
              className={`px-4 py-2 rounded font-medium flex items-center gap-2 ${
                processorStatus.running
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {processorStatus.running ? (
                <>
                  <Square className="w-4 h-4" />
                  Parar
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Iniciar
                </>
              )}
            </button>
          </div>
        </div>

        {processorStatus.running && (
          <div className="mt-3 p-3 bg-blue-50 rounded text-sm text-blue-800">
            ⚡ O processador envia mensagens pendentes e reprocessa falhas automaticamente.
          </div>
        )}
      </div>

      {/* Providers List */}
      <div className="bg-white border rounded-lg">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900">Provedores Configurados</h3>
        </div>

        <div className="divide-y">
          {providers.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">Nenhum provedor configurado</p>
              <button
                onClick={openAddModal}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Adicionar Provedor
              </button>
            </div>
          ) : (
            providers.map((provider) => {
              const health = healthData.find((h) => h.provider.id === provider.id)?.health;
              const currentTestResult = testResult?.id === provider.id ? testResult.result : null;

              return (
                <div key={provider.id} className="p-4">
                  <div className="flex items-start justify-between">
                    {/* Provider Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getProviderIcon(provider.type)}
                        <h4 className="font-semibold text-gray-900">{provider.name}</h4>
                        
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            provider.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {provider.isActive ? 'Ativo' : 'Inativo'}
                        </span>

                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {provider.type.toUpperCase()}
                        </span>
                      </div>

                      <div className="text-sm text-gray-600 space-y-1 ml-8">
                        <div>
                          <span className="font-medium">Código:</span> {provider.code}
                        </div>

                        {provider.type === 'whatsapp' && provider.config.apiUrl && (
                          <div>
                            <span className="font-medium">API URL:</span>{' '}
                            {provider.config.apiUrl as string}
                          </div>
                        )}

                        {provider.type === 'whatsapp' && provider.config.sessionName && (
                          <div>
                            <span className="font-medium">Sessão:</span>{' '}
                            {provider.config.sessionName as string}
                          </div>
                        )}
                      </div>

                      {/* Test Result */}
                      {currentTestResult && (
                        <div className={`mt-3 ml-8 p-3 rounded text-sm ${
                          currentTestResult.success 
                            ? 'bg-green-50 text-green-800 border border-green-200' 
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}>
                          {currentTestResult.success ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4" />
                              <span>
                                Conexão OK! Status: {currentTestResult.status}
                                {currentTestResult.phone && ` | Tel: ${currentTestResult.phone}`}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <XCircle className="w-4 h-4" />
                              <span>Falha: {currentTestResult.error}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      {/* Health Status */}
                      {health && (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getHealthBadgeColor(
                            health.status
                          )}`}
                        >
                          {getHealthStatusLabel(health.status)}
                        </span>
                      )}

                      <button
                        onClick={() => handleTestConnection(provider.id)}
                        disabled={testingId === provider.id}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                        title="Testar conexão"
                      >
                        {testingId === provider.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <AlertCircle className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        onClick={() => openEditModal(provider)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setDeletingId(provider.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Delete Confirmation */}
                  {deletingId === provider.id && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded flex items-center justify-between">
                      <span className="text-sm text-red-800">
                        Tem certeza que deseja excluir este provedor?
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeletingId(null)}
                          className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleDelete(provider.id)}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingProvider ? 'Editar Provedor' : 'Novo Provedor'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                  {formError}
                </div>
              )}

              {/* Code (only for new) */}
              {!editingProvider && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="waha_primary"
                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Identificador único (sem espaços, use underscore)
                  </p>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="WhatsApp Principal"
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Type (only for new) */}
              {!editingProvider && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as MessageProviderType })}
                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="whatsapp">WhatsApp (WA-HA)</option>
                    <option value="email">Email (SMTP)</option>
                    <option value="sms">SMS</option>
                    <option value="api">API Genérica</option>
                  </select>
                </div>
              )}

              {/* Active */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Provedor ativo
                </label>
              </div>

              {/* WA-HA specific fields */}
              {(formData.type === 'whatsapp' || editingProvider?.type === 'whatsapp') && (
                <div className="pt-4 border-t space-y-4">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-green-600" />
                    Configuração WA-HA
                  </h4>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL da API *
                    </label>
                    <input
                      type="url"
                      value={formData.apiUrl}
                      onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                      placeholder="http://localhost:3000"
                      className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome da Sessão *
                    </label>
                    <input
                      type="text"
                      value={formData.sessionName}
                      onChange={(e) => setFormData({ ...formData, sessionName: e.target.value })}
                      placeholder="quotations_001"
                      className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API Key (Token)
                    </label>
                    <div className="relative">
                      <input
                        type={showToken ? 'text' : 'password'}
                        value={formData.token}
                        onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                        placeholder="Deixe vazio se não usar autenticação"
                        className="w-full px-3 py-2 pr-10 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 border-t flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 border rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : editingProvider ? 'Salvar' : 'Criar Provedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
