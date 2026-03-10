import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { FileText, Plus, Check, X, User, Package, Building2, Calendar, Download, Search, Filter as FilterIcon, Trash2, Bold, Italic, List, AlertTriangle, Paperclip, FileUp, Eye, Image, Clock, CheckCircle2, XCircle, Play } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { useDialog } from '../hooks/useDialog';
import { DEPARTMENTS } from '../utils/permissions';
import { Request, RequestItem } from '../types';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Notification from './Notification';
import ConfirmDialog from './ConfirmDialog';
import RequestChat, { ChatButton } from './RequestChat';
import SignatureModal from './SignatureModal';
import SignatureViewModal from './SignatureViewModal';
import StockWithdrawalModal from './StockWithdrawalModal';
import { PenTool, Loader2 } from 'lucide-react';


const RequestManagement: React.FC = () => {
  const { user, userProfile } = useAuth();
  const { 
    requests, 
    products, 
    suppliers, 
    addRequest, 
    updateRequestStatus, 
    addMovement, 
    createQuotation 
  } = useInventory();

  const { notification, showSuccess, showError, showWarning, showInfo, hideNotification } = useNotification();
  const { confirmDialog, showConfirmDialog, hideConfirmDialog, handleConfirmDialogConfirm } = useDialog();
  
  const [showAddRequest, setShowAddRequest] = useState(false);
  const [showTypeSelectionModal, setShowTypeSelectionModal] = useState(false);
  const [selectedRequestType, setSelectedRequestType] = useState<'SC' | 'SM'>('SM');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [newRequest, setNewRequest] = useState({
    type: 'SM' as 'SC' | 'SM',
    items: [] as RequestItem[],
    reason: '',
    priority: 'standard' as 'standard' | 'priority' | 'urgent',
    requestedBy: userProfile?.name || '',
    department: userProfile?.department || '',
    supplierId: null as string | null
  });

  const [chatRequestId, setChatRequestId] = useState<string | null>(null);

  const [showSignatureModal, setShowSignatureModal] = useState<null | Request>(null);
  
  // Estado para controlar o modal de baixa de estoque seguro
  const [showWithdrawalModal, setShowWithdrawalModal] = useState<null | Request>(null);
  
  // Estados para prevenir duplicidade de processamento
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [processedRequestIds, setProcessedRequestIds] = useState<Set<string>>(new Set());

  const [viewSignature, setViewSignature] = useState<{name: string; signature: string} | null>(null);

  // Estados para adicionar produtos
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'general' | 'technical'>('all');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Attachment state
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState<(string | null)[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Image viewer state
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [currentImageName, setCurrentImageName] = useState<string>('');

  const statusLabels = {
    'pending': 'Pendente',
    'approved': 'Aprovado',
    'rejected': 'Rejeitado',
    'completed': 'Concluído'
  };

  const typeLabels = {
    'SC': 'Solicitação de Compra',
    'SM': 'Solicitação de Material'
  };

  const typeColors = {
    'SC': 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-700',
    'SM': 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700'
  };

  const statusColors = {
    'pending': 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700',
    'approved': 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-700',
    'rejected': 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-700',
    'completed': 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700'
  };

  const priorityLabels = {
    'standard': 'Padrão',
    'priority': 'Prioritário',
    'urgent': 'Urgente'
  };

  const priorityColors = {
  'standard': 'bg-gray-100 dark:bg-gray-700/50 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600',
  'priority': 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 border border-orange-200 dark:border-orange-700',
  'urgent': 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-700'
  };

  const [categories, setCategories] = useState<string[]>([]);
  const [requestPeriod, setRequestPeriod] = useState<{ start_day: number; end_day: number } | null>(null);
  const [isPeriodOpen, setIsPeriodOpen] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('category');
  
      if (!error && data) {
        const unique = [...new Set(data.map(item => item.category))];
        setCategories(unique);
      }
    };
  
    fetchCategories();
  }, []);

// Departamentos que utilizam o período especial (Área Técnica)
const SPECIAL_PERIOD_DEPARTMENTS = ['Área técnica', 'Biologia Molecular', 'Qualidade', 'Transporte'];

