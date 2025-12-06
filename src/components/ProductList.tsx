import React, { useState, useEffect } from 'react';
import { Search, Filter, Package, AlertTriangle, Calendar, Edit, Trash2, X, Save, Plus, Minus, ArrowUpDown } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { Product } from '../types';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useNotification } from '../hooks/useNotification';
import { useDialog } from '../hooks/useDialog';
import { useAuth } from '../hooks/useAuth';
import Notification from './Notification';
import ConfirmDialog from './ConfirmDialog';
import InputDialog from './InputDialog';
import AddStockModal from './AddStockModal';


const ProductList: React.FC = () => {
  const { products, updateProduct, addMovement, suppliers, deleteProduct, setProducts, fetchProducts, addProductChangeLog } = useInventory();
  const navigate = useNavigate();
  const { notification, showSuccess, showError, hideNotification } = useNotification();
  const { confirmDialog, showConfirmDialog, hideConfirmDialog, handleConfirmDialogConfirm, inputDialog, showInputDialog, hideInputDialog, handleInputDialogConfirm } = useDialog();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'general' | 'technical'>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'low-stock' | 'expired'>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editFormData, setEditFormData] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);


  // Estados para o modal de movimentação
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [movementData, setMovementData] = useState({
    quantity: 0,
    reason: 'internal-consumption' as any,
    notes: '',
    authorizedBy: ''
  });

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('category');

      if (!error && data) {
        const unique = Array.from(new Set(data.map(item => item.category).filter(Boolean)));
        setCategories(unique);
      }
    };

    fetchCategories();
  }, []);

  // Sincronizar dados do modal quando a lista de produtos é atualizada
  React.useEffect(() => {
    if (editingProduct && products.length > 0) {
      const updatedProduct = products.find(p => p.id === editingProduct.id);
      if (updatedProduct) {
        setEditingProduct(updatedProduct);
        setEditFormData({ ...updatedProduct });
      }
    }
  }, [products, editingProduct?.id]);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStatusBadge = (status: Product['status']) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Ativo</span>;
      case 'low-stock':
        return <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">Estoque Baixo</span>;
      case 'expired':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Vencido</span>;
      default:
        return null;
    }
  };

  const getCategoryBadge = (category: Product['category']) => {
    const categoryLabel = category === 'general' ? 'Uso Geral' : 
                         category === 'technical' ? 'Insumo Técnico' :
                         category.split('-').map(word => 
                           word.charAt(0).toUpperCase() + word.slice(1)
                         ).join(' ');
    
    const colorClass = category === 'general' ? 'bg-blue-100 text-blue-800' :
                      category === 'technical' ? 'bg-purple-100 text-purple-800' :
                      'bg-blue-200 text-blue-900';
    
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>
      {categoryLabel}
    </span>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleEditClick = (product: Product) => {
    const currentProduct = products.find(p => p.id === product.id) || product;
    setEditingProduct(currentProduct);
    setEditFormData({ ...currentProduct });
  };

  const handleDeleteProduct = async (id: string) => {
    showConfirmDialog(
      'Confirmar Exclusão',
      'Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.',
      async () => {
        try {
          await deleteProduct(id);
          setProducts(prev => prev.filter(p => p.id !== id));
          showSuccess('Produto excluído com sucesso!');
        } catch (error) {
          console.error('Erro ao excluir produto:', error);
          showError('Erro ao excluir produto', 'Tente novamente.');
        }
      },
      { type: 'danger', confirmText: 'Excluir' }
    );
  };

  const handleCloseModal = () => {
    setEditingProduct(null);
    setEditFormData(null);
  };

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, type, value, checked } = e.target as HTMLInputElement;

    setEditFormData((prev) => {
      if (!prev) return null;

      let newValue: any;

      if (type === 'checkbox') {
        newValue = checked;
      } else if (name === 'quantity' || name === 'minStock') {
        newValue = parseInt(value) || 0;
      } else if (name === 'unitPrice') {
        newValue = parseFloat(value) || 0;
      } else {
        newValue = value;
      }

      const updated = { ...prev, [name]: newValue };

      // Recalcular valor total se quantidade ou preço mudaram
      if (name === 'quantity' || name === 'unitPrice') {
        updated.totalValue = updated.quantity * updated.unitPrice;
      }

      return updated;
    });
  };

  const getFieldChanges = (original: Product, updated: Product) => {
    const changes: { field: string; oldValue: string; newValue: string }[] = [];

    const fieldLabels: Record<string, string> = {
      name: 'Nome',
      code: 'Código',
      category: 'Categoria',
      quantity: 'Quantidade',
      unit: 'Unidade',
      supplierName: 'Fornecedor',
      batch: 'Lote',
      entryDate: 'Data de Entrada',
      expirationDate: 'Data de Validade',
      location: 'Localização',
      minStock: 'Estoque Mínimo',
      unitPrice: 'Preço Unitário',
      invoiceNumber: 'Nota fiscal',
      isWithholding: 'Produto com Retenção'
    };

    Object.keys(fieldLabels).forEach(key => {
      let originalValue: string;
      let updatedValue: string;

      // Mapear os campos que têm nomes diferentes no banco
      if (key === 'invoiceNumber') {
        originalValue = String(original.invoiceNumber || '');
        updatedValue = String(updated.invoiceNumber || '');
      } else if (key === 'isWithholding') {
        originalValue = String(original.isWithholding || false);
        updatedValue = String(updated.isWithholding || false);
      } else {
        originalValue = String(original[key as keyof Product] || '');
        updatedValue = String(updated[key as keyof Product] || '');
      }

      if (originalValue !== updatedValue) {
        changes.push({
          field: fieldLabels[key],
          oldValue: key === 'unitPrice' ? formatCurrency(Number(originalValue)) :
            key === 'isWithholding' ? (originalValue === 'true' ? 'Sim' : 'Não') :
              originalValue,
          newValue: key === 'unitPrice' ? formatCurrency(Number(updatedValue)) :
            key === 'isWithholding' ? (updatedValue === 'true' ? 'Sim' : 'Não') :
              updatedValue
        });
      }
    });

    return changes;
  };
  
