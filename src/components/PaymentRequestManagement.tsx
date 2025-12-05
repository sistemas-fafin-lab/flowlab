import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Check, 
  X, 
  User, 
  Building2, 
  Calendar, 
  DollarSign,
  CreditCard,
  Search,
  AlertCircle,
  Clock,
  Trash2
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { usePaymentRequest } from '../hooks/usePaymentRequest';
import { useNotification } from '../hooks/useNotification';
import { useDialog } from '../hooks/useDialog';
import { DEPARTMENTS } from '../utils/permissions';
import { 
  PaymentRequest, 
  PaymentRequestFormValues, 
  PaymentRequestType, 
  PaymentMethod 
} from '../types';
import {
  formatCurrency,
  formatCpfCnpj,
  validateCpfCnpj,
  formatDateDisplay,
  getDayOfWeekName,
  getNextValidDate,
  PAYMENT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS
} from '../utils/paymentUtils';
import Notification from './Notification';
import ConfirmDialog from './ConfirmDialog';

const PaymentRequestManagement: React.FC = () => {
  const { user, userProfile } = useAuth();
  const { 
    paymentRequests, 
    loading, 
    createPedido, 
    updatePaymentRequestStatus,
    deletePaymentRequest,
    getNextPaymentDate 
  } = usePaymentRequest();
  const { notification, showSuccess, showError, showWarning, showInfo, hideNotification } = useNotification();
  const { confirmDialog, showConfirmDialog, hideConfirmDialog, handleConfirmDialogConfirm } = useDialog();

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Suggested date for payment
  const [suggestedDate, setSuggestedDate] = useState<Date | null>(null);

  // Form data
  const [formData, setFormData] = useState<PaymentRequestFormValues>({
    tipoSolicitacao: 'PAGAMENTO',
    documentoNumero: '',
    fornecedor: '',
    cpfCnpj: '',
    valorTotal: 0,
    formaPagamento: 'PIX',
    dadosPagamento: '',
    descricaoDetalhada: '',
    solicitadoPor: userProfile?.name || '',
    autorizadoPor: '',
    dataPagamento: '',
    emailUsuario: user?.email || ''
  });

  // Update form when user profile loads
  useEffect(() => {
    if (userProfile?.name) {
      setFormData(prev => ({
        ...prev,
        solicitadoPor: userProfile.name,
        emailUsuario: user?.email || ''
      }));
    }
  }, [userProfile, user]);

  // Set suggested date on mount
  useEffect(() => {
    const nextDate = getNextPaymentDate();
    setSuggestedDate(nextDate);
  }, []);

  // Filter requests based on user role and filters
  const filteredRequests = paymentRequests.filter(request => {
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    const matchesDepartment = departmentFilter === 'all' || request.department === departmentFilter;
    const matchesDate = !dateFilter || request.dataPagamento === dateFilter;
    const matchesSearch = !searchTerm || 
      request.fornecedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.documentoNumero.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Access control: requesters can only see their own department's requests
    const matchesUserAccess = userProfile?.role === 'admin' || 
                             userProfile?.role === 'operator' || 
                             request.department === userProfile?.department;
    
    return matchesStatus && matchesDepartment && matchesDate && matchesSearch && matchesUserAccess;
  });

  // Check if user can approve/reject requests
  const canApprove = userProfile?.role === 'admin' || userProfile?.role === 'operator';

  // Handle form input changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    
    if (name === 'valorTotal') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else if (name === 'cpfCnpj') {
      // Auto-format CPF/CNPJ
      const formatted = formatCpfCnpj(value);
      setFormData(prev => ({ ...prev, [name]: formatted }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Handle date change with validation feedback
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    setFormData(prev => ({ ...prev, dataPagamento: dateValue }));
    
    if (dateValue) {
      const selectedDate = new Date(dateValue + 'T00:00:00');
      const dayOfWeek = selectedDate.getDay();
      
      if (dayOfWeek !== 2 && dayOfWeek !== 4) {
        showWarning(
          'Data inválida', 
          `A data selecionada (${getDayOfWeekName(selectedDate)}) não é válida. Pagamentos são realizados apenas às terças e quintas-feiras.`
        );
      }
    }
  };

  // Use suggested date
  const useSuggestedDate = () => {
    if (suggestedDate) {
      const dateStr = suggestedDate.toISOString().split('T')[0];
      setFormData(prev => ({ ...prev, dataPagamento: dateStr }));
      showInfo('Data sugerida aplicada', `Data definida para ${formatDateDisplay(suggestedDate)} (${getDayOfWeekName(suggestedDate)})`);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.fornecedor || !formData.valorTotal || !formData.dataPagamento || !formData.autorizadoPor) {
      showError('Campos obrigatórios', 'Preencha todos os campos obrigatórios.');
      return;
    }

    // Validate CPF/CNPJ if provided
    if (formData.cpfCnpj && !validateCpfCnpj(formData.cpfCnpj)) {
      showError('CPF/CNPJ inválido', 'Digite um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createPedido(formData, userProfile?.department || '');

      if (result.success) {
        showSuccess('Pedido criado!', result.message);
        resetForm();
        setShowAddForm(false);
      } else {
        if (result.suggestedDate) {
          setSuggestedDate(result.suggestedDate);
          showWarning(
            'Data de pagamento inválida',
            `${result.message} Sugestão: ${formatDateDisplay(result.suggestedDate)} (${getDayOfWeekName(result.suggestedDate)})`
          );
        } else {
          showError('Erro ao criar pedido', result.error || result.message);
        }
      }
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      showError('Erro', 'Ocorreu um erro ao criar o pedido. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      tipoSolicitacao: 'PAGAMENTO',
      documentoNumero: '',
      fornecedor: '',
      cpfCnpj: '',
      valorTotal: 0,
      formaPagamento: 'PIX',
      dadosPagamento: '',
      descricaoDetalhada: '',
      solicitadoPor: userProfile?.name || '',
      autorizadoPor: '',
      dataPagamento: '',
      emailUsuario: user?.email || ''
    });
  };

  // Handle approve request
  const handleApprove = async (request: PaymentRequest) => {
    showConfirmDialog(
      'Aprovar Solicitação',
      `Deseja aprovar o pedido "${request.codigo}"?`,
      async () => {
        try {
          await updatePaymentRequestStatus(request.id, 'approved', userProfile?.name);
          showSuccess('Pedido aprovado com sucesso!');
        } catch (error) {
          showError('Erro ao aprovar pedido');
        }
      }
    );
  };

  // Handle reject request
  const handleReject = async (request: PaymentRequest) => {
    showConfirmDialog(
      'Rejeitar Solicitação',
      `Deseja rejeitar o pedido "${request.codigo}"? Esta ação não pode ser desfeita.`,
      async () => {
        try {
          await updatePaymentRequestStatus(request.id, 'rejected', undefined, 'Rejeitado pelo operador');
          showSuccess('Pedido rejeitado.');
        } catch (error) {
          showError('Erro ao rejeitar pedido');
        }
      },
      { type: 'danger', confirmText: 'Rejeitar' }
    );
  };

  // Handle mark as paid
  const handleMarkAsPaid = async (request: PaymentRequest) => {
    showConfirmDialog(
      'Marcar como Pago',
      `Confirma que o pedido "${request.codigo}" foi pago?`,
      async () => {
        try {
          await updatePaymentRequestStatus(request.id, 'paid', userProfile?.name);
          showSuccess('Pedido marcado como pago!');
        } catch (error) {
          showError('Erro ao atualizar pedido');
        }
      }
    );
  };

  // Handle delete request
  const handleDelete = async (request: PaymentRequest) => {
    showConfirmDialog(
      'Excluir Solicitação',
      `Deseja excluir o pedido "${request.codigo}"? Esta ação não pode ser desfeita.`,
      async () => {
        try {
          await deletePaymentRequest(request.id);
          showSuccess('Pedido excluído com sucesso!');
        } catch (error) {
          showError('Erro ao excluir pedido');
        }
      },
      { type: 'danger', confirmText: 'Excluir' }
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
        <span className="ml-2 text-gray-600">Carregando solicitações...</span>
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
        onConfirm={handleConfirmDialogConfirm}
        onCancel={hideConfirmDialog}
        type={confirmDialog.type}
      />

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Solicitações de Pagamento</h2>
          <p className="text-gray-600">Gerencie pedidos de pagamento a fornecedores</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Solicitação
        </button>
      </div>

      {/* Info Banner - Payment Days */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
        <AlertCircle className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
        <div>
          <h4 className="font-medium text-blue-800">Dias de Pagamento</h4>
          <p className="text-sm text-blue-700">
            Os pagamentos são realizados apenas às <strong>terças</strong> e <strong>quintas-feiras</strong>, 
            com pelo menos <strong>48 horas</strong> de antecedência.
          </p>
          {suggestedDate && (
            <p className="text-sm text-blue-700 mt-1">
              Próxima data disponível: <strong>{formatDateDisplay(suggestedDate)}</strong> ({getDayOfWeekName(suggestedDate)})
            </p>
          )}
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Nova Solicitação de Pagamento</h3>
            <button
              onClick={() => {
                setShowAddForm(false);
                resetForm();
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Row 1: Tipo e Documento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Solicitação *
                </label>
                <select
                  name="tipoSolicitacao"
                  value={formData.tipoSolicitacao}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.entries(PAYMENT_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número do Documento
                </label>
                <input
                  type="text"
                  name="documentoNumero"
                  value={formData.documentoNumero}
                  onChange={handleInputChange}
                  placeholder="NF, Boleto, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Row 2: Fornecedor e CPF/CNPJ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fornecedor/Beneficiário *
                </label>
                <input
                  type="text"
                  name="fornecedor"
                  value={formData.fornecedor}
                  onChange={handleInputChange}
                  required
                  placeholder="Nome do fornecedor ou beneficiário"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CPF/CNPJ
                </label>
                <input
                  type="text"
                  name="cpfCnpj"
                  value={formData.cpfCnpj}
                  onChange={handleInputChange}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Row 3: Valor e Forma de Pagamento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor Total *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">R$</span>
                  <input
                    type="number"
                    name="valorTotal"
                    value={formData.valorTotal || ''}
                    onChange={handleInputChange}
                    required
                    min="0.01"
                    step="0.01"
                    placeholder="0,00"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Forma de Pagamento *
                </label>
                <select
                  name="formaPagamento"
                  value={formData.formaPagamento}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 4: Dados de Pagamento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dados para Pagamento *
              </label>
              <textarea
                name="dadosPagamento"
                value={formData.dadosPagamento}
                onChange={handleInputChange}
                required
                rows={3}
                placeholder="Chave PIX, dados bancários, código de barras do boleto, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Row 5: Descrição */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição Detalhada *
              </label>
              <textarea
                name="descricaoDetalhada"
                value={formData.descricaoDetalhada}
                onChange={handleInputChange}
                required
                rows={3}
                placeholder="Descreva o motivo do pagamento, serviços prestados, materiais adquiridos, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Row 6: Data de Pagamento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data de Pagamento Desejada *
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  name="dataPagamento"
                  value={typeof formData.dataPagamento === 'string' ? formData.dataPagamento : formData.dataPagamento instanceof Date ? formData.dataPagamento.toISOString().split('T')[0] : ''}
                  onChange={handleDateChange}
                  required
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={useSuggestedDate}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  Usar Data Sugerida
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Lembre-se: apenas terças e quintas-feiras, com 48h de antecedência.
              </p>
            </div>

            {/* Row 7: Solicitante e Autorizador */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Solicitado por
                </label>
                <input
                  type="text"
                  name="solicitadoPor"
                  value={formData.solicitadoPor}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Autorizado por *
                </label>
                <input
                  type="text"
                  name="autorizadoPor"
                  value={formData.autorizadoPor}
                  onChange={handleInputChange}
                  required
                  placeholder="Nome de quem autorizou"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Criando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Solicitação
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Fornecedor, código..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="pending">Pendente</option>
              <option value="approved">Aprovado</option>
              <option value="rejected">Rejeitado</option>
              <option value="paid">Pago</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>

          {canApprove && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Departamento</label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos</option>
                {DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data Pagamento</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-end">
            <span className="text-sm text-gray-600">
              {filteredRequests.length} solicitação(ões)
            </span>
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma solicitação encontrada</h3>
            <p className="text-gray-500">Crie uma nova solicitação de pagamento para começar.</p>
          </div>
        ) : (
          filteredRequests.map((request) => (
            <div key={request.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <DollarSign className="w-6 h-6 text-green-600 mr-3" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{request.codigo}</h3>
                    <p className="text-sm text-gray-500">Criado em {formatDateDisplay(request.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${PAYMENT_STATUS_COLORS[request.status]}`}>
                    {PAYMENT_STATUS_LABELS[request.status]}
                  </span>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="flex items-center">
                  <Building2 className="w-4 h-4 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">Fornecedor</p>
                    <p className="font-medium text-gray-800">{request.fornecedor}</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <CreditCard className="w-4 h-4 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">Valor</p>
                    <p className="font-medium text-green-600">{formatCurrency(request.valorTotal)}</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">Data Pagamento</p>
                    <p className="font-medium text-gray-800">{formatDateDisplay(request.dataPagamento)}</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <User className="w-4 h-4 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">Solicitante</p>
                    <p className="font-medium text-gray-800">{request.solicitadoPor}</p>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500">Tipo</p>
                  <p className="text-sm font-medium">{PAYMENT_TYPE_LABELS[request.tipoSolicitacao]}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Forma de Pagamento</p>
                  <p className="text-sm font-medium">{PAYMENT_METHOD_LABELS[request.formaPagamento]}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Departamento</p>
                  <p className="text-sm font-medium">{request.department || 'N/A'}</p>
                </div>
              </div>

              {/* Description */}
              {request.descricaoDetalhada && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">Descrição:</p>
                  <p className="text-gray-800 bg-gray-100 p-3 rounded-lg text-sm">{request.descricaoDetalhada}</p>
                </div>
              )}

              {/* Payment Data */}
              {request.dadosPagamento && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">Dados para Pagamento:</p>
                  <p className="text-gray-800 bg-blue-50 p-3 rounded-lg text-sm font-mono">{request.dadosPagamento}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
                {canApprove && request.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleApprove(request)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center text-sm"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Aprovar
                    </button>
                    <button
                      onClick={() => handleReject(request)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center text-sm"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Rejeitar
                    </button>
                  </>
                )}
                
                {canApprove && request.status === 'approved' && (
                  <button
                    onClick={() => handleMarkAsPaid(request)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm"
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Marcar como Pago
                  </button>
                )}

                {canApprove && (request.status === 'pending' || request.status === 'rejected') && (
                  <button
                    onClick={() => handleDelete(request)}
                    className="px-4 py-2 bg-gray-100 text-red-600 rounded-lg hover:bg-gray-200 transition-colors flex items-center text-sm"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </button>
                )}

                {request.pdfUrl && (
                  <a
                    href={request.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center text-sm"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Ver PDF
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PaymentRequestManagement;
