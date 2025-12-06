import React, { useState } from 'react';
import { FileText, Plus, Check, X, User, Package, Building2, Calendar, Download, Search, Filter as FilterIcon, Trash2, Bold, Italic, List, AlertTriangle } from 'lucide-react';
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
import { PenTool } from 'lucide-react';


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
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('');

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

  const [viewSignature, setViewSignature] = useState<{name: string; signature: string} | null>(null);

  // Estados para adicionar produtos
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'general' | 'technical'>('all');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

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
    'SC': 'bg-purple-100 text-purple-800',
    'SM': 'bg-blue-100 text-blue-800'
  };

  const statusColors = {
    'pending': 'bg-yellow-100 text-yellow-800',
    'approved': 'bg-green-100 text-green-800',
    'rejected': 'bg-red-100 text-red-800',
    'completed': 'bg-blue-100 text-blue-800'
  };

  const priorityLabels = {
    'standard': 'Padrão',
    'priority': 'Prioritário',
    'urgent': 'Urgente'
  };

  const priorityColors = {
    'standard': 'bg-gray-100 text-gray-800',
    'priority': 'bg-orange-100 text-orange-800',
    'urgent': 'bg-red-100 text-red-800'
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

useEffect(() => {
  const checkRequestPeriod = async () => {
    if (userProfile?.role !== 'requester') return;

    const department = (userProfile?.department as string) === 'Área técnica' ? 'Área técnica' : 'general';

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
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    const matchesType = typeFilter === 'all' || request.type === typeFilter;
    const matchesDepartment = departmentFilter === 'all' || request.department === departmentFilter;
    const matchesDate = !dateFilter || request.requestDate === dateFilter;
    
    // Se for admin ou operator, pode ver todas as solicitações
    // Se for requester, só pode ver as do seu departamento
    const matchesUserAccess = userProfile?.role === 'admin' || 
                             userProfile?.role === 'operator' || 
                             request.department === userProfile?.department;
    
    return matchesStatus && matchesType && matchesDepartment && matchesDate && matchesUserAccess;
  });

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
      });

      setNewRequest({
        type: 'SM',
        items: [],
        reason: '',
        priority: 'standard',
        requestedBy: userProfile?.name || '',
        department: userProfile?.department || '',
        supplierId: null
      });
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
  // Abre modal de confirmação com coleta de assinatura
  setShowSignatureModal(request);
};

  const handleStartQuotation = async (request: Request) => {
    try {
      // Criar cotação com todos os fornecedores ativos
      const activeSuppliers = suppliers.filter(s => s.status === 'active');
      
      if (activeSuppliers.length === 0) {
        showWarning('Nenhum fornecedor ativo encontrado para criar a cotação.');
        return;
      }

      // Para múltiplos produtos, criar cotação para cada um
      for (const item of request.items) {
        await createQuotation({
          requestId: request.id,
          productId: item.productId,
          productName: item.productName,
          requestedQuantity: item.quantity,
          suppliers: activeSuppliers.map(s => ({
            id: s.id,
            name: s.name,
            quotePrice: null
          }))
        });
      }

      showSuccess('Cotações criadas com sucesso! Verifique a aba de cotações.');
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

      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Gerenciamento de Solicitações</h2>
          <p className="text-gray-500">Controle de requisições para retirada de materiais</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={generateReport}
            className="px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-200 flex items-center font-medium shadow-md shadow-green-500/25 hover:shadow-lg hover:shadow-green-500/30"
          >
            <Download className="w-4 h-4 mr-2" />
            Relatório
          </button>
          <button
            onClick={() => {
              handleNewRequestClick();
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 flex items-center transition-all duration-200 font-medium shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Solicitação
          </button>
        </div>
      </div>

      {/* Add Request Form */}
      {showAddRequest && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-scale-in">
          {/* Header do formulário */}
          <div className={`px-6 py-4 ${newRequest.type === 'SC' ? 'bg-gradient-to-r from-purple-500 to-violet-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-3">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Nova {typeLabels[newRequest.type]}
                  </h3>
                  <p className="text-sm text-white/70">Preencha os dados abaixo</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 text-sm font-medium rounded-full bg-white/20 text-white backdrop-blur-sm">
                  {newRequest.type}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddRequest(false)}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-all duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-6">
          
{/* Busca e Adição de Produtos */}
<div className="mb-6">
  <div className="flex items-center mb-4">
    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center mr-3 shadow-md shadow-blue-500/25">
      <Package className="w-4 h-4 text-white" />
    </div>
    <div>
      <h4 className="text-base font-semibold text-gray-800">Adicionar Produtos</h4>
      <p className="text-xs text-gray-500">Busque produtos cadastrados ou adicione novos</p>
    </div>
  </div>
  
  <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-4 border border-gray-100">
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Campo de busca */}
      <div className="lg:col-span-5">
        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Buscar Produto</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Digite o nome ou código do produto..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 text-sm"
          />
        </div>
      </div>

      {/* Filtro de categoria */}
      <div className="lg:col-span-3">
        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Categoria</label>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as any)}
          className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 text-sm cursor-pointer"
        >
          <option value="all">Todas as Categorias</option>
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
      <div className="lg:col-span-2">
        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Quantidade</label>
        <input
          type="number"
          placeholder="Qtd."
          value={selectedQuantity}
          onChange={(e) => setSelectedQuantity(parseInt(e.target.value) || 1)}
          min="1"
          className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 text-sm text-center"
        />
      </div>

      {/* Botão de adicionar */}
      <div className="lg:col-span-2 flex items-end">
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
          className={`w-full px-4 py-2.5 text-white rounded-xl flex items-center justify-center transition-all duration-200 font-medium text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
            matchedProduct 
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-green-500/25 hover:shadow-lg hover:shadow-green-500/30' 
              : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25 hover:shadow-lg hover:shadow-amber-500/30'
          }`}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span className="hidden sm:inline">{matchedProduct ? 'Adicionar' : 'Novo'}</span>
          <span className="sm:hidden">+</span>
        </button>
      </div>
    </div>
    
    {/* Indicador de produto não cadastrado */}
    {productSearch && !matchedProduct && (
      <div className="mt-3 flex items-center p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertTriangle className="w-4 h-4 text-amber-500 mr-2 flex-shrink-0" />
        <p className="text-xs text-amber-700">
          <span className="font-medium">Produto não encontrado.</span> Ao adicionar, será criado como "produto não cadastrado".
        </p>
      </div>
    )}
            {/* Lista de produtos filtrados */}
            {productSearch && filteredProducts.length > 0 && (
              <div className="mt-3 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
                <div className="p-2 bg-gray-50 border-b border-gray-100 sticky top-0">
                  <p className="text-xs text-gray-500 font-medium">{filteredProducts.length} produto(s) encontrado(s)</p>
                </div>
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product.id);
                      setProductSearch(product.name);
                    }}
                    className={`p-3 cursor-pointer hover:bg-blue-50 border-b border-gray-50 last:border-b-0 transition-colors duration-150 ${
                      selectedProduct === product.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center mr-3">
                          <Package className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.code} • {product.category}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          product.quantity > 10 ? 'bg-green-100 text-green-700' : 
                          product.quantity > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
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
                    <h4 className="text-base font-semibold text-gray-800">Produtos Selecionados</h4>
                    <p className="text-xs text-gray-500">{newRequest.items.length} item(ns) adicionado(s)</p>
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
                    className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 hover:border-blue-200 transition-all duration-200 group"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center mr-3 shadow-sm border border-blue-100">
                        <span className="text-xs font-bold text-blue-600">{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{item.productName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            item.category === 'não cadastrado' 
                              ? 'bg-amber-100 text-amber-700' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {item.category === 'não cadastrado' ? '⚠ Não cadastrado' : item.category}
                          </span>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs font-medium text-blue-600">{item.quantity} un.</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeProductFromRequest(item.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 opacity-60 group-hover:opacity-100"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Prioridade *</label>
              <select
                value={newRequest.priority}
                onChange={(e) => setNewRequest(prev => ({ ...prev, priority: e.target.value as any }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="standard">Padrão</option>
                <option value="priority">Prioritário</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Departamento *</label>
              <input
                type="text"
                value={userProfile?.department || ''}
                readOnly
                disabled
                className="w-full px-3 py-2 border border-gray-200 bg-gray-100 rounded-lg text-gray-700"
              />  
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Solicitante *</label>
              <input
                type="text"
                value={userProfile?.name || ''}
                readOnly
                disabled
                className="w-full px-3 py-2 border border-gray-200 bg-gray-100 rounded-lg text-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fornecedor Sugerido</label>
              <select
                value={newRequest.supplierId || ''}
                onChange={(e) => setNewRequest(prev => ({ 
                  ...prev, 
                  supplierId: e.target.value === '' ? null : e.target.value 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  <h4 className="text-base font-semibold text-gray-800">Justificativa</h4>
                  <p className="text-xs text-gray-500">Descreva o motivo da solicitação</p>
                </div>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:border-gray-300 transition-colors duration-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                <div className="flex items-center gap-1 px-3 py-2 bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200">
                  <span className="text-xs text-gray-500 mr-2 font-medium">Formatação:</span>
                  <button
                    type="button"
                    onClick={() => applyFormatting('**', '**')}
                    className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all duration-200 group"
                    title="Negrito (Ctrl+B)"
                  >
                    <Bold className="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormatting('*', '*')}
                    className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all duration-200 group"
                    title="Itálico (Ctrl+I)"
                  >
                    <Italic className="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
                  </button>
                  <div className="w-px h-4 bg-gray-300 mx-1"></div>
                  <button
                    type="button"
                    onClick={insertBulletPoint}
                    className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all duration-200 group"
                    title="Lista com marcadores"
                  >
                    <List className="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
                  </button>
                </div>
                <textarea
                  ref={textareaRef}
                  value={newRequest.reason}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, reason: e.target.value }))}
                  required
                  rows={4}
                  className="w-full px-4 py-3 border-0 focus:ring-0 focus:outline-none resize-none text-sm text-gray-700 placeholder-gray-400"
                  placeholder="Ex: Necessário para o projeto X, conforme demanda do setor Y...&#10;&#10;• Item 1: descrição&#10;• Item 2: descrição"
                />
                <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-xs text-gray-400">
                    {newRequest.reason.length} caracteres
                  </span>
                  {newRequest.reason && (
                    <span className="text-xs text-green-600 font-medium flex items-center">
                      <Check className="w-3 h-3 mr-1" />
                      Preenchido
                    </span>
                  )}
                </div>
              </div>
              {newRequest.reason && (
                <div className="mt-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center mb-2">
                    <span className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Pré-visualização</span>
                  </div>
                  <div className="text-sm text-gray-700 leading-relaxed">{renderFormattedText(newRequest.reason)}</div>
                </div>
              )}
            </div>

            <div className="md:col-span-2 flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                <span className="text-red-500">*</span> Campos obrigatórios
              </p>
              <div className="flex space-x-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowAddRequest(false)}
                  className="flex-1 sm:flex-none px-5 py-2.5 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium"
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

      {/* Type Selection Modal */}
      {showTypeSelectionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-scale-in">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800">Tipo de Solicitação</h2>
              <p className="text-sm text-gray-500 mt-1">Selecione o tipo de solicitação que deseja criar</p>
            </div>

            <div className="p-6 space-y-4">
              <button
                onClick={() => handleTypeSelection('SC')}
                className="w-full p-4 border-2 border-purple-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all duration-200 text-left group hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-gradient-to-br from-purple-500 to-violet-500 rounded-full mr-3 group-hover:scale-110 transition-transform"></div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Solicitação de Compra (SC)</h3>
                    <p className="text-sm text-gray-500">Para produtos que precisam ser comprados</p>
                    <p className="text-xs text-green-600 mt-1 font-medium">✓ Sempre disponível</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleTypeSelection('SM')}
                className="w-full p-4 border-2 border-blue-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 text-left group hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full mr-3 group-hover:scale-110 transition-transform"></div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Solicitação de Material (SM)</h3>
                    <p className="text-sm text-gray-500">Para retirada de produtos do estoque</p>
                    {!isPeriodOpen && userProfile?.role === 'requester' && (
                      <p className="text-xs text-red-600 mt-1 font-medium">⚠ Período fechado</p>
                    )}
                  </div>
                </div>
              </button>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowTypeSelectionModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              <option value="completed">Concluído</option>
            </select>
          </div>

          {['admin', 'operator'].includes(userProfile?.role) && (
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-end">
            <span className="text-sm text-gray-600">
              {filteredRequests.length} solicitação(ões) encontrada(s)
            </span>
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.map((request, index) => (
          <div 
            key={request.id} 
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:border-blue-100 transition-all duration-300 animate-fade-in-up"
            style={{ animationDelay: `${Math.min(index * 0.05, 0.25)}s` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mr-3 shadow-md shadow-blue-500/25">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{request.id}</h3>
                  <p className="text-sm text-gray-500">Solicitado em {request.requestDate}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${typeColors[request.type]}`}>
                  {request.type}
                </span>
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${priorityColors[request.priority]}`}>
                  {priorityLabels[request.priority]}
                </span>
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusColors[request.status]}`}>
                  {statusLabels[request.status]}
                </span>
              </div>
            </div>

            {/* Produtos da Solicitação */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Produtos Solicitados:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {request.items.map((item, index) => (
                  <div key={index} className="flex items-center p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-100">
                    <Package className="w-4 h-4 text-blue-500 mr-2" />
                    <span className="text-sm text-gray-700 font-medium">{item.productName}</span>
                    <span className="text-sm text-gray-500 ml-1">- {item.quantity} un.</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="flex items-center">
                <User className="w-4 h-4 text-gray-400 mr-2" />
                <div>
                  <p className="text-sm text-gray-600">Solicitante</p>
                  <p className="font-medium text-gray-800">{request.requestedBy}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600">Departamento</p>
                <p className="font-medium text-gray-800">{request.department || 'N/A'}</p>
              </div>

              {request.supplierName && (
                <div className="flex items-center">
                  <Building2 className="w-4 h-4 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">Fornecedor Sugerido</p>
                    <p className="font-medium text-gray-800">{request.supplierName}</p>
                  </div>
                </div>
              )}

              {request.approvedBy && (
                <div className="flex items-center">
                  <User className="w-4 h-4 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">Aprovado por</p>
                    <p className="font-medium text-gray-800">{request.approvedBy}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-4 space-y-3">
              <p className="text-sm text-gray-600">Justificativa:</p>
              <div className="text-gray-800 bg-gray-100 p-4 rounded-xl">{renderFormattedText(request.reason)}</div>
              <ChatButton
                requestId={request.id}
                userId={user?.id || ''}
                onClick={() => setChatRequestId(request.id)}
              />
            </div>

            {/* Action Buttons */}
            {canApprove && request.status === 'pending' && (
              <div className="flex space-x-3">
                <button
                  onClick={() => handleApproveRequest(request.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Aprovar
                </button>
                <button
                  onClick={() => handleRejectRequest(request.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center"
                >
                  <X className="w-4 h-4 mr-2" />
                  Rejeitar
                </button>
                
                {userProfile?.role === 'operator' && (
                  <button
                    onClick={() => handleCompleteRequest(request)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Finalizar
                  </button>
                )}
              </div>
            )}
            {canApprove && request.status === 'approved' && (
              <div className="flex space-x-3">
                <button
                  onClick={() => handleStartQuotation(request)}
                  className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Iniciar Cotação
                </button>
            
              {(['admin', 'operator'].includes(userProfile?.role) || userProfile?.name === request.requestedBy) && (
                <button
                  onClick={() => handleCompleteRequest(request)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Finalizar Retirada
                </button>
                )}
              </div>
            )}

            {/* Botão de visualização de assinatura para solicitações finalizadas */}
            {request.status === 'completed' && request.receiver_signature && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() =>
                      setViewSignature({
                        name: request.received_by || 'Não informado',
                        signature: request.receiver_signature,
                      })
                    }
                    className="flex items-center text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                  >
                    <PenTool className="w-4 h-4 mr-2" />
                    Ver assinatura do recebedor
                  </button>
                </div>
            )}
          </div>
        ))}
      </div>
      
    {filteredRequests.length === 0 && (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-100">
        <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma solicitação encontrada</h3>
        <p className="text-gray-500">
          {userProfile?.role === 'requester' 
            ? 'Crie a primeira solicitação de retirada de materiais.'
            : 'Nenhuma solicitação corresponde aos filtros aplicados.'
          }
        </p>
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