const handleSaveChanges = async () => {
  if (!editingProduct || !editFormData) return;

  const changes = getFieldChanges(editingProduct, editFormData);
  if (changes.length === 0) {
    showError('Nenhuma alteração foi feita.');
    return;
  }

  const reason = await showInputDialog(
    'Motivo da Alteração',
    'Digite o motivo da alteração:',
    {
      placeholder: 'Ex: Correção de dados, atualização de preço, etc.',
      required: true
    }
  );

  if (!reason?.trim()) return;

  try {
    setIsSubmitting(true);

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      showError('Usuário não autenticado', 'Você precisa estar logado para salvar alterações.');
      return;
    }

    const changedBy = user.user_metadata?.full_name || user.email || user.id;

    editFormData.totalValue = editFormData.unitPrice * editFormData.quantity;

    // Salvar log de alteração no banco
    const now = new Date();
    await addProductChangeLog({
      productId: editingProduct.id,
      productName: editingProduct.name,
      changedBy,
      changeReason: reason,
      changeDate: now.toISOString().split('T')[0],
      changeTime: now.toLocaleTimeString('pt-BR'),
      fieldChanges: changes
    });

    await updateProduct(editingProduct.id, editFormData);
    await fetchProducts();

    showSuccess('Produto atualizado com sucesso!');
    handleCloseModal();
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    showError('Erro ao atualizar produto', 'Tente novamente.');
  } finally {
    setIsSubmitting(false);
  }
};

  // Funções para os novos botões
  const handleAddStock = (product: Product) => {
    setSelectedProduct(product);
  };

  const handleConfirmAddStock = async (quantity: number) => {
    if (!selectedProduct) return;

    const newQuantity = selectedProduct.quantity + quantity;
    const updatedProduct = {
      ...selectedProduct,
      quantity: newQuantity,
      totalValue: newQuantity * selectedProduct.unitPrice,
    };

    try {
      await updateProduct(selectedProduct.id, updatedProduct);
      await fetchProducts();
      showSuccess(`✅ Estoque atualizado! Nova quantidade: ${newQuantity}`);
    } catch (error) {
      console.error(error);
      showError('Erro ao adicionar estoque', 'Tente novamente.');
    } finally {
      setSelectedProduct(null);
    }
  };

  const handleRemoveStock = (product: Product) => {
    setSelectedProduct(product);
    setMovementData({
      quantity: 0,
      reason: 'internal-consumption',
      notes: '',
      authorizedBy: ''
    });
    setShowMovementModal(true);
  };

  const handleCloseMovementModal = () => {
    setShowMovementModal(false);
    setSelectedProduct(null);
    setMovementData({
      quantity: 0,
      reason: 'internal-consumption',
      notes: '',
      authorizedBy: ''
    });
  };

  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      await addMovement({
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: 'out',
        reason: movementData.reason,
        quantity: movementData.quantity,
        date: new Date().toISOString().split('T')[0],
        authorizedBy: movementData.authorizedBy,
        notes: movementData.notes,
        unitPrice: selectedProduct.unitPrice,
        totalValue: movementData.quantity * selectedProduct.unitPrice
      });

      showSuccess('Movimentação registrada com sucesso!');
      handleCloseMovementModal();
    } catch (error) {
      console.error('Erro ao registrar movimentação:', error);
      showError('Erro ao registrar movimentação', 'Tente novamente.');
    }
  };

  const reasonLabels = {
    'sale': 'Ajuste de Estoque',
    'internal-transfer': 'Transferência Interna',
    'return': 'Devolução',
    'internal-consumption': 'Consumo Interno',
    'other': 'Outros'
  };

  const exportToExcel = () => {
    const data = filteredProducts.map(product => ({
      FORNECEDOR: product.supplierName || 'N/A',
      CODIGO_PRODUTO: product.code,
      'NOME DO PRODUTO': product.name,
      NF: product.invoiceNumber || 'N/A',
      VALOR: product.unitPrice.toFixed(2),
      QUANTIDADE: product.quantity,
      'VALOR TOTAL': (product.unitPrice * product.quantity).toFixed(2),
      'DATA DE COMPETÊNCIA': product.entryDate ? product.entryDate.slice(0, 7) : 'N/A',
      RETENÇÃO: product.isWithholding ? 'Sim' : 'Não'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data, { cellDates: true });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório');

    const filename = `relatorio_produtos_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const fieldMap: Record<string, string> = {
    name: 'name',
    code: 'code',
    category: 'category',
    quantity: 'quantity',
    unit: 'unit',
    supplier: 'supplier',
    batch: 'batch',
    entryDate: 'entry_date',
    expirationDate: 'expiration_date',
    location: 'location',
    minStock: 'min_stock',
    unitPrice: 'unit_price',
    invoiceNumber: 'invoicenumber',
    isWithholding: 'iswithholding',
    supplierId: 'supplier_id',
    supplierName: 'supplier_name'
  };

const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const reader = new FileReader();

    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const workbook = XLSX.read(bstr, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const rawData = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: null });

      // Normaliza as chaves das colunas
      const normalizedData = rawData.map((item: any) => {
        const normalized: any = {};
        for (const key in item) {
          const cleanKey = key.trim().toLowerCase().replace(/\s+/g, "");
          // Se vier NaN, undefined ou "", vira null
          const value = item[key];
          normalized[cleanKey] =
            value === "" || value === undefined || Number.isNaN(value) ? null : value;
        }
        return normalized;
      });

      // Verifica campos obrigatórios
      const missing = normalizedData.some(
        (item: any) => !item.name || !item.code || !item.category || item.quantity == null
      );
      if (missing) {
        showError("Arquivo contém produtos com campos obrigatórios faltando.");
        return;
      }

      const { data: existingProducts } = await supabase.from("products").select("code");
      const existingCodes = existingProducts?.map((p) => p.code) || [];
      
      // Converte serial do Excel para data ISO (YYYY-MM-DD)
      const excelDateToISO = (serial: number): string => {
        const utcDays = Math.floor(serial - 25569);
        const date = new Date(utcDays * 86400 * 1000);
        return date.toISOString().split("T")[0];
      };

      // Mapeia para o formato do banco
      const productsToInsert = normalizedData
        .filter((item: any) => !existingCodes.includes(item.code))
        .map((item: any) => ({
          name: item.name,
          code: item.code,
          category: item.category,
          quantity: Number(item.quantity),
          unit: item.unit || null,
          supplier: item.supplier || null,
          batch: item.batch || null,
          entry_date:
            typeof item.entry_date === "number"
              ? excelDateToISO(item.entry_date)
              : item.entry_date || null,
          expiration_date:
            typeof item.expiration_date === "number"
              ? excelDateToISO(item.expiration_date)
              : item.expiration_date || null,
          location: item.location || null,
          min_stock: item.minstock != null ? Number(item.minstock) : 0,
          unit_price: item.unitprice != null ? Number(item.unitprice) : 0,
          invoicenumber: item.invoicenumber || null,
          iswithholding:
            item.iswithholding === true ||
            (typeof item.iswithholding === "string" &&
              item.iswithholding.toLowerCase() === "sim"),
          supplier_name: item.supplier_name || null,
        }));

      // Envia para o Supabase
      const { error } = await supabase.from("products").insert(productsToInsert);

      if (error) {
        console.error("Erro ao importar:", error);
        showError("Erro ao importar produtos.");
      } else {
        showSuccess("Importação concluída com sucesso!");
        window.location.reload();
      }
    };

    reader.readAsBinaryString(file);
  } catch (err) {
    console.error("Erro ao ler o arquivo:", err);
    showError("Erro ao processar o arquivo.");
  }
};

  const Info = ({
    label,
    value,
    bold = false,
    extraClass = ''
  }: {
    label: string;
    value: React.ReactNode;
    bold?: boolean;
    extraClass?: string;
  }) => (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600 ">{label}:</span>
      <span className={`text-sm ${bold ? 'font-bold text-blue-600' : 'text-gray-800'} ${extraClass}`}>
        {value}
      </span>
    </div>
  );

  return (
    <>
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

      <InputDialog
        isOpen={inputDialog.isOpen}
        title={inputDialog.title}
        message={inputDialog.message}
        placeholder={inputDialog.placeholder}
        confirmText={inputDialog.confirmText}
        cancelText={inputDialog.cancelText}
        onConfirm={handleInputDialogConfirm}
        onCancel={hideInputDialog}
        required={inputDialog.required}
      />

      <div className="space-y-6">
        {/* Filtros e Ações */}
      <div className="bg-white rounded-2xl shadow-md p-4 sm:p-6 border border-gray-100 animate-fade-in-up">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Campo de busca */}
          <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none text-sm transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
            />
          </div>

          {/* Botão de exportação */}
          <button
            onClick={exportToExcel}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white py-2.5 px-4 rounded-xl text-sm transition-all duration-200 shadow-md shadow-green-500/25 hover:shadow-lg hover:shadow-green-500/30 font-medium"
          >
            <span className="hidden sm:inline">Exportar Relatório (Excel)</span>
            <span className="sm:hidden">Exportar Excel</span>
          </button>

          {/* Input de importação */}
          <label className="relative w-full flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-600 bg-gray-50/50 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-all duration-200 font-medium">
            <span className="hidden sm:inline">Importar Arquivo</span>
            <span className="sm:hidden">Importar</span>
            <input
              type="file"
              accept=".csv, .xlsx"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>

          {/* Filtro de categoria */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none text-sm transition-all duration-200 hover:border-gray-300 bg-gray-50/50 cursor-pointer"
          >
            <option value="all">Todas Categorias</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'general'
                  ? 'Uso Geral'
                  : category === 'technical'
                    ? 'Insumos Técnicos'
                    : category.replace(/-/g, ' ').replace(/(^|\s)\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>

          {/* Filtro de status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none text-sm transition-all duration-200 hover:border-gray-300 bg-gray-50/50 cursor-pointer"
          >
            <option value="all">Todos Status</option>
            <option value="active">Ativo</option>
            <option value="low-stock">Estoque Baixo</option>
            <option value="expired">Vencido</option>
          </select>
        </div>

        {/* Resultado da filtragem */}
        <div className="mt-4 flex items-center text-sm text-gray-500">
          <Filter className="w-4 h-4 mr-2" />
          <span className="font-medium">{filteredProducts.length}</span>&nbsp;produto(s) encontrado(s)
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredProducts.map((product, index) => (
          <div 
            key={product.id} 
            className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-blue-200 transition-all duration-300 md:hover:-translate-y-1 animate-fade-in-up group"
            style={{ animationDelay: `${Math.min(index * 0.05, 0.3)}s` }}
          >
            <div className="p-4 sm:p-6">
              {/* Cabeçalho */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mr-3 shadow-md shadow-blue-500/25 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                    <Package className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 group-hover:text-blue-600 transition-colors truncate">{product.name}</h3>
                    <p className="text-xs sm:text-sm text-gray-500">{product.code}</p>
                  </div>
                </div>
                {/* Botões sempre visíveis em mobile, hover em desktop */}
                <div className="flex space-x-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0 ml-2">
                  <button onClick={() => handleEditClick(product)} className="p-2 text-blue-500 md:text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Editar produto">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteProduct(product.id)} className="p-2 text-red-500 md:text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Excluir produto">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Informações agrupadas */}
              <div className="space-y-4 divide-y divide-gray-200">
                {/* Informações Gerais */}
                <div className="space-y-2 pb-3">
                  <Info label="Categoria" value={getCategoryBadge(product.category)} />
                  <Info label="Status" value={getStatusBadge(product.status)} />
                  <Info label="Quantidade" value={`${product.quantity} ${product.unit}`} extraClass={product.status === 'low-stock' ? 'text-orange-600' : 'text-gray-800'} />
                  <Info label="Estoque Mínimo" value={product.minStock} />
                </div>

                {/* Valores Financeiros */}
                <div className="space-y-2 py-3">
                  <Info label="Preço Unitário" value={formatCurrency(product.unitPrice)} />
                  <Info label="Valor Total" value={formatCurrency(product.totalValue)} bold />
                  <Info label="Nota Fiscal" value={product.invoiceNumber || '—'} />
                  <Info label="Com Retenção?" value={product.isWithholding ? 'Sim' : 'Não'} extraClass={product.isWithholding ? 'text-red-600' : 'text-gray-500'} />
                </div>

                {/* Fornecedor */}
                <div className="space-y-2 py-3 align-self-center">
                  <Info label="Fornecedor (vinculado)" value={product.supplierName || '—'} />
                </div>

                {/* Datas e Localização */}
                <div className="space-y-2 pt-3">
                  <Info label="Lote" value={product.batch} />
                  <Info label="Localização" value={product.location} />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Validade:</span>
                    <div className="flex items-center">
                      <span className="text-sm text-gray-800 mr-2">{product.expirationDate}</span>
                      {new Date(product.expirationDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                        <Calendar className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Alerta de Estoque Baixo */}
              {product.status === 'low-stock' && (
                <div className="flex items-center justify-center p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl mt-4 border border-orange-100">
                  <AlertTriangle className="w-4 h-4 text-orange-500 mr-2 animate-pulse" />
                  <span className="text-sm text-orange-700 font-medium">Estoque abaixo do mínimo ({product.minStock})</span>
                </div>
              )}

              {/* Ações */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedProduct(product)}
                    className="px-3 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 flex items-center justify-center text-sm font-medium shadow-md shadow-green-500/25 hover:shadow-lg hover:shadow-green-500/30 transition-all duration-200"
                    title="Adicionar estoque"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Adicionar
                  </button>
                  <button
                    onClick={() => handleRemoveStock(product)}
                    disabled={product.quantity === 0}
                    className="px-3 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl hover:from-red-600 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium shadow-md shadow-red-500/25 hover:shadow-lg hover:shadow-red-500/30 transition-all duration-200"
                    title="Retirar estoque"
                  >
                    <Minus className="w-4 h-4 mr-1" /> Retirar
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-100 animate-fade-in">
          <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum produto encontrado</h3>
          <p className="text-gray-500">Tente ajustar os filtros de busca ou adicione novos produtos ao sistema.</p>
        </div>
      )}
      </div>

      {/* Movement Modal */}
      {showMovementModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Registrar Saída</h2>
              <button
                onClick={handleCloseMovementModal}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <form onSubmit={handleMovementSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Produto</label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                  {selectedProduct.name} - {selectedProduct.code}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Estoque disponível: {selectedProduct.quantity} {selectedProduct.unit}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantidade *</label>
                <input
                  type="number"
                  value={movementData.quantity}
                  onChange={(e) => setMovementData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                  required
                  min="1"
                  max={selectedProduct.quantity}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Motivo *</label>
                <select
                  value={movementData.reason}
                  onChange={(e) => setMovementData(prev => ({ ...prev, reason: e.target.value as any }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="internal-consumption">Consumo Interno</option>
                  <option value="sale">Venda</option>
                  <option value="internal-transfer">Transferência Interna</option>
                  <option value="return">Devolução</option>
                  <option value="other">Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Autorizado por *</label>
                <input
                  type="text"
                  value={movementData.authorizedBy}
                  onChange={(e) => setMovementData(prev => ({ ...prev, authorizedBy: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nome do responsável"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                <textarea
                  value={movementData.notes}
                  onChange={(e) => setMovementData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Informações adicionais (opcional)"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseMovementModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center"
                >
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  Registrar Saída
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

          {/* Add Stock Modal */}
          {selectedProduct && !showMovementModal && (
            <AddStockModal
              isOpen={!!selectedProduct}   // 👈 aqui
              product={selectedProduct}
              onClose={() => setSelectedProduct(null)}
              onConfirm={handleConfirmAddStock}
            />
          )}

      {/* Edit Product Modal */}
      {editingProduct && editFormData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Editar Produto</h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Produto *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={editFormData.name}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Código *
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={editFormData.code}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Categoria *
                  </label>
                  <select
                    name="category"
                    value={editFormData.category}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Todas as Categorias</option>
                    {categories.map(category => (
                      <option key={category} value={category}>
                        {category === 'general'
                          ? 'Uso Geral'
                          : category === 'technical'
                            ? 'Insumos Técnicos'
                            : category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
                  <select
                    name="supplierName"
                    value={editFormData.supplierName || ''}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Selecione um fornecedor</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.name}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantidade *
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={editFormData.quantity}
                    onChange={handleFormChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unidade de Medida *
                  </label>
                  <input
                    type="text"
                    name="unit"
                    value={editFormData.unit}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preço Unitário (R$) *
                  </label>
                  <input
                    type="number"
                    name="unitPrice"
                    value={editFormData.unitPrice}
                    onChange={handleFormChange}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Valor Total
                  </label>
                  <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium">
                    {formatCurrency(editFormData.totalValue)}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lote *
                  </label>
                  <input
                    type="text"
                    name="batch"
                    value={editFormData.batch}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nota Fiscal
                  </label>
                  <input
                    type="text"
                    name="invoiceNumber"
                    value={editFormData.invoiceNumber || ''}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Número da nota fiscal"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Localização *
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={editFormData.location}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data de Entrada *
                  </label>
                  <input
                    type="date"
                    name="entryDate"
                    value={editFormData.entryDate}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data de Validade *
                  </label>
                  <input
                    type="date"
                    name="expirationDate"
                    value={editFormData.expirationDate}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estoque Mínimo *
                  </label>
                  <input
                    type="number"
                    name="minStock"
                    value={editFormData.minStock}
                    onChange={handleFormChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="isWithholding"
                    checked={editFormData.isWithholding || false}
                    onChange={handleFormChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="text-sm text-gray-700">Produto com retenção?</label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProductList;