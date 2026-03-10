import React, { useState, useRef } from 'react';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  Calendar,
  MapPin,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  Eye,
  Trash2,
  X,
  ChevronDown,
  Building2,
  User,
  FileText,
  Upload,
  Loader2,
  AlertCircle,
  Shield,
  Timer
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useMaintenanceRequest } from '../../hooks/useMaintenanceRequest';
import { useNotification } from '../../hooks/useNotification';
import { useDialog } from '../../hooks/useDialog';
import { 
  MaintenanceRequest,
  MaintenanceRequestFormValues,
  MaintenanceStatus,
  MaintenancePriority,
  MAINTENANCE_STATUS_LABELS,
  MAINTENANCE_STATUS_COLORS,
  MAINTENANCE_PRIORITY_LABELS,
  MAINTENANCE_PRIORITY_COLORS
} from '../../types';
import Notification from '../Notification';
import ConfirmDialog from '../ConfirmDialog';

// Prazos por prioridade
const PRIORITY_DEADLINES: Record<MaintenancePriority, string> = {
  common: 'Variável de acordo com cada caso',
  priority: 'Em até 72 horas',
  urgent: 'Em até 24 horas'
};

const MaintenanceRequestManagement: React.FC = () => {
  const { user, userProfile } = useAuth();
  const {
    maintenanceRequests,
    loading,
    createMaintenanceRequest,
    updateMaintenanceStatus,
    deleteMaintenanceRequest
  } = useMaintenanceRequest();
  const { notification, showSuccess, showError, showWarning, hideNotification } = useNotification();
  const { confirmDialog, showConfirmDialog, hideConfirmDialog, handleConfirmDialogConfirm } = useDialog();

  // UI State
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [currentImage, setCurrentImage] = useState<string>('');

  // Form state (inline form)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<MaintenanceRequestFormValues>({
    localOcorrencia: '',
    descricao: '',
    impactoOperacional: '',
    dataIdentificacao: new Date().toISOString().slice(0, 16),
    prioridade: 'common',
    images: []
  });
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<Set<string>>(new Set());

  // Permission check
  const canManage = userProfile?.role === 'admin' || userProfile?.role === 'operator';

  // Toggle status card filter (multi-select)
  const toggleStatusCardFilter = (status: string) => {
    setSelectedStatusFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };

  // Clear status card filters
  const clearStatusCardFilters = () => {
    setSelectedStatusFilters(new Set());
  };

  // Filter requests
  const filteredRequests = maintenanceRequests.filter(request => {
    // Se há filtros de cards selecionados, usamos eles (OR logic)
    // Caso contrário, usamos o dropdown
    const matchesStatus = selectedStatusFilters.size > 0
      ? selectedStatusFilters.has(request.status)
      : (statusFilter === 'all' || request.status === statusFilter);
    const matchesPriority = priorityFilter === 'all' || request.prioridade === priorityFilter;
    const matchesSearch = 
      request.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.localOcorrencia.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.requesterName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !dateFilter || request.createdAt.startsWith(dateFilter);

    return matchesStatus && matchesPriority && matchesSearch && matchesDate;
  });

  // Reset form
  const resetForm = () => {
    setFormData({
      localOcorrencia: '',
      descricao: '',
      impactoOperacional: '',
      dataIdentificacao: new Date().toISOString().slice(0, 16),
      prioridade: 'common',
      images: []
    });
    setImagePreviews([]);
    setFormErrors({});
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle input changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Handle priority change
  const handlePriorityChange = (priority: MaintenancePriority) => {
    setFormData(prev => ({ ...prev, prioridade: priority }));
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    const validFiles: File[] = [];

    newFiles.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 5 * 1024 * 1024) return;

      validFiles.push(file);

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImagePreviews(prev => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });

    setFormData(prev => ({
      ...prev,
      images: [...(prev.images || []), ...validFiles]
    }));

    // Clear error when files are added
    if (formErrors.images && validFiles.length > 0) {
      setFormErrors(prev => ({ ...prev, images: '' }));
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove image
  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images?.filter((_, i) => i !== index) || []
    }));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.localOcorrencia.trim()) {
      newErrors.localOcorrencia = 'Local da ocorrência é obrigatório';
    }

    if (!formData.descricao.trim()) {
      newErrors.descricao = 'Descrição do problema é obrigatória';
    }

    if (!formData.impactoOperacional.trim()) {
      newErrors.impactoOperacional = 'Impacto operacional é obrigatório';
    }

    if (!formData.dataIdentificacao) {
      newErrors.dataIdentificacao = 'Data/hora de identificação é obrigatória';
    }

    // OBRIGATÓRIO: Autorização do gestor
    if (!formData.images || formData.images.length === 0) {
      newErrors.images = 'A autorização do gestor imediato é obrigatória';
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showError('Campos obrigatórios', 'Preencha todos os campos e anexe a autorização do gestor.');
      return;
    }

    if (!user || !userProfile) return;

    setIsSubmitting(true);
    
    const result = await createMaintenanceRequest(
      formData,
      user.id,
      userProfile.name,
      user.email || '',
      userProfile.department
    );

    setIsSubmitting(false);

    if (result.success) {
      showSuccess('Solicitação criada!', result.message || 'Solicitação de manutenção registrada com sucesso.');
      resetForm();
      setShowForm(false);
    } else {
      showError('Erro', result.error || 'Não foi possível criar a solicitação.');
    }
  };

  // Handle status update
  const handleStatusUpdate = async (id: string, newStatus: MaintenanceStatus, additionalData?: Record<string, string>) => {
    const result = await updateMaintenanceStatus(id, newStatus, additionalData);

    if (result.success) {
      showSuccess('Status atualizado!', result.message || 'Status da solicitação atualizado.');
      setShowDetailModal(false);
    } else {
      showError('Erro', result.error || 'Não foi possível atualizar o status.');
    }
  };

  // Handle delete
  const handleDelete = (request: MaintenanceRequest) => {
    showConfirmDialog(
      'Excluir Solicitação',
      `Tem certeza que deseja excluir a solicitação ${request.codigo}? Esta ação não pode ser desfeita.`,
      async () => {
        const result = await deleteMaintenanceRequest(request.id);
        if (result.success) {
          showSuccess('Excluída!', 'Solicitação excluída com sucesso.');
        } else {
          showError('Erro', result.error || 'Não foi possível excluir a solicitação.');
        }
        hideConfirmDialog();
      },
      {
        confirmText: 'Excluir',
        cancelText: 'Cancelar',
        type: 'danger'
      }
    );
  };

  // View image
  const viewImage = (url: string) => {
    setCurrentImage(url);
    setShowImageViewer(true);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status icon
  const getStatusIcon = (status: MaintenanceStatus) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'in_progress':
        return <Play className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
    }
  };

  // Get priority icon
  const getPriorityIcon = (priority: MaintenancePriority) => {
    if (priority === 'urgent') {
      return <AlertTriangle className="w-4 h-4" />;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        type={confirmDialog.type}
        onConfirm={handleConfirmDialogConfirm}
        onCancel={hideConfirmDialog}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
            Solicitações de Manutenção
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie as solicitações de manutenção do laboratório</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all duration-200 font-medium shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30"
        >
          <Plus className="w-5 h-5" />
          Nova Solicitação
        </button>
      </div>

      {/* ========================================== */}
      {/* FORMULÁRIO INLINE (renderizado na página) */}
      {/* ========================================== */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-scale-in">
          {/* Header do formulário */}
          <div className="px-4 sm:px-8 py-5 bg-gradient-to-r from-orange-500 to-amber-500">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center min-w-0 flex-1">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                  <Wrench className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold text-white">
                    Nova Solicitação de Manutenção
                  </h3>
                  <p className="text-sm text-white/80 mt-0.5">Preencha os dados do problema identificado</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="p-2 sm:p-2.5 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-all duration-200"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

          <form onSubmit={handleFormSubmit} className="p-4 sm:p-8">
            <div className="space-y-6">
              
              {/* Seção: Informações Básicas */}
              <div className="space-y-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center shadow-md shadow-orange-500/25">
                    <MapPin className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-gray-800 dark:text-gray-100">Informações da Ocorrência</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Dados sobre o local e problema identificado</p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 rounded-xl p-4 sm:p-5 border border-gray-100 dark:border-gray-600">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Setor (readonly) */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">
                        <Building2 className="w-3.5 h-3.5 inline-block mr-1.5 mb-0.5" />
                        Setor
                      </label>
                      <div className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-xl text-gray-600 dark:text-gray-300 text-sm">
                        {userProfile?.department || 'Não definido'}
                      </div>
                      <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">Preenchido automaticamente</p>
                    </div>

                    {/* Local da Ocorrência */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">
                        <MapPin className="w-3.5 h-3.5 inline-block mr-1.5 mb-0.5" />
                        Local da Ocorrência *
                      </label>
                      <input
                        type="text"
                        name="localOcorrencia"
                        value={formData.localOcorrencia}
                        onChange={handleInputChange}
                        placeholder="Ex: Sala de análises, Laboratório 2..."
                        className={`w-full px-4 py-3 bg-white dark:bg-gray-700 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 text-sm dark:text-gray-100 dark:placeholder-gray-400 ${
                          formErrors.localOcorrencia ? 'border-red-300 bg-red-50 dark:bg-red-900/30' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      />
                      {formErrors.localOcorrencia && (
                        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {formErrors.localOcorrencia}
                        </p>
                      )}
                    </div>

                    {/* Data/Hora de Identificação */}
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">
                        <Calendar className="w-3.5 h-3.5 inline-block mr-1.5 mb-0.5" />
                        Data/Hora de Identificação *
                      </label>
                      <input
                        type="datetime-local"
                        name="dataIdentificacao"
                        value={formData.dataIdentificacao as string}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 bg-white dark:bg-gray-700 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 text-sm dark:text-gray-100 ${
                          formErrors.dataIdentificacao ? 'border-red-300 bg-red-50 dark:bg-red-900/30' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      />
                      {formErrors.dataIdentificacao && (
                        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {formErrors.dataIdentificacao}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção: Descrição do Problema */}
              <div className="space-y-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center shadow-md shadow-blue-500/25">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-gray-800 dark:text-gray-100">Descrição do Problema</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Detalhe o problema e seu impacto</p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 rounded-xl p-4 sm:p-5 border border-gray-100 dark:border-gray-600 space-y-5">
                  {/* Descrição */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">
                      Descrição do Problema *
                    </label>
                    <textarea
                      name="descricao"
                      value={formData.descricao}
                      onChange={handleInputChange}
                      rows={4}
                      placeholder="Descreva detalhadamente o problema encontrado..."
                      className={`w-full px-4 py-3 bg-white dark:bg-gray-700 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 resize-none text-sm dark:text-gray-100 dark:placeholder-gray-400 ${
                        formErrors.descricao ? 'border-red-300 bg-red-50 dark:bg-red-900/30' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    />
                    {formErrors.descricao && (
                      <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {formErrors.descricao}
                      </p>
                    )}
                  </div>

                  {/* Impacto Operacional */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 inline-block mr-1.5 mb-0.5" />
                      Impacto Operacional *
                    </label>
                    <textarea
                      name="impactoOperacional"
                      value={formData.impactoOperacional}
                      onChange={handleInputChange}
                      rows={3}
                      placeholder="Descreva como este problema afeta as operações..."
                      className={`w-full px-4 py-3 bg-white dark:bg-gray-700 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 resize-none text-sm dark:text-gray-100 dark:placeholder-gray-400 ${
                        formErrors.impactoOperacional ? 'border-red-300 bg-red-50 dark:bg-red-900/30' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    />
                    {formErrors.impactoOperacional && (
                      <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {formErrors.impactoOperacional}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Seção: Prioridade */}
              <div className="space-y-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-rose-500 rounded-lg flex items-center justify-center shadow-md shadow-red-500/25">
                    <Timer className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-gray-800 dark:text-gray-100">Prioridade e Prazo</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Defina a urgência da solicitação</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Normal */}
                  <button
                    type="button"
                    onClick={() => handlePriorityChange('common')}
                    className={`p-5 rounded-xl border-2 transition-all duration-200 text-left group hover:shadow-md ${
                      formData.prioridade === 'common'
                        ? 'border-gray-500 bg-gray-50 dark:bg-gray-700 ring-2 ring-gray-500/20 shadow-md'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                        formData.prioridade === 'common' ? 'bg-gray-500' : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'
                      }`}>
                        <Clock className={`w-5 h-5 ${
                          formData.prioridade === 'common' ? 'text-white' : 'text-gray-500 dark:text-gray-400'
                        }`} />
                      </div>
                      <div>
                        <span className={`text-sm font-semibold ${
                          formData.prioridade === 'common' ? 'text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'
                        }`}>Normal</span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${
                      formData.prioridade === 'common' ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      <Timer className="w-3.5 h-3.5" />
                      <span>{PRIORITY_DEADLINES.common}</span>
                    </div>
                  </button>

                  {/* Prioritário */}
                  <button
                    type="button"
                    onClick={() => handlePriorityChange('priority')}
                    className={`p-5 rounded-xl border-2 transition-all duration-200 text-left group hover:shadow-md ${
                      formData.prioridade === 'priority'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 ring-2 ring-orange-500/20 shadow-md'
                        : 'border-gray-200 dark:border-gray-600 hover:border-orange-200 dark:hover:border-orange-500/50 bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                        formData.prioridade === 'priority' ? 'bg-orange-500' : 'bg-orange-100 dark:bg-orange-900/50 group-hover:bg-orange-200 dark:group-hover:bg-orange-900/70'
                      }`}>
                        <AlertCircle className={`w-5 h-5 ${
                          formData.prioridade === 'priority' ? 'text-white' : 'text-orange-500 dark:text-orange-400'
                        }`} />
                      </div>
                      <div>
                        <span className={`text-sm font-semibold ${
                          formData.prioridade === 'priority' ? 'text-orange-800 dark:text-orange-200' : 'text-gray-600 dark:text-gray-300'
                        }`}>Prioritário</span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-2 text-xs font-medium ${
                      formData.prioridade === 'priority' ? 'text-orange-600 dark:text-orange-300' : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      <Timer className="w-3.5 h-3.5" />
                      <span>{PRIORITY_DEADLINES.priority}</span>
                    </div>
                  </button>

                  {/* Urgente */}
                  <button
                    type="button"
                    onClick={() => handlePriorityChange('urgent')}
                    className={`p-5 rounded-xl border-2 transition-all duration-200 text-left group hover:shadow-md ${
                      formData.prioridade === 'urgent'
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/30 ring-2 ring-red-500/20 shadow-md'
                        : 'border-gray-200 dark:border-gray-600 hover:border-red-200 dark:hover:border-red-500/50 bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                        formData.prioridade === 'urgent' ? 'bg-red-500' : 'bg-red-100 dark:bg-red-900/50 group-hover:bg-red-200 dark:group-hover:bg-red-900/70'
                      }`}>
                        <AlertTriangle className={`w-5 h-5 ${
                          formData.prioridade === 'urgent' ? 'text-white' : 'text-red-500 dark:text-red-400'
                        }`} />
                      </div>
                      <div>
                        <span className={`text-sm font-semibold ${
                          formData.prioridade === 'urgent' ? 'text-red-800 dark:text-red-200' : 'text-gray-600 dark:text-gray-300'
                        }`}>Urgente</span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-2 text-xs font-medium ${
                      formData.prioridade === 'urgent' ? 'text-red-600 dark:text-red-300' : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      <Timer className="w-3.5 h-3.5" />
                      <span>{PRIORITY_DEADLINES.urgent}</span>
                    </div>
                  </button>
                </div>

                {/* Alerta para prioridade urgente */}
                {formData.prioridade === 'urgent' && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl animate-fade-in">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md shadow-red-500/25">
                        <AlertTriangle className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-red-800 dark:text-red-200">Atenção!</p>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                          Somente selecione <strong>URGENTE</strong> quando houver risco iminente à integridade do laboratório, das instalações ou dos colaboradores.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Seção: Autorização do Gestor (OBRIGATÓRIO) */}
              <div className="space-y-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center shadow-md shadow-emerald-500/25">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-gray-800 dark:text-gray-100">Autorização do Gestor Imediato *</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Obrigatório para prosseguir com a solicitação</p>
                  </div>
                </div>

                <div className={`bg-gradient-to-br rounded-xl p-4 sm:p-5 border-2 transition-colors ${
                  formErrors.images 
                    ? 'from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30 border-red-300 dark:border-red-700' 
                    : imagePreviews.length > 0 
                      ? 'from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 border-emerald-200 dark:border-emerald-700' 
                      : 'from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 border-gray-200 dark:border-gray-600 border-dashed'
                }`}>
                  
                  {/* Aviso de obrigatoriedade */}
                  <div className={`mb-4 p-3 rounded-lg flex items-start gap-3 ${
                    formErrors.images ? 'bg-red-100 dark:bg-red-900/50' : 'bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700'
                  }`}>
                    <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                      formErrors.images ? 'text-red-500' : 'text-amber-500 dark:text-amber-400'
                    }`} />
                    <div>
                      <p className={`text-sm font-medium ${formErrors.images ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200'}`}>
                        Documento obrigatório
                      </p>
                      <p className={`text-xs mt-0.5 ${formErrors.images ? 'text-red-600 dark:text-red-300' : 'text-amber-600 dark:text-amber-300'}`}>
                        Anexe uma imagem da autorização assinada pelo seu gestor imediato para validar esta solicitação de manutenção.
                      </p>
                    </div>
                  </div>

                  {/* Área de upload */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 ${
                      formErrors.images 
                        ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/20 hover:border-red-400 hover:bg-red-100/50 dark:hover:bg-red-900/40'
                        : 'border-gray-300 dark:border-gray-600 hover:border-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-900/20'
                    }`}
                  >
                    <Upload className={`w-10 h-10 mx-auto mb-3 ${
                      formErrors.images ? 'text-red-400' : 'text-gray-400 dark:text-gray-500'
                    }`} />
                    <p className={`text-sm font-medium ${formErrors.images ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}`}>
                      Clique para selecionar ou arraste a imagem aqui
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                      PNG, JPG ou JPEG (máx. 5MB por arquivo)
                    </p>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {formErrors.images && (
                    <p className="mt-3 text-sm text-red-600 flex items-center gap-1.5 font-medium">
                      <AlertCircle className="w-4 h-4" />
                      {formErrors.images}
                    </p>
                  )}

                  {/* Image previews */}
                  {imagePreviews.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="relative group animate-scale-in">
                          <img
                            src={preview}
                            alt={`Autorização ${index + 1}`}
                            className="w-full h-28 object-cover rounded-xl border-2 border-emerald-200 shadow-sm"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl transition-colors" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage(index);
                            }}
                            className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg hover:bg-red-600 hover:scale-110"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-2 left-2 right-2">
                            <span className="text-xs bg-emerald-500 text-white px-2 py-1 rounded-md font-medium shadow-sm">
                              Autorização {index + 1}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-3 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all duration-200 font-medium shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Wrench className="w-5 h-5" />
                    Criar Solicitação
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código, local..."
              className="w-full pl-12 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-12 pr-10 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 appearance-none text-sm cursor-pointer bg-white dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="all">Todos os Status</option>
              <option value="pending">Pendente</option>
              <option value="in_progress">Em Andamento</option>
              <option value="completed">Concluído</option>
              <option value="cancelled">Cancelado</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>

          {/* Priority Filter */}
          <div className="relative">
            <AlertTriangle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full pl-12 pr-10 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 appearance-none text-sm cursor-pointer bg-white dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="all">Todas as Prioridades</option>
              <option value="urgent">Urgente</option>
              <option value="priority">Prioritário</option>
              <option value="common">Normal</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>

          {/* Date Filter */}
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards - Apenas para admin e operator (informação de gestão) */}
      {userProfile?.role !== 'requester' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          {/* Pendentes */}
          <button
            onClick={() => toggleStatusCardFilter('pending')}
            className={`bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm hover:shadow-md transition-all duration-200 text-left ${
              selectedStatusFilters.has('pending') 
                ? 'border-yellow-400 ring-2 ring-yellow-400/30 bg-yellow-50 dark:bg-yellow-900/30' 
                : 'border-gray-100 dark:border-gray-700 hover:border-yellow-200 dark:hover:border-yellow-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                selectedStatusFilters.has('pending') ? 'bg-yellow-500' : 'bg-yellow-100 dark:bg-yellow-900/50'
              }`}>
                <Clock className={`w-5 h-5 ${selectedStatusFilters.has('pending') ? 'text-white' : 'text-yellow-600 dark:text-yellow-400'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {maintenanceRequests.filter(r => r.status === 'pending').length}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Pendentes</p>
              </div>
            </div>
          </button>

          {/* Em Andamento */}
          <button
            onClick={() => toggleStatusCardFilter('in_progress')}
            className={`bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm hover:shadow-md transition-all duration-200 text-left ${
              selectedStatusFilters.has('in_progress') 
                ? 'border-blue-400 ring-2 ring-blue-400/30 bg-blue-50 dark:bg-blue-900/30' 
                : 'border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                selectedStatusFilters.has('in_progress') ? 'bg-blue-500' : 'bg-blue-100 dark:bg-blue-900/50'
              }`}>
                <Play className={`w-5 h-5 ${selectedStatusFilters.has('in_progress') ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {maintenanceRequests.filter(r => r.status === 'in_progress').length}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Em Andamento</p>
              </div>
            </div>
          </button>

          {/* Concluídas */}
          <button
            onClick={() => toggleStatusCardFilter('completed')}
            className={`bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm hover:shadow-md transition-all duration-200 text-left ${
              selectedStatusFilters.has('completed') 
                ? 'border-green-400 ring-2 ring-green-400/30 bg-green-50 dark:bg-green-900/30' 
                : 'border-gray-100 dark:border-gray-700 hover:border-green-200 dark:hover:border-green-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                selectedStatusFilters.has('completed') ? 'bg-green-500' : 'bg-green-100 dark:bg-green-900/50'
              }`}>
                <CheckCircle2 className={`w-5 h-5 ${selectedStatusFilters.has('completed') ? 'text-white' : 'text-green-600 dark:text-green-400'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {maintenanceRequests.filter(r => r.status === 'completed').length}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Concluídas</p>
              </div>
            </div>
          </button>

          {/* Canceladas */}
          <button
            onClick={() => toggleStatusCardFilter('cancelled')}
            className={`bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm hover:shadow-md transition-all duration-200 text-left ${
              selectedStatusFilters.has('cancelled') 
                ? 'border-red-400 ring-2 ring-red-400/30 bg-red-50 dark:bg-red-900/30' 
                : 'border-gray-100 dark:border-gray-700 hover:border-red-200 dark:hover:border-red-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                selectedStatusFilters.has('cancelled') ? 'bg-red-500' : 'bg-red-100 dark:bg-red-900/50'
              }`}>
                <XCircle className={`w-5 h-5 ${selectedStatusFilters.has('cancelled') ? 'text-white' : 'text-red-600 dark:text-red-400'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {maintenanceRequests.filter(r => r.status === 'cancelled').length}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Canceladas</p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Indicador de filtros ativos por cards */}
      {selectedStatusFilters.size > 0 && userProfile?.role !== 'requester' && (
        <div className="flex items-center gap-2 animate-fade-in">
          <span className="text-sm text-gray-500 dark:text-gray-400">Filtros ativos:</span>
          {Array.from(selectedStatusFilters).map(status => (
            <span 
              key={status}
              className={`px-2.5 py-1 text-xs font-medium rounded-full ${MAINTENANCE_STATUS_COLORS[status as MaintenanceStatus]}`}
            >
              {MAINTENANCE_STATUS_LABELS[status as MaintenanceStatus]}
            </span>
          ))}
          <button
            onClick={clearStatusCardFilters}
            className="ml-2 text-xs text-orange-600 hover:text-orange-800 underline"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Wrench className="w-10 h-10 text-gray-300 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">
            Nenhuma solicitação encontrada
          </h3>
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'Tente ajustar os filtros de busca'
              : 'Clique em "Nova Solicitação" para criar'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request, index) => (
            <div
              key={request.id}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-lg hover:border-orange-100 dark:hover:border-orange-900/50 transition-all duration-300 animate-fade-in-up"
              style={{ animationDelay: `${0.15 + index * 0.03}s` }}
            >
              <div className="p-5 sm:p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left side - Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
                      {/* Code */}
                      <span className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm font-mono font-bold">
                        {request.codigo}
                      </span>
                      
                      {/* Priority Badge with Deadline */}
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${MAINTENANCE_PRIORITY_COLORS[request.prioridade]}`}>
                        {getPriorityIcon(request.prioridade)}
                        {MAINTENANCE_PRIORITY_LABELS[request.prioridade]}
                        <span className="text-[10px] opacity-70">• {PRIORITY_DEADLINES[request.prioridade]}</span>
                      </span>

                      {/* Status Badge */}
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${MAINTENANCE_STATUS_COLORS[request.status]}`}>
                        {getStatusIcon(request.status)}
                        {MAINTENANCE_STATUS_LABELS[request.status]}
                      </span>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200 mb-2">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="font-medium text-sm sm:text-base">{request.localOcorrencia}</span>
                    </div>

                    {/* Description preview */}
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                      {request.descricao}
                    </p>

                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-gray-400 dark:text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        {request.requesterName}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        {request.department}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(request.createdAt)}
                      </span>
                      {request.images.length > 0 && (
                        <span className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400">
                          <Shield className="w-3.5 h-3.5" />
                          Autorização anexada
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side - Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowDetailModal(true);
                      }}
                      className="p-2.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-xl transition-colors"
                      title="Ver detalhes"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    
                    {canManage && request.status === 'pending' && (
                      <button
                        onClick={() => handleStatusUpdate(request.id, 'in_progress', { assignedTo: userProfile?.name || '' })}
                        className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
                        title="Iniciar atendimento"
                      >
                        <Play className="w-5 h-5" />
                      </button>
                    )}
                    
                    {canManage && request.status === 'in_progress' && (
                      <button
                        onClick={() => handleStatusUpdate(request.id, 'completed')}
                        className="p-2.5 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-xl transition-colors"
                        title="Marcar como concluído"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                    )}

                    {canManage && (
                      <button
                        onClick={() => handleDelete(request)}
                        className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-orange-500 to-amber-500 sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
                    <Wrench className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedRequest.codigo}</h3>
                    <p className="text-sm text-white/80">Detalhes da solicitação</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2.5 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Status, Priority and Deadline */}
              <div className="flex flex-wrap items-center gap-3">
                <span className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${MAINTENANCE_STATUS_COLORS[selectedRequest.status]}`}>
                  {getStatusIcon(selectedRequest.status)}
                  {MAINTENANCE_STATUS_LABELS[selectedRequest.status]}
                </span>
                <span className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${MAINTENANCE_PRIORITY_COLORS[selectedRequest.prioridade]}`}>
                  {getPriorityIcon(selectedRequest.prioridade)}
                  {MAINTENANCE_PRIORITY_LABELS[selectedRequest.prioridade]}
                </span>
                <span className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center gap-2">
                  <Timer className="w-4 h-4" />
                  {PRIORITY_DEADLINES[selectedRequest.prioridade]}
                </span>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">Solicitante</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{selectedRequest.requesterName}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">Setor</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{selectedRequest.department}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">Local</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{selectedRequest.localOcorrencia}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">Data de Identificação</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatDate(selectedRequest.dataIdentificacao)}</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Descrição do Problema</p>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedRequest.descricao}</p>
                </div>
              </div>

              {/* Impact */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Impacto Operacional</p>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedRequest.impactoOperacional}</p>
                </div>
              </div>

              {/* Images */}
              {selectedRequest.images.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    Autorização do Gestor
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedRequest.images.map((url, index) => (
                      <div
                        key={index}
                        onClick={() => viewImage(url)}
                        className="aspect-square rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-orange-500 transition-all shadow-sm"
                      >
                        <img
                          src={url}
                          alt={`Autorização ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Assigned info */}
              {selectedRequest.assignedTo && (
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase mb-1.5">Atendido por</p>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">{selectedRequest.assignedTo}</p>
                  {selectedRequest.assignedAt && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">
                      Iniciado em {formatDate(selectedRequest.assignedAt)}
                    </p>
                  )}
                </div>
              )}

              {/* Completion notes */}
              {selectedRequest.completionNotes && (
                <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-4 border border-green-200 dark:border-green-800">
                  <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase mb-1.5">Observações de Conclusão</p>
                  <p className="text-sm text-green-800 dark:text-green-200">{selectedRequest.completionNotes}</p>
                </div>
              )}

              {/* Action Buttons */}
              {canManage && (
                <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                  {selectedRequest.status === 'pending' && (
                    <button
                      onClick={() => handleStatusUpdate(selectedRequest.id, 'in_progress', { assignedTo: userProfile?.name || '' })}
                      className="px-5 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium flex items-center gap-2 text-sm shadow-md shadow-blue-500/25"
                    >
                      <Play className="w-4 h-4" />
                      Iniciar Atendimento
                    </button>
                  )}
                  {selectedRequest.status === 'in_progress' && (
                    <button
                      onClick={() => handleStatusUpdate(selectedRequest.id, 'completed')}
                      className="px-5 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-medium flex items-center gap-2 text-sm shadow-md shadow-green-500/25"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Marcar como Concluído
                    </button>
                  )}
                  {(selectedRequest.status === 'pending' || selectedRequest.status === 'in_progress') && (
                    <button
                      onClick={() => handleStatusUpdate(selectedRequest.id, 'cancelled')}
                      className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium flex items-center gap-2 text-sm"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancelar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {showImageViewer && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] cursor-pointer animate-fade-in"
          onClick={() => setShowImageViewer(false)}
        >
          <button
            onClick={() => setShowImageViewer(false)}
            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={currentImage}
            alt="Imagem ampliada"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default MaintenanceRequestManagement;
