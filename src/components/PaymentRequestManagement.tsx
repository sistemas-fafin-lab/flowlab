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
  Trash2,
  Printer,
  Sparkles
} from 'lucide-react';
import jsPDF from 'jspdf';
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

  // Generate PDF receipt for a payment request
  const generatePDF = (request: PaymentRequest) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    const footerHeight = 25;
    const maxContentY = pageHeight - footerHeight - 10;
    
    // Colors - Navy Blue theme
    const primaryColor: [number, number, number] = [30, 58, 138]; // blue-900
    const secondaryColor: [number, number, number] = [59, 130, 246]; // blue-500
    const lightBg: [number, number, number] = [241, 245, 249]; // slate-100
    const textDark: [number, number, number] = [30, 41, 59]; // slate-800
    const textLight: [number, number, number] = [100, 116, 139]; // slate-500

    // Helper function to check if we need a new page
    const checkNewPage = (neededHeight: number, currentY: number): number => {
      if (currentY + neededHeight > maxContentY) {
        doc.addPage();
        return 20; // Reset Y position for new page
      }
      return currentY;
    };

    // Helper function to add section header
    const addSectionHeader = (title: string, y: number): number => {
      const newY = checkNewPage(15, y);
      doc.setFillColor(...lightBg);
      doc.roundedRect(margin, newY, contentWidth, 8, 2, 2, 'F');
      doc.setTextColor(...primaryColor);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin + 5, newY + 5.5);
      return newY + 12;
    };

    // Helper function to add field with dynamic height
    const addField = (label: string, value: string, x: number, y: number, maxWidth: number = 75): number => {
      doc.setTextColor(...textLight);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(label, x, y);
      
      doc.setTextColor(...textDark);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const lines = doc.splitTextToSize(value || '-', maxWidth);
      doc.text(lines, x, y + 4);
      return lines.length * 4 + 6;
    };

    // ========== HEADER ==========
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setFillColor(...secondaryColor);
    doc.rect(0, 40, pageWidth, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('FLOW LAB', margin + 5, 18);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Sistema de Gestão de Pagamentos', margin + 5, 28);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(request.codigo, pageWidth - margin - 5, 18, { align: 'right' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Emitido: ${formatDateDisplay(new Date())}`, pageWidth - margin - 5, 28, { align: 'right' });

    // ========== TITLE ==========
    let yPos = 52;
    doc.setTextColor(...primaryColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('COMPROVANTE DE SOLICITAÇÃO DE PAGAMENTO', pageWidth / 2, yPos, { align: 'center' });
    
    // Status badge
    yPos += 10;
    const statusText = PAYMENT_STATUS_LABELS[request.status];
    doc.setFontSize(8);
    const statusWidth = doc.getTextWidth(statusText.toUpperCase()) + 12;
    const statusX = (pageWidth - statusWidth) / 2;
    
    let statusBgColor: [number, number, number];
    let statusTextColor: [number, number, number] = [255, 255, 255];
    switch (request.status) {
      case 'approved': statusBgColor = [34, 197, 94]; break;
      case 'paid': statusBgColor = [59, 130, 246]; break;
      case 'rejected': statusBgColor = [239, 68, 68]; break;
      case 'cancelled': statusBgColor = [107, 114, 128]; break;
      default: statusBgColor = [251, 191, 36]; statusTextColor = [30, 41, 59];
    }
    
    doc.setFillColor(...statusBgColor);
    doc.roundedRect(statusX, yPos - 5, statusWidth, 8, 2, 2, 'F');
    doc.setTextColor(...statusTextColor);
    doc.setFont('helvetica', 'bold');
    doc.text(statusText.toUpperCase(), pageWidth / 2, yPos, { align: 'center' });

    // ========== DADOS DO PAGAMENTO ==========
    yPos += 12;
    yPos = addSectionHeader('DADOS DO PAGAMENTO', yPos);
    
    // Row 1
    const col1X = margin + 5;
    const col2X = pageWidth / 2 + 5;
    const colWidth = (contentWidth / 2) - 10;
    
    addField('Tipo de Solicitação', PAYMENT_TYPE_LABELS[request.tipoSolicitacao] || request.tipoSolicitacao, col1X, yPos, colWidth);
    addField('Nº Documento', request.documentoNumero || 'Não informado', col2X, yPos, colWidth);
    yPos += 14;
    
    // Row 2
    yPos = checkNewPage(20, yPos);
    addField('Fornecedor/Beneficiário', request.fornecedor, col1X, yPos, colWidth);
    addField('CPF/CNPJ', request.cpfCnpj || 'Não informado', col2X, yPos, colWidth);
    yPos += 14;
    
    // Row 3 - Valor destacado
    yPos = checkNewPage(25, yPos);
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(margin, yPos - 3, colWidth + 10, 16, 2, 2, 'F');
    doc.setTextColor(...textLight);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Valor Total', col1X, yPos);
    doc.setTextColor(22, 163, 74);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(request.valorTotal), col1X, yPos + 8);
    
    addField('Forma de Pagamento', PAYMENT_METHOD_LABELS[request.formaPagamento] || request.formaPagamento, col2X, yPos, colWidth);
    yPos += 18;
    
    // Row 4
    yPos = checkNewPage(20, yPos);
    addField('Data de Pagamento', formatDateDisplay(request.dataPagamento), col1X, yPos, colWidth);
    addField('Departamento', request.department || 'Não informado', col2X, yPos, colWidth);
    yPos += 16;

    // ========== DADOS PARA PAGAMENTO ==========
    yPos = addSectionHeader('DADOS PARA PAGAMENTO', yPos);
    
    const paymentDataLines = doc.splitTextToSize(request.dadosPagamento || 'Não informado', contentWidth - 10);
    const paymentBoxHeight = Math.max(paymentDataLines.length * 4 + 8, 16);
    
    yPos = checkNewPage(paymentBoxHeight + 5, yPos);
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(...secondaryColor);
    doc.roundedRect(margin, yPos - 2, contentWidth, paymentBoxHeight, 2, 2, 'FD');
    doc.setTextColor(...textDark);
    doc.setFontSize(9);
    doc.setFont('courier', 'normal');
    doc.text(paymentDataLines, margin + 5, yPos + 4);
    yPos += paymentBoxHeight + 8;

    // ========== DESCRIÇÃO DETALHADA ==========
    yPos = addSectionHeader('DESCRIÇÃO DETALHADA', yPos);
    
    const descLines = doc.splitTextToSize(request.descricaoDetalhada || 'Não informado', contentWidth - 10);
    const descHeight = descLines.length * 4 + 4;
    
    yPos = checkNewPage(descHeight + 5, yPos);
    doc.setTextColor(...textDark);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(descLines, margin + 5, yPos);
    yPos += descHeight + 10;

    // ========== RESPONSÁVEIS ==========
    yPos = addSectionHeader('RESPONSÁVEIS', yPos);
    yPos = checkNewPage(30, yPos);
    
    const sigWidth = (contentWidth - 20) / 2;
    
    // Solicitante
    doc.setTextColor(...textDark);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(request.solicitadoPor || '-', margin + 5 + sigWidth / 2, yPos + 5, { align: 'center' });
    doc.setDrawColor(180, 180, 180);
    doc.line(margin + 5, yPos + 12, margin + 5 + sigWidth, yPos + 12);
    doc.setTextColor(...textLight);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Solicitado por', margin + 5 + sigWidth / 2, yPos + 17, { align: 'center' });
    
    // Autorizador
    const sig2X = margin + 15 + sigWidth;
    doc.setTextColor(...textDark);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(request.autorizadoPor || '-', sig2X + sigWidth / 2, yPos + 5, { align: 'center' });
    doc.setDrawColor(180, 180, 180);
    doc.line(sig2X, yPos + 12, sig2X + sigWidth, yPos + 12);
    doc.setTextColor(...textLight);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Autorizado por', sig2X + sigWidth / 2, yPos + 17, { align: 'center' });

    // ========== FOOTER (em todas as páginas) ==========
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      const footerY = pageHeight - footerHeight;
      
      doc.setFillColor(...primaryColor);
      doc.rect(0, footerY, pageWidth, footerHeight, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('Este documento é um comprovante oficial de solicitação de pagamento.', pageWidth / 2, footerY + 8, { align: 'center' });
      doc.text(`Criado em: ${formatDateDisplay(request.createdAt)} | Sistema Flow LAB | Página ${i} de ${totalPages}`, pageWidth / 2, footerY + 14, { align: 'center' });
    }
    
    // Save PDF
    const fileName = `comprovante-${request.codigo.replace(/[/\s]/g, '-')}.pdf`;
    doc.save(fileName);
    
    showSuccess('PDF gerado!', `Comprovante "${fileName}" foi baixado com sucesso.`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent shadow-md"></div>
        <span className="mt-4 text-gray-600 font-medium">Carregando solicitações...</span>
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
      <div className="flex justify-between items-center animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Solicitações de Pagamento</h2>
          <p className="text-gray-500 mt-1">Gerencie pedidos de pagamento a fornecedores</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 flex items-center shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30 font-medium"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Solicitação
        </button>
      </div>

      {/* Info Banner - Payment Days */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 flex items-start animate-fade-in-up shadow-sm" style={{ animationDelay: '0.1s' }}>
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/25 flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-white" />
        </div>
        <div className="ml-4">
          <h4 className="font-semibold text-blue-800">Dias de Pagamento</h4>
          <p className="text-sm text-blue-700 mt-1">
            Os pagamentos são realizados apenas às <strong>terças</strong> e <strong>quintas-feiras</strong>, 
            com pelo menos <strong>48 horas</strong> de antecedência.
          </p>
          {suggestedDate && (
            <p className="text-sm text-blue-700 mt-2 bg-white/60 px-3 py-1.5 rounded-lg inline-block">
              Próxima data disponível: <strong>{formatDateDisplay(suggestedDate)}</strong> ({getDayOfWeekName(suggestedDate)})
            </p>
          )}
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-scale-in">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/25 mr-3">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Nova Solicitação de Pagamento</h3>
            </div>
            <button
              onClick={() => {
                setShowAddForm(false);
                resetForm();
              }}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
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
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50 cursor-pointer"
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
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
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
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
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
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
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
                  <span className="absolute left-4 top-2.5 text-gray-500 font-medium">R$</span>
                  <input
                    type="number"
                    name="valorTotal"
                    value={formData.valorTotal || ''}
                    onChange={handleInputChange}
                    required
                    min="0.01"
                    step="0.01"
                    placeholder="0,00"
                    className="w-full pl-12 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
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
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50 cursor-pointer"
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
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50 resize-none"
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
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50 resize-none"
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
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={useSuggestedDate}
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400 text-amber-900 rounded-xl hover:from-amber-500 hover:via-yellow-500 hover:to-amber-500 transition-all duration-200 text-sm font-semibold flex items-center shadow-md shadow-amber-400/30 hover:shadow-lg hover:shadow-amber-400/40 animate-pulse hover:animate-none border border-amber-300"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Usar Data Sugerida
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
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
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-100 text-gray-600"
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
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
                />
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}
                className="px-5 py-2.5 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center font-medium shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30"
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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
            <div className="relative">
              <Search className="absolute left-4 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Fornecedor, código..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50 cursor-pointer"
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
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50 cursor-pointer"
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
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50 cursor-pointer"
            />
          </div>

          <div className="flex items-end">
            <span className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">
              {filteredRequests.length} solicitação(ões)
            </span>
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center animate-fade-in-up">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma solicitação encontrada</h3>
            <p className="text-gray-500">Crie uma nova solicitação de pagamento para começar.</p>
          </div>
        ) : (
          filteredRequests.map((request, index) => (
            <div 
              key={request.id} 
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:border-blue-100 transition-all duration-300 animate-fade-in-up group"
              style={{ animationDelay: `${Math.min(index * 0.05, 0.25)}s` }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mr-4 shadow-md shadow-green-500/25 group-hover:scale-110 transition-transform duration-300">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">{request.codigo}</h3>
                    <p className="text-sm text-gray-500">Criado em {formatDateDisplay(request.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1.5 text-sm font-medium rounded-xl ${PAYMENT_STATUS_COLORS[request.status]}`}>
                    {PAYMENT_STATUS_LABELS[request.status]}
                  </span>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="flex items-center group/item">
                  <Building2 className="w-4 h-4 text-gray-400 mr-2 group-hover/item:text-blue-500 transition-colors" />
                  <div>
                    <p className="text-sm text-gray-500">Fornecedor</p>
                    <p className="font-medium text-gray-800">{request.fornecedor}</p>
                  </div>
                </div>

                <div className="flex items-center group/item">
                  <CreditCard className="w-4 h-4 text-gray-400 mr-2 group-hover/item:text-green-500 transition-colors" />
                  <div>
                    <p className="text-sm text-gray-500">Valor</p>
                    <p className="font-semibold text-green-600">{formatCurrency(request.valorTotal)}</p>
                  </div>
                </div>

                <div className="flex items-center group/item">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2 group-hover/item:text-blue-500 transition-colors" />
                  <div>
                    <p className="text-sm text-gray-500">Data Pagamento</p>
                    <p className="font-medium text-gray-800">{formatDateDisplay(request.dataPagamento)}</p>
                  </div>
                </div>

                <div className="flex items-center group/item">
                  <User className="w-4 h-4 text-gray-400 mr-2 group-hover/item:text-blue-500 transition-colors" />
                  <div>
                    <p className="text-sm text-gray-500">Solicitante</p>
                    <p className="font-medium text-gray-800">{request.solicitadoPor}</p>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl">
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
                  <p className="text-gray-800 bg-gray-100 p-4 rounded-xl text-sm">{request.descricaoDetalhada}</p>
                </div>
              )}

              {/* Payment Data */}
              {request.dadosPagamento && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">Dados para Pagamento:</p>
                  <p className="text-gray-800 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl text-sm font-mono border border-blue-100">{request.dadosPagamento}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-gray-100">
                <div className="flex flex-wrap gap-2">
                  {canApprove && request.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleApprove(request)}
                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-200 flex items-center text-sm font-medium shadow-md shadow-green-500/25 hover:shadow-lg"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Aprovar
                      </button>
                      <button
                        onClick={() => handleReject(request)}
                        className="px-4 py-2 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl hover:from-red-600 hover:to-rose-600 transition-all duration-200 flex items-center text-sm font-medium shadow-md shadow-red-500/25 hover:shadow-lg"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Rejeitar
                      </button>
                    </>
                  )}
                  
                  {canApprove && request.status === 'approved' && (
                    <button
                      onClick={() => handleMarkAsPaid(request)}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 flex items-center text-sm font-medium shadow-md shadow-blue-500/25 hover:shadow-lg"
                    >
                      <DollarSign className="w-4 h-4 mr-2" />
                      Marcar como Pago
                    </button>
                  )}

                  {canApprove && (request.status === 'pending' || request.status === 'rejected') && (
                    <button
                      onClick={() => handleDelete(request)}
                      className="px-4 py-2 bg-gray-100 text-red-600 rounded-xl hover:bg-red-50 transition-all duration-200 flex items-center text-sm font-medium"
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
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200 flex items-center text-sm font-medium"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Ver PDF
                    </a>
                  )}
                </div>

                {/* Print PDF Button - Always visible on the right */}
                <button
                  onClick={() => generatePDF(request)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-900 to-indigo-800 text-white rounded-xl hover:from-blue-800 hover:to-indigo-700 transition-all duration-200 flex items-center text-sm font-medium shadow-md shadow-blue-900/25 hover:shadow-lg"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir Comprovante
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PaymentRequestManagement;
