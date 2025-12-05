import React, { useState } from 'react';
import { FileText, Plus, Check, X, User, Package, Building2, Calendar, Download, Search, Filter as FilterIcon, Trash2, Bold, Italic, List } from 'lucide-react';
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
import RequestChat from './RequestChat';
import SignatureModal from './SignatureModal';
import SignatureViewModal from './SignatureViewModal';
import { MessageSquare } from 'lucide-react';
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gerenciamento de Solicitações</h2>
          <p className="text-gray-600">Controle de requisições para retirada de materiais</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={generateReport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Relatório
          </button>
          <button
            onClick={() => {
              handleNewRequestClick();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Solicitação
          </button>
        </div>
      </div>

      {/* Add Request Form */}
      {showAddRequest && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Nova {typeLabels[newRequest.type]}
            </h3>
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${typeColors[newRequest.type]}`}>
              {newRequest.type}
            </span>
          </div>
          
{/* Busca e Adição de Produtos */}
<div className="mb-6 p-4 bg-gray-50 rounded-lg">
  <h4 className="text-md font-medium text-gray-700 mb-3">Adicionar Produtos</h4>
  
  <div className="grid grid-cols-1 md:flex md:flex-wrap md:items-center md:gap-4">
        
    {/* Campo de busca */}
    <div className="relative w-full md:flex-1">
      <label className="block text-sm font-medium text-gray-600 mb-1">Buscar</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Buscar produtos..."
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-2"
        />
      </div>
    </div>

    {/* Filtro de categoria */}
    <div className="w-full md:w-52">
      <label className="block text-sm font-medium text-gray-600 mb-1">Categoria</label>
      <select
        value={categoryFilter}
        onChange={(e) => setCategoryFilter(e.target.value as any)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
    <div className="w-full md:w-auto">
      <label className="block text-sm font-medium text-gray-600 mb-1">Quantidade</label>
      <input
        type="number"
        placeholder="Quantidade"
        value={selectedQuantity}
        onChange={(e) => setSelectedQuantity(parseInt(e.target.value) || 1)}
        min="1"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>

    {/* Botão de adicionar */}
    <div className="w-full md:w-auto">
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
        className={`w-full md:w-auto px-4 py-2 text-white rounded-lg flex items-center justify-center transition-colors ${
          matchedProduct ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700'
        }`}
      >
        <Plus className="w-4 h-4 mr-2" />
        {matchedProduct ? 'Adicionar' : 'Adicionar Produto Não Cadastrado'}
      </button>
    </div>
     </div>
            {/* Lista de produtos filtrados */}
            {productSearch && (
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredProducts.map(product => (
                  <div
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product.id);
                      setProductSearch(product.name);
                    }}
                    className={`p-3 cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-b-0 ${
                      selectedProduct === product.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-800">{product.name}</p>
                        <p className="text-sm text-gray-500">{product.code} - {product.category}</p>
                      </div>
                      <span className="text-sm text-gray-600">Estoque: {product.quantity} {product.unit}</span>
                    </div>
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="p-3 text-center text-gray-500">Nenhum produto encontrado</div>
                )}
              </div>
            )}
          </div>

          {/* Produtos Adicionados */}
          {newRequest.items.length > 0 && (
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-700 mb-3">Produtos na Solicitação</h4>
              <div className="space-y-2">
                {newRequest.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center">
                      <Package className="w-4 h-4 text-blue-600 mr-2" />
                      <div>
                        <p className="font-medium text-gray-800">{item.productName}</p>
                        <p className="text-sm text-gray-600">Quantidade: {item.quantity}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeProductFromRequest(item.id)}
                      className="text-red-600 hover:text-red-800"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Justificativa/Descrição *</label>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 p-2 bg-gray-50 border-b border-gray-300">
                  <button
                    type="button"
                    onClick={() => applyFormatting('**', '**')}
                    className="p-2 hover:bg-gray-200 rounded transition-colors"
                    title="Negrito"
                  >
                    <Bold className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormatting('*', '*')}
                    className="p-2 hover:bg-gray-200 rounded transition-colors"
                    title="Itálico"
                  >
                    <Italic className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    type="button"
                    onClick={insertBulletPoint}
                    className="p-2 hover:bg-gray-200 rounded transition-colors"
                    title="Lista com marcadores"
                  >
                    <List className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                <textarea
                  ref={textareaRef}
                  value={newRequest.reason}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, reason: e.target.value }))}
                  required
                  rows={5}
                  className="w-full px-3 py-2 border-0 focus:ring-0 focus:outline-none resize-none"
                  placeholder="Descreva o motivo da solicitação e o detalhamento dos itens..."
                />
              </div>
              {newRequest.reason && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1 font-medium">Pré-visualização:</p>
                  <div className="text-sm text-gray-800">{renderFormattedText(newRequest.reason)}</div>
                </div>
              )}
            </div>

            <div className="md:col-span-2 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowAddRequest(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Enviar Solicitação
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Type Selection Modal */}
      {showTypeSelectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">Tipo de Solicitação</h2>
              <p className="text-sm text-gray-600 mt-1">Selecione o tipo de solicitação que deseja criar</p>
            </div>

            <div className="p-6 space-y-4">
              <button
                onClick={() => handleTypeSelection('SC')}
                className="w-full p-4 border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors text-left"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Solicitação de Compra (SC)</h3>
                    <p className="text-sm text-gray-600">Para produtos que precisam ser comprados</p>
                    <p className="text-xs text-green-600 mt-1">✓ Sempre disponível</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleTypeSelection('SM')}
                className="w-full p-4 border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Solicitação de Material (SM)</h3>
                    <p className="text-sm text-gray-600">Para retirada de produtos do estoque</p>
                    {!isPeriodOpen && userProfile?.role === 'requester' && (
                      <p className="text-xs text-red-600 mt-1">⚠ Período fechado</p>
                    )}
                  </div>
                </div>
              </button>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
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
        {filteredRequests.map((request) => (
          <div key={request.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <FileText className="w-6 h-6 text-blue-600 mr-3" />
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
                  <div key={index} className="flex items-center p-2 bg-gray-50 rounded">
                    <Package className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-700">{item.productName} - {item.quantity} unidades</span>
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
              <div className="text-gray-800 bg-gray-200 p-3 rounded-lg">{renderFormattedText(request.reason)}</div>
               <button
                  onClick={() => setChatRequestId(request.id)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Chat
                </button>
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