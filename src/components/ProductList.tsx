import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, Package, AlertTriangle, Calendar, Edit, Trash2, X, Save, Plus, Minus, ArrowUpDown, Download, Upload, ChevronDown, CheckCircle } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { Product } from '../types';
import { ProductListSkeleton } from './PageLoadingSkeleton';
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
  const { products, updateProduct, addMovement, suppliers, deleteProduct, setProducts, fetchProducts, addProductChangeLog, loading } = useInventory();
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

  // ── Dropdown de Categoria ──────────────────────────────────────────────────
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!categoryDropdownOpen) return;
    const handle = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [categoryDropdownOpen]);

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
        return <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full">Ativo</span>;
      case 'low-stock':
        return <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 rounded-full">Estoque Baixo</span>;
      case 'expired':
        return <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-full">Vencido</span>;
      default:
        return null;
    }
  };

  const getCategoryBadge = (category: Product['category']) => {
    const categoryLabel = category === 'general' ? 'Uso Geral' :
                         category === 'technical' ? 'Insumo Técnico' :
                         (category as string).split('-').map(word =>
                           word.charAt(0).toUpperCase() + word.slice(1)
                         ).join(' ');

    const colorClass = category === 'general'
      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
      : category === 'technical'
      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
      : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20';

    return <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full ${colorClass}`}>
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
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}:</span>
      <span className={`text-sm ${bold ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'} ${extraClass}`}>
        {value}
      </span>
    </div>
  );

  // ── Contagem por status (considera busca + categoria activas) ────────────────
  const getStatusCount = (s: string) =>
    products.filter(p => {
      const matchSearch = !searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      return matchSearch && matchCat && (s === 'all' || p.status === s);
    }).length;

  // Loading state
  if (loading) {
    return <ProductListSkeleton />;
  }

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
        {/* ── Barra de Filtros (Glassmorphism) ─────────────────────────────── */}
        <div className="relative z-20 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-sm p-4 sm:p-5 animate-fade-in-up space-y-3">

          {/* Linha 1: busca + dropdown categoria + ações */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por nome ou código…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Dropdown personalizado de Categoria */}
              <div className="relative" ref={categoryDropdownRef}>
                <button
                  type="button"
                  onClick={() => setCategoryDropdownOpen(v => !v)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border whitespace-nowrap ${
                    categoryFilter !== 'all'
                      ? 'bg-blue-500/10 border-blue-400 dark:border-blue-500 text-blue-700 dark:text-blue-300'
                      : categoryDropdownOpen
                        ? 'bg-slate-100 dark:bg-slate-800 border-blue-300 dark:border-blue-600 text-slate-700 dark:text-slate-200 ring-4 ring-blue-500/10'
                        : 'bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>
                    {categoryFilter === 'all' ? 'Categoria' :
                     categoryFilter === 'general' ? 'Uso Geral' :
                     categoryFilter === 'technical' ? 'Insumos Técnicos' :
                     (categoryFilter as string).replace(/-/g, ' ').replace(/(^|\s)\w/g, l => l.toUpperCase())}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${categoryDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {categoryDropdownOpen && (
                  <div className="absolute z-40 top-[calc(100%+6px)] left-0 min-w-[200px] bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200/70 dark:border-slate-700/70 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 py-1 overflow-hidden">
                    {[
                      { value: 'all', label: 'Todas as Categorias' },
                      ...categories.map(c => ({
                        value: c,
                        label: c === 'general' ? 'Uso Geral' :
                               c === 'technical' ? 'Insumos Técnicos' :
                               c.replace(/-/g, ' ').replace(/(^|\s)\w/g, l => l.toUpperCase())
                      }))
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setCategoryFilter(opt.value as any); setCategoryDropdownOpen(false); }}
                        className={`w-full flex items-center justify-between px-3.5 py-2 text-sm text-left transition-colors ${
                          categoryFilter === opt.value
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        {opt.label}
                        {categoryFilter === opt.value && <CheckCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Exportar */}
              <button
                onClick={exportToExcel}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-sm font-medium transition-all"
                title="Exportar Relatório (Excel)"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Exportar</span>
              </button>

              {/* Importar */}
              <label className="relative flex items-center gap-1.5 px-3 py-2.5 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-sm font-medium transition-all cursor-pointer" title="Importar Arquivo">
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Importar</span>
                <input type="file" accept=".csv, .xlsx" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              </label>
            </div>
          </div>

          {/* Linha 2: chips de status com badge de contagem */}
          <div className="flex items-center gap-2 flex-wrap">
            {(
              [
                { value: 'all',       label: 'Todos',         activeClass: 'bg-slate-700 dark:bg-slate-200 text-white dark:text-slate-900 border-transparent shadow-lg shadow-slate-500/20' },
                { value: 'active',    label: 'Ativo',         activeClass: 'bg-emerald-500 text-white border-transparent shadow-lg shadow-emerald-500/25' },
                { value: 'low-stock', label: 'Estoque Baixo', activeClass: 'bg-orange-500 text-white border-transparent shadow-lg shadow-orange-500/25' },
                { value: 'expired',   label: 'Vencido',       activeClass: 'bg-red-500 text-white border-transparent shadow-lg shadow-red-500/25' },
              ] as const
            ).map(opt => {
              const count = products.filter(p => {
                const matchSearch = !searchTerm ||
                  p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  p.code.toLowerCase().includes(searchTerm.toLowerCase());
                const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
                return matchSearch && matchCat && (opt.value === 'all' || p.status === opt.value);
              }).length;
              const isActive = statusFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                    isActive
                      ? opt.activeClass
                      : 'bg-white/60 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                  <span className={`inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-md text-[11px] font-bold ${
                    isActive ? 'bg-white/25' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
            <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
              <span className="font-semibold text-slate-600 dark:text-slate-300">{filteredProducts.length}</span> produto(s)
            </span>
          </div>

        </div>

        {/* ── Grade de Produtos (Premium Glassmorphism) ────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredProducts.map((product, index) => {
            const stockPct = Math.min(
              (product.quantity / ((product.minStock || 0) * 2 || 1)) * 100,
              100
            );
            const isLow = product.quantity <= (product.minStock || 0);

            return (
              <div
                key={product.id}
                className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl rounded-2xl transition-all duration-300 hover:shadow-2xl hover:-translate-y-0.5 animate-fade-in-up group"
                style={{ animationDelay: `${Math.min(index * 0.05, 0.3)}s` }}
              >
                <div className="p-5">

                  {/* Cabeçalho: ícone + nome + ações */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
                        <Package className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {product.name}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-mono">{product.code}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0 ml-2">
                      <button onClick={() => handleEditClick(product)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-all" title="Editar produto">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteProduct(product.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all" title="Excluir produto">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                    {getStatusBadge(product.status)}
                    {getCategoryBadge(product.category)}
                  </div>

                  {/* Quantidade em destaque + barra de progresso de estoque */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-2xl font-bold leading-none transition-colors ${
                          isLow ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'
                        }`}>
                          {product.quantity}
                        </span>
                        <span className="text-sm font-normal text-slate-400">{product.unit}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isLow && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                        )}
                        <span className={`text-xs font-medium transition-colors ${
                          isLow ? 'text-red-500 dark:text-red-400' : 'text-slate-400'
                        }`}>
                          mín. {product.minStock}
                        </span>
                      </div>
                    </div>
                    <div className={`h-1.5 w-full rounded-full overflow-hidden transition-colors ${
                      isLow ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-100 dark:bg-slate-800'
                    }`}>
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isLow
                            ? 'bg-gradient-to-r from-red-500 to-orange-400'
                            : 'bg-gradient-to-r from-emerald-400 to-blue-400'
                        }`}
                        style={{ width: `${stockPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Mini-grid de informações */}
                  <div className="grid grid-cols-2 gap-2.5 p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Preço Unit.</p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{formatCurrency(product.unitPrice)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Valor Total</p>
                      <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatCurrency(product.totalValue)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Lote</p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{product.batch || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Localização</p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{product.location || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Validade</p>
                      <div className="flex items-center gap-1">
                        <p className={`text-sm font-medium truncate ${product.status === 'expired' ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>
                          {product.expirationDate || '—'}
                        </p>
                        {product.expirationDate && new Date(product.expirationDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                          <Calendar className="w-3 h-3 text-red-400 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Fornecedor</p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{product.supplierName || '—'}</p>
                    </div>
                  </div>

                  {/* Alerta de Estoque Baixo */}
                  {product.status === 'low-stock' && (
                    <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 animate-pulse" />
                      <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">Abaixo do mínimo ({product.minStock})</span>
                    </div>
                  )}

                  {/* Botões de ação — pill style */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100/70 dark:border-slate-800/70">
                    <button
                      onClick={() => setSelectedProduct(product)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-xs font-semibold transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Entrada
                    </button>
                    <button
                      onClick={() => handleRemoveStock(product)}
                      disabled={product.quantity === 0}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-red-500/10 text-red-500 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Minus className="w-3.5 h-3.5" />
                      Saída
                    </button>
                  </div>

                </div>
              </div>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-12 text-center animate-fade-in">
            <Package className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">Nenhum produto encontrado</h3>
            <p className="text-sm text-slate-400 dark:text-slate-500">Ajuste os filtros ou adicione novos produtos ao sistema.</p>
          </div>
        )}
      </div>

      {/* Movement Modal */}
      {showMovementModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-100">Registrar Saída</h2>
              <button
                onClick={handleCloseMovementModal}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <form onSubmit={handleMovementSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Produto</label>
                <div className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200">
                  {selectedProduct.name} - {selectedProduct.code}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Estoque disponível: {selectedProduct.quantity} {selectedProduct.unit}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quantidade *</label>
                <input
                  type="number"
                  value={movementData.quantity}
                  onChange={(e) => setMovementData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                  required
                  min="1"
                  max={selectedProduct.quantity}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Motivo *</label>
                <select
                  value={movementData.reason}
                  onChange={(e) => setMovementData(prev => ({ ...prev, reason: e.target.value as any }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                >
                  <option value="internal-consumption">Consumo Interno</option>
                  <option value="sale">Venda</option>
                  <option value="internal-transfer">Transferência Interna</option>
                  <option value="return">Devolução</option>
                  <option value="other">Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Autorizado por *</label>
                <input
                  type="text"
                  value={movementData.authorizedBy}
                  onChange={(e) => setMovementData(prev => ({ ...prev, authorizedBy: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                  placeholder="Nome do responsável"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Observações</label>
                <textarea
                  value={movementData.notes}
                  onChange={(e) => setMovementData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                  placeholder="Informações adicionais (opcional)"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseMovementModal}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
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
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-100">Editar Produto</h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nome do Produto *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={editFormData.name}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Código *
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={editFormData.code}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Categoria *
                  </label>
                  <select
                    name="category"
                    value={editFormData.category}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fornecedor</label>
                  <select
                    name="supplierName"
                    value={editFormData.supplierName || ''}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Quantidade *
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={editFormData.quantity}
                    onChange={handleFormChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Unidade de Medida *
                  </label>
                  <input
                    type="text"
                    name="unit"
                    value={editFormData.unit}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Preço Unitário (R$) *
                  </label>
                  <input
                    type="number"
                    name="unitPrice"
                    value={editFormData.unitPrice}
                    onChange={handleFormChange}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Valor Total
                  </label>
                  <div className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200 font-medium">
                    {formatCurrency(editFormData.totalValue)}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Lote *
                  </label>
                  <input
                    type="text"
                    name="batch"
                    value={editFormData.batch}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nota Fiscal
                  </label>
                  <input
                    type="text"
                    name="invoiceNumber"
                    value={editFormData.invoiceNumber || ''}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                    placeholder="Número da nota fiscal"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Localização *
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={editFormData.location}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Data de Entrada *
                  </label>
                  <input
                    type="date"
                    name="entryDate"
                    value={editFormData.entryDate}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Data de Validade *
                  </label>
                  <input
                    type="date"
                    name="expirationDate"
                    value={editFormData.expirationDate}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Estoque Mínimo *
                  </label>
                  <input
                    type="number"
                    name="minStock"
                    value={editFormData.minStock}
                    onChange={handleFormChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="isWithholding"
                    checked={editFormData.isWithholding || false}
                    onChange={handleFormChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                  />
                  <label className="text-sm text-gray-700 dark:text-gray-300">Produto com retenção?</label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
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