useEffect(() => {
  const checkRequestPeriod = async () => {
    if (userProfile?.role !== 'requester') return;

    const userDepartment = userProfile?.department as string;
    const department = SPECIAL_PERIOD_DEPARTMENTS.includes(userDepartment) ? 'Área técnica' : 'general';

    const { data, error } = await supabase
      .from('request_periods')
      .select('*')
      .eq('department', department)
      .maybeSingle();

    if (error || !data) {
      setIsPeriodOpen(true); // Se não há configuração, permite solicitações
      return;
    }

    setRequestPeriod(data);

    const today = new Date().getDate();
    const isOpen = today >= data.start_day && today <= data.end_day;
    setIsPeriodOpen(isOpen);
  };

  checkRequestPeriod();
}, [userProfile]);

  const handleNewRequestClick = () => {
    setShowTypeSelectionModal(true);
  };

  const handleTypeSelection = (type: 'SC' | 'SM') => {
    setSelectedRequestType(type);
    setNewRequest(prev => ({ ...prev, type }));
    setShowTypeSelectionModal(false);
    
    // Para SC, sempre permitir. Para SM, verificar período
    if (type === 'SC' || isPeriodOpen || userProfile?.role !== 'requester') {
      setShowAddRequest(true);
    } else {
      showInfo(
        'Período fechado',
        `Solicitações de Material só são permitidas entre os dias ${requestPeriod?.start_day} e ${requestPeriod?.end_day} de cada mês.`
      );
    }
  };


  // Filtrar produtos para busca
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                         product.code.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    const hasStock = product.quantity > 0;
    return matchesSearch && matchesCategory && hasStock;
  });

  // Filtrar solicitações baseado no perfil do usuário
  const filteredRequests = requests.filter(request => {
    // Status filter: usa cards clicáveis OU dropdown
    const matchesStatus = selectedStatusFilters.size > 0 
      ? selectedStatusFilters.has(request.status)
      : (statusFilter === 'all' || request.status === statusFilter);
    const matchesType = typeFilter === 'all' || request.type === typeFilter;
    const matchesDepartment = departmentFilter === 'all' || request.department === departmentFilter;
    const matchesDate = !dateFilter || request.requestDate === dateFilter;
    
    // Pesquisa inteligente - busca em múltiplos campos
    const matchesSearch = !searchQuery || (
      request.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.requestedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (request.department && request.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (request.approvedBy && request.approvedBy.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (request.supplierName && request.supplierName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      request.items.some(item => 
        item.productName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
    
    // Se for admin ou operator, pode ver todas as solicitações
    // Se for requester, só pode ver as do seu departamento
    const matchesUserAccess = userProfile?.role === 'admin' || 
                             userProfile?.role === 'operator' || 
                             request.department === userProfile?.department;
    
    return matchesStatus && matchesType && matchesDepartment && matchesDate && matchesSearch && matchesUserAccess;
  });

  // Toggle status filter via cards (multi-select)
  const toggleStatusCardFilter = (status: string) => {
    setSelectedStatusFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      // Limpa o filtro dropdown quando usar cards
      if (newSet.size > 0) {
        setStatusFilter('all');
      }
      return newSet;
    });
  };

  // Limpar filtros de cards
  const clearStatusCardFilters = () => {
    setSelectedStatusFilters(new Set());
  };

  // Adiciona produto existente
  const addProductToRequest = () => {
    if (!selectedProduct) return;
    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;

    const alreadyAdded = newRequest.items.some(
      (item) => item.productId === product.id
    );
    if (alreadyAdded) {
      showError('Produto já adicionado');
      return;
    }

    const newItem: RequestItem = {
      id: Date.now().toString(),
      productId: product.id,
      productName: product.name,
      quantity: selectedQuantity,
      category: product.category || 'não definida',
    };

    setNewRequest((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));

    setSelectedProduct('');
    setSelectedQuantity(1);
    setProductSearch('');
  };
    
  // Adiciona produto não cadastrado
  const handleAddUnregisteredProduct = () => {
    if (!productSearch.trim()) {
      showError('Nome do produto inválido');
      return;
    }

    if (
      newRequest.items.some(
        (item) =>
          item.productName.toLowerCase().trim() ===
          productSearch.toLowerCase().trim()
      )
    ) {
      showError('Produto já adicionado à solicitação');
      return;
    }

    const newItem: RequestItem = {
      id: Date.now().toString(),
      productId: null,
      productName: productSearch.trim(),
      quantity: selectedQuantity,
      category: 'não cadastrado',
    };

    setNewRequest((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));

    setSelectedProduct('');
    setSelectedQuantity(1);
    setProductSearch('');
  };

  const removeProductFromRequest = (itemId: string) => {
    setNewRequest(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
  };

  // Handle file attachments (multiple)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const maxSize = 10 * 1024 * 1024;
    const validFiles: File[] = [];

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        showError('Tipo de arquivo inválido', `"${file.name}": apenas PDF, PNG e JPEG são permitidos.`);
        continue;
      }
      if (file.size > maxSize) {
        showError('Arquivo muito grande', `"${file.name}" excede 10MB.`);
        continue;
      }
      validFiles.push(file);
    }

    if (!validFiles.length) return;

    setAttachments(prev => [...prev, ...validFiles]);

    validFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAttachmentPreviews(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachmentPreviews(prev => [...prev, null]);
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Remove individual attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    setAttachmentPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Open image viewer
  const openImageViewer = (imageUrl: string, imageName: string) => {
    setCurrentImageUrl(imageUrl);
    setCurrentImageName(imageName);
    setImageViewerOpen(true);
  };

  // Close image viewer
  const closeImageViewer = () => {
    setImageViewerOpen(false);
    setCurrentImageUrl(null);
    setCurrentImageName('');
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newRequest.items.length === 0) {
      showError('Adicione pelo menos um produto à solicitação');
      return;
    }

    try {
      await addRequest({
        type: newRequest.type,
        items: newRequest.items,
        reason: newRequest.reason,
        priority: newRequest.priority,
        requestedBy: userProfile?.name || '',
        requestDate: new Date().toISOString().split('T')[0],
        department: userProfile?.department || '',
        supplierId: newRequest.supplierId,
        supplierName: newRequest.supplierId ? suppliers.find(s => s.id === newRequest.supplierId)?.name : undefined,
        status: 'pending'
      }, attachments);

      setNewRequest({
        type: 'SM',
        items: [],
        reason: '',
        priority: 'standard',
        requestedBy: userProfile?.name || '',
        department: userProfile?.department || '',
        supplierId: null
      });
      setAttachments([]);
      setAttachmentPreviews([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setShowAddRequest(false);
      showSuccess('Solicitação criada com sucesso!');
    } catch (error) {
      console.error('Erro ao criar solicitação:', error);
      showError('Erro ao criar solicitação. Tente novamente.');
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    showConfirmDialog(
      'Aprovar Solicitação',
      'Tem certeza que deseja aprovar esta solicitação?',
      async () => {
        try {
          await updateRequestStatus(requestId, 'approved', userProfile?.name);
          showSuccess('Solicitação aprovada com sucesso!');
        } catch (error) {
          console.error('Erro ao aprovar solicitação:', error);
          showError('Erro ao aprovar solicitação. Tente novamente.');
        }
      }
    );
  };

  const handleRejectRequest = async (requestId: string) => {
    showConfirmDialog(
      'Rejeitar Solicitação',
      'Tem certeza que deseja rejeitar esta solicitação?',
      async () => {
        try {
          await updateRequestStatus(requestId, 'rejected');
          showSuccess('Solicitação rejeitada.');
        } catch (error) {
          console.error('Erro ao rejeitar solicitação:', error);
          showError('Erro ao rejeitar solicitação. Tente novamente.');
        }
      },
      { type: 'danger', confirmText: 'Rejeitar' }
    );
  };

const handleCompleteRequest = async (request: Request) => {
  // Verificação 1: Verificar se a solicitação já foi processada nesta sessão
  if (processedRequestIds.has(request.id)) {
    showWarning('Esta solicitação já foi processada nesta sessão.');
    return;
  }
  
  // Verificação 2: Verificar se já existe um processamento em andamento
  if (processingRequestId === request.id) {
    showWarning('Esta solicitação já está sendo processada.');
    return;
  }
  
  // Verificação 3: Verificar status atual no banco de dados
  try {
    const { data: currentRequest, error } = await supabase
      .from('requests')
      .select('status, received_by, receiver_signature')
      .eq('id', request.id)
      .single();
    
    if (error) {
      console.error('Erro ao verificar status da solicitação:', error);
      showError('Erro ao verificar status da solicitação.');
      return;
    }
    
    // Se já está completo, não permitir nova baixa
    if (currentRequest.status === 'completed') {
      showWarning('Esta solicitação já foi concluída anteriormente.');
      setProcessedRequestIds(prev => new Set([...prev, request.id]));
      return;
    }
    
    // Se já tem assinatura, provavelmente já foi processada
    if (currentRequest.receiver_signature) {
      showWarning('Esta solicitação já possui registro de retirada.');
      return;
    }
    
    // Verificação 4: Verificar se existem movimentações para esta solicitação
    const { data: existingMovements, error: movError } = await supabase
      .from('stock_movements')
      .select('id')
      .eq('request_id', request.id);
    
    if (!movError && existingMovements && existingMovements.length > 0) {
      showWarning(`Esta solicitação já possui ${existingMovements.length} movimentação(ões) registrada(s).`);
      setProcessedRequestIds(prev => new Set([...prev, request.id]));
      return;
    }
    
  } catch (err) {
    console.error('Erro na verificação prévia:', err);
    showError('Erro ao verificar solicitação. Tente novamente.');
    return;
  }
  
  // Se passou todas as verificações, abrir o modal de confirmação seguro
  setShowWithdrawalModal(request);
};

  const handleStartQuotation = async (request: Request) => {
    try {
      // Verificar se há fornecedores ativos
      const activeSuppliers = suppliers.filter(s => s.status === 'active');
      
      if (activeSuppliers.length === 0) {
        showWarning('Nenhum fornecedor ativo encontrado. Cadastre fornecedores antes de criar cotações.');
        return;
      }

      // Deduplicar itens por productId para evitar cotações duplicadas
      const uniqueItems = request.items.filter((item, index, self) =>
        index === self.findIndex((i) => i.productId === item.productId)
      );

      console.log(`Criando ${uniqueItems.length} cotação(ões) para requisição ${request.id}`);

      // Criar UMA cotação para cada PRODUTO da requisição
      for (const item of uniqueItems) {
        await createQuotation({
          requestId: request.id,
          productId: item.productId,
          productName: item.productName,
          requestedQuantity: item.quantity
        });
      }

      showSuccess(`${uniqueItems.length} cotação(ões) criada(s)! Vá para a aba de Cotações para solicitar propostas dos fornecedores.`);
    } catch (error) {
      console.error('Erro ao criar cotação:', error);
      showError('Erro ao criar cotação. Tente novamente.');
    }
  };

  const generateReport = () => {
    const reportData = filteredRequests.map(request => ({
      id: request.id,
      produtos: request.items.map(item => `${item.productName} (${item.quantity})`).join('; '),
      prioridade: priorityLabels[request.priority],
      solicitante: request.requestedBy,
      departamento: request.department || 'N/A',
      status: statusLabels[request.status],
      data_solicitacao: request.requestDate,
      aprovado_por: request.approvedBy || 'N/A',
      data_aprovacao: request.approvalDate || 'N/A',
      fornecedor: request.supplierName || 'N/A'
    }));

    const csvContent = [
      Object.keys(reportData[0] || {}).join(','),
      ...reportData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_solicitacoes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showSuccess('Relatório exportado com sucesso!');
  };

  const canApprove = userProfile?.role === 'admin' || userProfile?.role === 'operator';
  
      const matchedProduct = products.find(
        (p) => p.name.toLowerCase().trim() === productSearch.toLowerCase().trim()
      );

  const applyFormatting = (startTag: string, endTag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = newRequest.reason;
    const selectedText = text.substring(start, end);

    const newText = text.substring(0, start) + startTag + selectedText + endTag + text.substring(end);

    setNewRequest(prev => ({ ...prev, reason: newText }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + startTag.length, end + startTag.length);
    }, 0);
  };

  const insertBulletPoint = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const text = newRequest.reason;
    const beforeCursor = text.substring(0, start);
    const afterCursor = text.substring(start);

    const needsNewline = beforeCursor.length > 0 && !beforeCursor.endsWith('\n');
    const bullet = (needsNewline ? '\n' : '') + '• ';

    const newText = beforeCursor + bullet + afterCursor;
    setNewRequest(prev => ({ ...prev, reason: newText }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + bullet.length, start + bullet.length);
    }, 0);
  };

  const renderFormattedText = (text: string) => {
    let formatted = text;

    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
    formatted = formatted.replace(/\n/g, '<br />');

    return <div dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  return (
    <div className="space-y-6 overflow-x-hidden">
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

      {/* Image Viewer Modal */}
      {imageViewerOpen && currentImageUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in p-2 sm:p-4"
          onClick={closeImageViewer}
        >
          <div className="relative w-full h-full max-w-7xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-2 sm:mb-4 px-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Image className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-white font-semibold text-sm sm:text-lg truncate">{currentImageName}</h3>
                  <p className="text-white/60 text-xs sm:text-sm hidden sm:block">Clique fora da imagem para fechar</p>
                </div>
              </div>
              <button
                onClick={closeImageViewer}
                className="w-8 h-8 sm:w-10 sm:h-10 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-all group flex-shrink-0 ml-2"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:scale-110 transition-transform" />
              </button>
            </div>

            {/* Image Container */}
            <div 
              className="flex-1 flex items-center justify-center overflow-hidden min-h-0"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={currentImageUrl}
                alt={currentImageName}
                className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 mt-2 sm:mt-4 flex-shrink-0">
              <a
                href={currentImageUrl}
                download={currentImageName}
                className="px-3 py-2 sm:px-4 sm:py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center gap-2 transition-all text-xs sm:text-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Download</span>
                <span className="sm:hidden">Baixar</span>
              </a>
              <a
                href={currentImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 sm:px-4 sm:py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center gap-2 transition-all text-xs sm:text-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Abrir em nova aba</span>
                <span className="sm:hidden">Nova aba</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">Gerenciamento de Solicitações</h2>
          <p className="text-gray-500 dark:text-gray-400">Controle de requisições para retirada de materiais</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={generateReport}
            className="px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-200 flex items-center justify-center font-medium shadow-md shadow-green-500/25 hover:shadow-lg hover:shadow-green-500/30 text-sm sm:text-base"
          >
            <Download className="w-4 h-4 mr-2" />
            Relatório
          </button>
          <button
            onClick={() => {
              handleNewRequestClick();
            }}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 flex items-center justify-center transition-all duration-200 font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 text-base"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Solicitação
          </button>
        </div>
      </div>

      {/* Add Request Form */}
      {showAddRequest && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-scale-in">
          {/* Header do formulário */}
          <div className={`px-4 sm:px-6 py-4 ${newRequest.type === 'SC' ? 'bg-gradient-to-r from-purple-500 to-violet-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-lg font-semibold text-white truncate">
                    Nova {typeLabels[newRequest.type]}
                  </h3>
                  <p className="text-xs sm:text-sm text-white/70 hidden sm:block">Preencha os dados abaixo</p>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <span className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-full bg-white/20 text-white backdrop-blur-sm">
                  {newRequest.type}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddRequest(false)}
                  className="p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-all duration-200"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-4 sm:p-6">
          
{/* Busca e Adição de Produtos */}
<div className="mb-6">
  <div className="flex items-center mb-4">
    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center mr-3 shadow-md shadow-blue-500/25">
      <Package className="w-4 h-4 text-white" />
    </div>
    <div>
      <h4 className="text-base font-semibold text-gray-800 dark:text-gray-100">Adicionar Produtos</h4>
      <p className="text-xs text-gray-500 dark:text-gray-400">Busque produtos cadastrados ou adicione novos</p>
    </div>
  </div>
  
  <div className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 rounded-xl p-3 sm:p-4 border border-gray-100 dark:border-gray-600">
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4">
      {/* Campo de busca */}
      <div className="col-span-2 lg:col-span-5">
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Buscar Produto</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Nome ou código..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 text-sm dark:text-gray-100 dark:placeholder-gray-400"
          />
        </div>
      </div>

      {/* Filtro de categoria */}
      <div className="col-span-2 sm:col-span-1 lg:col-span-3">
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Categoria</label>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as any)}
          className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 text-sm cursor-pointer dark:text-gray-100"
        >
          <option value="all">Todas</option>
          {categories.map(category => (
            <option key={category} value={category}>
              {category === 'general'
                ? 'Uso Geral'
                : category === 'technical'
                ? 'Insumos Técnicos'
                : category
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, c => c.toUpperCase())}
            </option>
          ))}
        </select>
      </div>

      {/* Quantidade */}
      <div className="col-span-1 lg:col-span-2">
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Qtd.</label>
        <input
          type="number"
          placeholder="Qtd."
          value={selectedQuantity}
          onChange={(e) => setSelectedQuantity(parseInt(e.target.value) || 1)}
          min="1"
          className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 text-sm text-center dark:text-gray-100"
        />
      </div>

      {/* Botão de adicionar */}
      <div className="col-span-1 lg:col-span-2 flex items-end">
        <button
          type="button"
          onClick={() => {
            if (matchedProduct) {
              setSelectedProduct(matchedProduct.id);
              addProductToRequest();
            } else {
              handleAddUnregisteredProduct();
            }
          }}
          disabled={!productSearch.trim()}
          className={`w-full px-3 sm:px-4 py-2.5 text-white rounded-xl flex items-center justify-center transition-all duration-200 font-medium text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
            matchedProduct 
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-green-500/25 hover:shadow-lg hover:shadow-green-500/30' 
              : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25 hover:shadow-lg hover:shadow-amber-500/30'
          }`}
        >
          <Plus className="w-4 h-4 sm:mr-1.5" />
          <span className="hidden sm:inline">{matchedProduct ? 'Adicionar' : 'Novo'}</span>
        </button>
      </div>
    </div>
    
    {/* Indicador de produto não cadastrado */}
    {productSearch && !matchedProduct && (
      <div className="mt-3 flex items-center p-2.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
        <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 mr-2 flex-shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-300">
          <span className="font-medium">Produto não encontrado.</span> Ao adicionar, será criado como "produto não cadastrado".
        </p>
      </div>
    )}
            {/* Lista de produtos filtrados */}
            {productSearch && filteredProducts.length > 0 && (
              <div className="mt-3 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg">
                <div className="p-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-600 sticky top-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{filteredProducts.length} produto(s) encontrado(s)</p>
                </div>
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product.id);
                      setProductSearch(product.name);
                    }}
                    className={`p-3 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 border-b border-gray-50 dark:border-gray-700 last:border-b-0 transition-colors duration-150 ${
                      selectedProduct === product.id ? 'bg-blue-50 dark:bg-blue-900/30 border-l-2 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-lg flex items-center justify-center mr-3">
                          <Package className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">{product.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{product.code} • {product.category}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          product.quantity > 10 ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 
                          product.quantity > 0 ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                        }`}>
                          {product.quantity} {product.unit}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

          {/* Produtos Adicionados */}
          {newRequest.items.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mr-3 shadow-md shadow-green-500/25">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-gray-800 dark:text-gray-100">Produtos Selecionados</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{newRequest.items.length} item(ns) adicionado(s)</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                  {newRequest.items.reduce((acc, item) => acc + item.quantity, 0)} un. total
                </span>
              </div>
              <div className="space-y-2">
                {newRequest.items.map((item, index) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl border border-blue-100 dark:border-blue-800 hover:border-blue-200 dark:hover:border-blue-700 transition-all duration-200 group"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center mr-3 shadow-sm border border-blue-100 dark:border-blue-800">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">{item.productName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            item.category === 'não cadastrado' 
                              ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' 
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                          }`}>
                            {item.category === 'não cadastrado' ? '⚠ Não cadastrado' : item.category}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">•</span>
                          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{item.quantity} un.</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeProductFromRequest(item.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all duration-200 opacity-60 group-hover:opacity-100"
                      title="Remover produto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitRequest} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Prioridade *</label>
              <select
                value={newRequest.priority}
                onChange={(e) => setNewRequest(prev => ({ ...prev, priority: e.target.value as any }))}
                required
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700 cursor-pointer dark:text-gray-100"
              >
                <option value="standard">Padrão</option>
                <option value="priority">Prioritário</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Departamento *</label>
              <input
                type="text"
                value={userProfile?.department || ''}
                readOnly
                disabled
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 bg-gray-100/80 dark:bg-gray-600 rounded-xl text-gray-600 dark:text-gray-300 cursor-not-allowed"
              />  
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Solicitante *</label>
              <input
                type="text"
                value={userProfile?.name || ''}
                readOnly
                disabled
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 bg-gray-100/80 dark:bg-gray-600 rounded-xl text-gray-600 dark:text-gray-300 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Fornecedor Sugerido</label>
              <select
                value={newRequest.supplierId || ''}
                onChange={(e) => setNewRequest(prev => ({ 
                  ...prev, 
                  supplierId: e.target.value === '' ? null : e.target.value 
                }))}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700 cursor-pointer dark:text-gray-100"
              >
                <option value="">Selecione um fornecedor (opcional)</option>
                {suppliers.filter(s => s.status === 'active').map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg flex items-center justify-center mr-3 shadow-md shadow-violet-500/25">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-gray-800 dark:text-gray-100">Justificativa</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Descreva o motivo da solicitação</p>
                </div>
              </div>
              <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden shadow-sm hover:border-gray-300 dark:hover:border-gray-500 transition-colors duration-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900">
                <div className="flex items-center gap-1 px-3 py-2 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 border-b border-gray-200 dark:border-gray-600">
                  <span className="text-xs text-gray-500 dark:text-gray-400 mr-2 font-medium">Formatação:</span>
                  <button
                    type="button"
                    onClick={() => applyFormatting('**', '**')}
                    className="p-1.5 hover:bg-white dark:hover:bg-gray-600 hover:shadow-sm rounded-lg transition-all duration-200 group"
                    title="Negrito (Ctrl+B)"
                  >
                    <Bold className="w-4 h-4 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-200" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormatting('*', '*')}
                    className="p-1.5 hover:bg-white dark:hover:bg-gray-600 hover:shadow-sm rounded-lg transition-all duration-200 group"
                    title="Itálico (Ctrl+I)"
                  >
                    <Italic className="w-4 h-4 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-200" />
                  </button>
                  <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                  <button
                    type="button"
                    onClick={insertBulletPoint}
                    className="p-1.5 hover:bg-white dark:hover:bg-gray-600 hover:shadow-sm rounded-lg transition-all duration-200 group"
                    title="Lista com marcadores"
                  >
                    <List className="w-4 h-4 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-200" />
                  </button>
                </div>
                <textarea
                  ref={textareaRef}
                  value={newRequest.reason}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, reason: e.target.value }))}
                  required
                  rows={4}
                  className="w-full px-4 py-3 border-0 focus:ring-0 focus:outline-none resize-none text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800"
                  placeholder="Ex: Necessário para o projeto X, conforme demanda do setor Y...&#10;&#10;• Item 1: descrição&#10;• Item 2: descrição"
                />
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-600 flex justify-between items-center">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {newRequest.reason.length} caracteres
                  </span>
                  {newRequest.reason && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center">
                      <Check className="w-3 h-3 mr-1" />
                      Preenchido
                    </span>
                  )}
                </div>
              </div>
              {newRequest.reason && (
                <div className="mt-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-800 rounded-xl">
                  <div className="flex items-center mb-2">
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider">Pré-visualização</span>
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{renderFormattedText(newRequest.reason)}</div>
                </div>
              )}
            </div>

            {/* Anexos (múltiplos) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Anexos (Opcional)
              </label>
              <div className="space-y-3">
                {/* Input oculto - múltiplos arquivos */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  multiple
                  className="hidden"
                />

                {/* Lista de arquivos já selecionados */}
                {attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-4 py-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl">
                    {attachmentPreviews[idx] ? (
                      <img
                        src={attachmentPreviews[idx]!}
                        alt="Preview"
                        className="w-12 h-12 object-cover rounded-lg border border-green-300 dark:border-green-600 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200 truncate">{file.name}</p>
                      <p className="text-xs text-green-600 dark:text-green-400">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all flex-shrink-0"
                      title="Remover anexo"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}

                {/* Botão de adicionar mais arquivos */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-3 px-4 py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all duration-200 group"
                >
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 rounded-lg flex items-center justify-center transition-colors">
                    <FileUp className="w-5 h-5 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                      {attachments.length === 0 ? 'Clique para anexar arquivo(s)' : 'Adicionar mais arquivos'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">PDF, PNG ou JPEG (máx. 10MB cada)</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="md:col-span-2 flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <span className="text-red-500">*</span> Campos obrigatórios
              </p>
              <div className="flex space-x-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowAddRequest(false)}
                  className="flex-1 sm:flex-none px-5 py-2.5 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={newRequest.items.length === 0 || !newRequest.reason.trim()}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 font-medium shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md flex items-center justify-center"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Enviar Solicitação
                </button>
              </div>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* Type Selection Modal - usando Portal para isolamento completo */}
      {showTypeSelectionModal && ReactDOM.createPortal(
        <div 
          className="fixed inset-0 z-[9999] overflow-hidden"
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            width: '100vw',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={() => setShowTypeSelectionModal(false)}
          />
          {/* Modal */}
          <div 
            className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl animate-scale-in"
            style={{ 
              position: 'relative',
              width: 'calc(100% - 32px)',
              maxWidth: '28rem',
              maxHeight: 'calc(100vh - 32px)',
              margin: '16px',
              overflow: 'auto'
            }}
          >
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Tipo de Solicitação</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Selecione o tipo de solicitação que deseja criar</p>
            </div>

            <div className="p-6 space-y-4">
              <button
                onClick={() => handleTypeSelection('SC')}
                className="w-full p-4 border-2 border-purple-200 dark:border-purple-800 rounded-xl hover:border-purple-400 dark:hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-all duration-200 text-left group hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-gradient-to-br from-purple-500 to-violet-500 rounded-full mr-3 group-hover:scale-110 transition-transform"></div>
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100">Solicitação de Compra (SC)</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Para produtos que precisam ser comprados</p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">✓ Sempre disponível</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleTypeSelection('SM')}
                className="w-full p-4 border-2 border-blue-200 dark:border-blue-800 rounded-xl hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-200 text-left group hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full mr-3 group-hover:scale-110 transition-transform"></div>
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100">Solicitação de Material (SM)</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Para retirada de produtos do estoque</p>
                    {!isPeriodOpen && userProfile?.role === 'requester' && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">⚠ Período fechado</p>
                    )}
                  </div>
                </div>
              </button>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowTypeSelectionModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-gray-500 to-slate-500 rounded-lg flex items-center justify-center mr-3 shadow-md shadow-gray-500/25">
            <FilterIcon className="w-4 h-4 text-white" />  
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">Filtros e Pesquisa</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">Refine sua busca por solicitações</p>
          </div>
        </div>
        
        {/* Campo de Pesquisa Inteligente */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar por ID, solicitante, produto, departamento, motivo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700 text-sm dark:text-gray-100 dark:placeholder-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700 cursor-pointer text-sm dark:text-gray-100"
            >
              <option value="all">Todos</option>
              <option value="pending">Pendente</option>
              <option value="approved">Aprovado</option>
              <option value="rejected">Rejeitado</option>
              <option value="completed">Concluído</option>
            </select>
          </div>

          {['admin', 'operator'].includes(userProfile?.role) && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Depto.</label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700 cursor-pointer text-sm dark:text-gray-100"
              >
                <option value="all">Todos</option>
                {DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Data</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700 text-sm dark:text-gray-100"
            />
          </div>

          <div className="col-span-2 sm:col-span-1 flex items-end">
            <div className="w-full px-3 sm:px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-100 dark:border-blue-800 rounded-xl text-center sm:text-left">
              <span className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300">
                {filteredRequests.length} {filteredRequests.length === 1 ? 'solicitação' : 'solicitações'}
              </span>
            </div>
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
                  {requests.filter(r => r.status === 'pending').length}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Pendentes</p>
              </div>
            </div>
          </button>

          {/* Aprovadas */}
          <button
            onClick={() => toggleStatusCardFilter('approved')}
            className={`bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm hover:shadow-md transition-all duration-200 text-left ${
              selectedStatusFilters.has('approved') 
                ? 'border-green-400 ring-2 ring-green-400/30 bg-green-50 dark:bg-green-900/30' 
                : 'border-gray-100 dark:border-gray-700 hover:border-green-200 dark:hover:border-green-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                selectedStatusFilters.has('approved') ? 'bg-green-500' : 'bg-green-100 dark:bg-green-900/50'
              }`}>
                <CheckCircle2 className={`w-5 h-5 ${selectedStatusFilters.has('approved') ? 'text-white' : 'text-green-600 dark:text-green-400'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {requests.filter(r => r.status === 'approved').length}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Aprovadas</p>
              </div>
            </div>
          </button>

          {/* Rejeitadas */}
          <button
            onClick={() => toggleStatusCardFilter('rejected')}
            className={`bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm hover:shadow-md transition-all duration-200 text-left ${
              selectedStatusFilters.has('rejected') 
                ? 'border-red-400 ring-2 ring-red-400/30 bg-red-50 dark:bg-red-900/30' 
                : 'border-gray-100 dark:border-gray-700 hover:border-red-200 dark:hover:border-red-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                selectedStatusFilters.has('rejected') ? 'bg-red-500' : 'bg-red-100 dark:bg-red-900/50'
              }`}>
                <XCircle className={`w-5 h-5 ${selectedStatusFilters.has('rejected') ? 'text-white' : 'text-red-600 dark:text-red-400'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {requests.filter(r => r.status === 'rejected').length}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Rejeitadas</p>
              </div>
            </div>
          </button>

          {/* Concluídas */}
          <button
            onClick={() => toggleStatusCardFilter('completed')}
            className={`bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm hover:shadow-md transition-all duration-200 text-left ${
              selectedStatusFilters.has('completed') 
                ? 'border-blue-400 ring-2 ring-blue-400/30 bg-blue-50 dark:bg-blue-900/30' 
                : 'border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                selectedStatusFilters.has('completed') ? 'bg-blue-500' : 'bg-blue-100 dark:bg-blue-900/50'
              }`}>
                <Play className={`w-5 h-5 ${selectedStatusFilters.has('completed') ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {requests.filter(r => r.status === 'completed').length}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Concluídas</p>
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
              className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[status as keyof typeof statusColors]}`}
            >
              {statusLabels[status as keyof typeof statusLabels]}
            </span>
          ))}
          <button
            onClick={clearStatusCardFilters}
            className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.map((request, index) => (
          <div 
            key={request.id} 
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 hover:shadow-xl hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-300 animate-fade-in-up group hover:-translate-y-0.5 overflow-hidden"
            style={{ animationDelay: `${Math.min(index * 0.05, 0.25)}s` }}
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
              {/* Lado esquerdo - ID e Data */}
              <div className="flex items-center">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 ${request.type === 'SC' ? 'bg-gradient-to-br from-purple-500 to-violet-500 shadow-purple-500/25' : 'bg-gradient-to-br from-blue-500 to-indigo-500 shadow-blue-500/25'} rounded-xl flex items-center justify-center mr-3 shadow-md group-hover:scale-105 transition-transform duration-300 flex-shrink-0`}>
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">{request.id}</h3>
                  <div className="flex items-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 flex-shrink-0" />
                    <span className="truncate">{request.requestDate}</span>
                  </div>
                </div>
              </div>
              
              {/* Lado direito - Tags com títulos */}
              <div className="flex flex-wrap sm:flex-nowrap items-start gap-2 sm:gap-3 sm:ml-4">
                {/* Tipo */}
                <div className="flex flex-col items-center">
                  <span className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-1">Tipo</span>
                  <span className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold rounded-full whitespace-nowrap ${typeColors[request.type]}`}>
                    {request.type}
                  </span>
                </div>
                {/* Prioridade */}
                <div className="flex flex-col items-center">
                  <span className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-1">Prioridade</span>
                  <span className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold rounded-full whitespace-nowrap ${priorityColors[request.priority]}`}>
                    {priorityLabels[request.priority]}
                  </span>
                </div>
                {/* Status */}
                <div className="flex flex-col items-center">
                  <span className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-1">Status</span>
                  <span className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold rounded-full whitespace-nowrap ${statusColors[request.status]}`}>
                    {statusLabels[request.status]}
                  </span>
                </div>
              </div>
            </div>

            {/* Produtos da Solicitação */}
            <div className="mb-4">
              <div className="flex items-center flex-wrap gap-2 mb-3">
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center shadow-sm shadow-blue-500/25 flex-shrink-0">
                  <Package className="w-3 h-3 text-white" />
                </div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">Produtos</h4>
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-full">
                  {request.items.length} item(ns)
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {request.items.map((item, idx) => (
                  <div key={idx} className="flex items-center p-2.5 sm:p-3 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 rounded-xl border border-gray-100 dark:border-gray-600 hover:border-blue-200 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all duration-200">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center mr-2 shadow-sm border border-gray-100 dark:border-gray-600 flex-shrink-0">
                      <span className="text-[10px] sm:text-xs font-bold text-blue-600 dark:text-blue-400">{idx + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs sm:text-sm text-gray-800 dark:text-gray-200 font-medium truncate block">{item.productName}</span>
                    </div>
                    <span className="ml-2 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] sm:text-xs font-semibold rounded-lg whitespace-nowrap flex-shrink-0">
                      {item.quantity} un.
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4">
              <div className="flex items-center p-2.5 sm:p-3 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center mr-2 sm:mr-3 shadow-sm shadow-blue-500/25 flex-shrink-0">
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">Solicitante</p>
                  <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{request.requestedBy}</p>
                </div>
              </div>

              <div className="flex items-center p-2.5 sm:p-3 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-purple-500 to-violet-500 rounded-lg flex items-center justify-center mr-2 sm:mr-3 shadow-sm shadow-purple-500/25 flex-shrink-0">
                  <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">Departamento</p>
                  <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{request.department || 'N/A'}</p>
                </div>
              </div>

              {request.supplierName && (
                <div className="flex items-center p-2.5 sm:p-3 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center mr-2 sm:mr-3 shadow-sm shadow-emerald-500/25 flex-shrink-0">
                    <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">Fornecedor</p>
                    <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{request.supplierName}</p>
                  </div>
                </div>
              )}

              {request.approvedBy && (
                <div className="flex items-center p-2.5 sm:p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl border border-green-100 dark:border-green-800">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mr-2 sm:mr-3 shadow-sm shadow-green-500/25 flex-shrink-0">
                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">Aprovado por</p>
                    <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{request.approvedBy}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-4 space-y-3">
              <div className="flex items-center">
                <div className="w-6 h-6 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg flex items-center justify-center mr-2 shadow-sm shadow-violet-500/25 flex-shrink-0">
                  <FileText className="w-3 h-3 text-white" />
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">Justificativa</p>
              </div>
              <div className="text-gray-700 dark:text-gray-200 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 p-3 sm:p-4 rounded-xl border border-gray-100 dark:border-gray-600 text-xs sm:text-sm leading-relaxed break-words">{renderFormattedText(request.reason)}</div>
              <ChatButton
                requestId={request.id}
                userId={user?.id || ''}
                onClick={() => setChatRequestId(request.id)}
              />
            </div>

            {/* Attachments (múltiplos) */}
            {(request.attachments && request.attachments.length > 0) && (
              <div className="mb-4 space-y-2">
                <div className="flex items-center">
                  <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mr-2 shadow-sm shadow-purple-500/25 flex-shrink-0">
                    <Paperclip className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">Anexos ({request.attachments.length})</p>
                </div>
                <div className="space-y-2">
                  {request.attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 p-3 rounded-xl border border-purple-100 dark:border-purple-800">
                      {att.name.match(/\.(png|jpg|jpeg)$/i) ? (
                        <>
                          <div
                            className="relative group/preview cursor-pointer flex-shrink-0"
                            onClick={() => openImageViewer(att.url, att.name)}
                          >
                            <img
                              src={att.url}
                              alt={att.name}
                              className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border border-purple-200 hover:opacity-90 transition-opacity"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/preview:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-purple-800 truncate">{att.name}</p>
                            <button
                              onClick={() => openImageViewer(att.url, att.name)}
                              className="text-[10px] sm:text-xs text-purple-600 hover:text-purple-800 hover:underline inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              Clique para visualizar
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-purple-800 truncate">{att.name}</p>
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] sm:text-xs text-purple-600 hover:text-purple-800 hover:underline inline-flex items-center gap-1"
                            >
                              <Paperclip className="w-3 h-3" />
                              Abrir documento
                            </a>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {canApprove && request.status === 'pending' && (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => handleApproveRequest(request.id)}
                  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-200 flex items-center justify-center font-medium shadow-md shadow-green-500/25 hover:shadow-lg hover:shadow-green-500/30 text-xs sm:text-sm"
                >
                  <Check className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Aprovar</span>
                </button>
                <button
                  onClick={() => handleRejectRequest(request.id)}
                  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl hover:from-red-600 hover:to-rose-600 transition-all duration-200 flex items-center justify-center font-medium shadow-md shadow-red-500/25 hover:shadow-lg hover:shadow-red-500/30 text-xs sm:text-sm"
                >
                  <X className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Rejeitar</span>
                </button>
                
                {userProfile?.role === 'operator' && (
                  <button
                    onClick={() => handleCompleteRequest(request)}
                    className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 flex items-center justify-center font-medium shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30 text-xs sm:text-sm"
                  >
                    <Check className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Finalizar</span>
                  </button>
                )}
              </div>
            )}
            {canApprove && request.status === 'approved' && (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => handleStartQuotation(request)}
                  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 flex items-center justify-center font-medium shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/30 text-xs sm:text-sm"
                >
                  <FileText className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Iniciar Cotação</span>
                </button>
            
              {(['admin', 'operator'].includes(userProfile?.role) || userProfile?.name === request.requestedBy) && (
                <button
                  onClick={() => handleCompleteRequest(request)}
                  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 flex items-center justify-center font-medium shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30 text-xs sm:text-sm"
                >
                  <Check className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Finalizar</span>
                </button>
                )}
              </div>
            )}

            {/* Botão de visualização de assinatura para solicitações finalizadas */}
            {request.status === 'completed' && request.receiver_signature && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() =>
                      setViewSignature({
                        name: request.received_by || 'Não informado',
                        signature: request.receiver_signature,
                      })
                    }
                    className="flex items-center justify-center w-full sm:w-auto px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/50 dark:hover:to-indigo-900/50 rounded-xl transition-all duration-200 text-xs sm:text-sm font-medium border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600"
                  >
                    <PenTool className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Ver assinatura do recebedor</span>
                    <span className="sm:hidden">Ver assinatura</span>
                  </button>
                </div>
            )}
          </div>
        ))}
      </div>
      
    {filteredRequests.length === 0 && (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-12 text-center border border-gray-100 dark:border-gray-700 animate-fade-in-up">
        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-gray-100 to-slate-100 dark:from-gray-700 dark:to-slate-700 rounded-2xl flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Nenhuma solicitação encontrada</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
          {userProfile?.role === 'requester' 
            ? 'Crie a primeira solicitação de retirada de materiais.'
            : 'Nenhuma solicitação corresponde aos filtros aplicados.'
          }
        </p>
        {userProfile?.role === 'requester' && (
          <button
            onClick={handleNewRequestClick}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 font-medium shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30 inline-flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Solicitação
          </button>
        )}
      </div>
    )}
    
    {chatRequestId && (
      <RequestChat
        requestId={chatRequestId}
        currentUser={{ id: user?.id || '', name: userProfile?.name || '' }}
        onClose={() => setChatRequestId(null)}
      />
    )}
    
    {showSignatureModal && (
      <SignatureModal
        requestId={showSignatureModal.id}
        items={showSignatureModal.items}
        onClose={() => setShowSignatureModal(null)}
        onConfirm={async (signature, receiverName) => {
          try {
            // Salva assinatura e nome de quem recebeu
            await supabase
              .from('requests')
              .update({
                receiver_signature: signature,
                received_by: receiverName,
              })
              .eq('id', showSignatureModal.id);
    
            // Criar movimentação para cada item (UMA ÚNICA VEZ)
            for (const item of showSignatureModal.items) {
              const product = products.find(p => p.id === item.productId);
              if (product) {
                await addMovement({
                  productId: item.productId,
                  productName: item.productName,
                  type: 'out',
                  reason: 'sale',
                  quantity: item.quantity,
                  date: new Date().toISOString().split('T')[0],
                  requestId: showSignatureModal.id,
                  authorizedBy: showSignatureModal.approvedBy,
                  notes: `Solicitação: ${showSignatureModal.reason}`,
                  unitPrice: product.unitPrice,
                  totalValue: item.quantity * product.unitPrice,
                });
              }
            }
    
            // Atualiza status da solicitação
            await updateRequestStatus(showSignatureModal.id, 'completed');
            showSuccess('Retirada finalizada com sucesso!');
            setShowSignatureModal(null);
          } catch (error) {
            console.error(error);
            showError('Erro ao finalizar solicitação. Tente novamente.');
          }
        }}
      />
    )}
    
    {/* Modal de Retirada de Estoque Seguro */}
    {showWithdrawalModal && (
      <StockWithdrawalModal
        requestId={showWithdrawalModal.id}
        requestReason={showWithdrawalModal.reason}
        approvedBy={showWithdrawalModal.approvedBy}
        items={showWithdrawalModal.items}
        products={products}
        onClose={() => {
          setShowWithdrawalModal(null);
          setProcessingRequestId(null);
        }}
        onConfirm={async (signature, receiverName, itemsToDeduct, onItemProcessed) => {
          // Marcar como em processamento
          setProcessingRequestId(showWithdrawalModal.id);
          
          try {
            // Verificação final: checar status novamente antes de processar
            const { data: currentRequest, error: checkError } = await supabase
              .from('requests')
              .select('status')
              .eq('id', showWithdrawalModal.id)
              .single();
            
            if (checkError || currentRequest?.status === 'completed') {
              throw new Error('Esta solicitação já foi processada por outro usuário.');
            }
            
            // Primeiro: Salvar assinatura e nome (marcando que está em processo)
            const { error: signatureError } = await supabase
              .from('requests')
              .update({
                receiver_signature: signature,
                received_by: receiverName,
              })
              .eq('id', showWithdrawalModal.id)
              .eq('status', 'approved'); // Só atualiza se ainda estiver aprovado
            
            if (signatureError) {
              throw new Error('Erro ao salvar assinatura. Possível processamento concorrente.');
            }
            
            // Processar cada item individualmente com tratamento de erro
            const processedItems: string[] = [];
            const failedItems: { item: string; error: string }[] = [];
            
            for (const item of itemsToDeduct) {
              try {
                // Verificar estoque atual antes de deduzir
                const product = products.find(p => p.id === item.productId);
                if (!product) {
                  onItemProcessed(item.id, false, 'Produto não encontrado');
                  failedItems.push({ item: item.productName, error: 'Produto não encontrado' });
                  continue;
                }
                
                // Criar movimentação
                await addMovement({
                  productId: item.productId!,
                  productName: item.productName,
                  type: 'out',
                  reason: 'sale',
                  quantity: item.quantity,
                  date: new Date().toISOString().split('T')[0],
                  requestId: showWithdrawalModal.id,
                  authorizedBy: showWithdrawalModal.approvedBy,
                  notes: `Solicitação: ${showWithdrawalModal.reason}`,
                  unitPrice: product.unitPrice,
                  totalValue: item.quantity * product.unitPrice,
                });
                
                processedItems.push(item.productName);
                onItemProcessed(item.id, true);
                
                // Pequeno delay entre itens para evitar race conditions
                await new Promise(resolve => setTimeout(resolve, 100));
                
              } catch (itemError) {
                console.error(`Erro ao processar item ${item.productName}:`, itemError);
                onItemProcessed(item.id, false, 'Erro ao processar');
                failedItems.push({ item: item.productName, error: 'Falha na movimentação' });
              }
            }
            
            // Atualizar status da solicitação para concluído
            await updateRequestStatus(showWithdrawalModal.id, 'completed');
            
            // Marcar como processado nesta sessão
            setProcessedRequestIds(prev => new Set([...prev, showWithdrawalModal.id]));
            
            // Mostrar resultado
            if (failedItems.length === 0) {
              showSuccess(`Retirada finalizada com sucesso! ${processedItems.length} item(s) baixado(s).`);
            } else {
              showWarning(`Retirada parcial: ${processedItems.length} item(s) baixado(s), ${failedItems.length} com erro.`);
            }
            
          } catch (error: any) {
            console.error('Erro ao processar retirada:', error);
            showError(error.message || 'Erro ao finalizar solicitação. Tente novamente.');
            throw error; // Re-throw para o modal tratar
          } finally {
            setProcessingRequestId(null);
          }
        }}
      />
    )}
    {viewSignature && (
      <SignatureViewModal
        receiverName={viewSignature.name}
        signature={viewSignature.signature}
        onClose={() => setViewSignature(null)}
      />
    )}
    </div>
    );
    };

export default RequestManagement;