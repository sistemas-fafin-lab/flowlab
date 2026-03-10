import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Building2,
  Package,
  DollarSign,
  Calendar,
  FileText,
  AlertCircle,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { Department, DepartmentLabels } from '../../../types';
import { CreateQuotationInput, QuotationItem } from '../types';
import { useInventory } from '../../../hooks/useInventory';

interface CreateQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateQuotationInput) => Promise<void>;
  suppliers: { id: string; name: string; email: string }[];
  linkedRequest?: {
    id: string;
    code: string;
    items: { productName: string; quantity: number; unit?: string }[];
  };
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baixa', color: 'bg-gray-100 text-gray-800' },
  { value: 'medium', label: 'Média', color: 'bg-blue-100 text-blue-800' },
  { value: 'high', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  { value: 'urgent', label: 'Urgente', color: 'bg-red-100 text-red-800' },
];

const DEPARTMENTS = Object.entries(DepartmentLabels).map(([value, label]) => ({
  value: value as Department,
  label,
}));

interface ItemForm {
  productName: string;
  quantity: number;
  unit: string;
  category: string;
  estimatedUnitPrice?: number;
  description?: string;
}

export const CreateQuotationModal: React.FC<CreateQuotationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  suppliers,
  linkedRequest,
}) => {
  const { products } = useInventory();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'info' | 'items' | 'suppliers' | 'review'>(linkedRequest ? 'suppliers' : 'info');
  
  // Form state
  const [title, setTitle] = useState(linkedRequest ? `Cotação - ${linkedRequest.code}` : '');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState<Department>('ESTOQUE');
  const [costCenter, setCostCenter] = useState('');
  const [justification, setJustification] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [responseDeadline, setResponseDeadline] = useState('');
  const [deliveryDeadline, setDeliveryDeadline] = useState('');
  
  // Items
  const [items, setItems] = useState<ItemForm[]>(
    linkedRequest?.items.map(item => ({
      productName: item.productName,
      quantity: item.quantity,
      unit: item.unit || 'un',
      category: 'general',
    })) || []
  );
  const [newItem, setNewItem] = useState<ItemForm>({
    productName: '',
    quantity: 1,
    unit: 'un',
    category: 'general',
  });
  
  // Product search state
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'general' | 'technical'>('all');
  const [selectedProduct, setSelectedProduct] = useState('');
  
  // Suppliers
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');

  const filteredSuppliers = suppliers.filter(
    s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
         s.email.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  // Filter products based on search and category
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                         product.code.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Check if search matches an exact product
  const matchedProduct = products.find(
    (p) => p.name.toLowerCase().trim() === productSearch.toLowerCase().trim()
  );

  const categories = ['general', 'technical'];

  const handleAddItem = () => {
    if (newItem.productName.trim() && newItem.quantity > 0) {
      setItems([...items, { ...newItem }]);
      setNewItem({ productName: '', quantity: 1, unit: 'un', category: 'general' });
      setProductSearch('');
      setSelectedProduct('');
    }
  };

  const handleAddItemFromInventory = () => {
    if (selectedProduct) {
      const product = products.find(p => p.id === selectedProduct);
      if (product) {
        setItems([...items, {
          productName: product.name,
          quantity: newItem.quantity,
          unit: product.unit || 'un',
          category: product.category || 'general',
          estimatedUnitPrice: product.unitPrice,
        }]);
        setNewItem({ productName: '', quantity: 1, unit: 'un', category: 'general' });
        setProductSearch('');
        setSelectedProduct('');
      }
    }
  };

  const handleAddUnregisteredProduct = () => {
    if (!productSearch.trim()) return;
    
    setItems([...items, {
      productName: productSearch.trim(),
      quantity: newItem.quantity,
      unit: newItem.unit,
      category: 'não cadastrado',
    }]);
    setNewItem({ productName: '', quantity: 1, unit: 'un', category: 'general' });
    setProductSearch('');
    setSelectedProduct('');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleToggleSupplier = (supplierId: string) => {
    setSelectedSuppliers(prev =>
      prev.includes(supplierId)
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    );
  };

  const canProceed = () => {
    switch (step) {
      case 'info':
        return title.trim().length > 0 && department;
      case 'items':
        return items.length > 0;
      case 'suppliers':
        return selectedSuppliers.length > 0;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!canProceed()) {
      console.log('handleSubmit: canProceed returned false');
      return;
    }
    
    setLoading(true);
    const submitData = {
      title,
      description: description || undefined,
      requestId: linkedRequest?.id,
      department,
      costCenter: costCenter || undefined,
      justification: justification || undefined,
      priority,
      responseDeadline: responseDeadline || undefined,
      deliveryDeadline: deliveryDeadline || undefined,
      items: items.map(item => ({
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        estimatedUnitPrice: item.estimatedUnitPrice,
        description: item.description,
      })),
      supplierIds: selectedSuppliers,
    };
    console.log('handleSubmit: Submitting data:', submitData);
    
    try {
      await onSubmit(submitData);
      console.log('handleSubmit: onSubmit completed successfully');
      onClose();
    } catch (error) {
      console.error('Error creating quotation:', error);
    } finally {
      setLoading(false);
    }
  };

  const estimatedTotal = items.reduce(
    (sum, item) => sum + (item.estimatedUnitPrice || 0) * item.quantity,
    0
  );

  if (!isOpen) return null;

  const steps = linkedRequest 
    ? ['suppliers', 'review'] as const
    : ['info', 'items', 'suppliers', 'review'] as const;
  const currentStepIndex = steps.indexOf(step as any);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Nova Cotação</h2>
              {linkedRequest && (
                <p className="text-sm text-gray-500 mt-0.5">
                  Vinculada à requisição {linkedRequest.code}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Steps indicator */}
          <div className="flex items-center gap-2 mt-4">
            {steps.map((s, index) => (
              <React.Fragment key={s}>
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                    index <= currentStepIndex
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <span className="font-medium">{index + 1}.</span>
                  <span>
                    {s === 'info' && 'Informações'}
                    {s === 'items' && 'Itens'}
                    {s === 'suppliers' && 'Fornecedores'}
                    {s === 'review' && 'Revisão'}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 ${index < currentStepIndex ? 'bg-blue-400' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Info Step */}
          {step === 'info' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título da Cotação *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Cotação de Material de Escritório"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Descrição detalhada da cotação..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Departamento *
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value as Department)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Centro de Custo
                  </label>
                  <input
                    type="text"
                    value={costCenter}
                    onChange={(e) => setCostCenter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: CC-001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prioridade
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRIORITY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPriority(opt.value as any)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-all ${
                        priority === opt.value
                          ? `${opt.color} border-transparent ring-2 ring-offset-1 ring-blue-500`
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prazo de Resposta
                  </label>
                  <input
                    type="date"
                    value={responseDeadline}
                    onChange={(e) => setResponseDeadline(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prazo de Entrega
                  </label>
                  <input
                    type="date"
                    value={deliveryDeadline}
                    onChange={(e) => setDeliveryDeadline(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Justificativa
                </label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Justificativa para a cotação..."
                />
              </div>
            </div>
          )}

          {/* Items Step */}
          {step === 'items' && (
            <div className="space-y-4">
              {/* Add Item Form */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Adicionar Item</h3>
                <div className="grid grid-cols-12 gap-3">
                  {/* Product Search */}
                  <div className="col-span-5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Buscar produto..."
                      />
                    </div>
                  </div>
                  
                  {/* Category Filter */}
                  <div className="col-span-2">
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value as any)}
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="all">Todas</option>
                      <option value="general">Geral</option>
                      <option value="technical">Técnico</option>
                    </select>
                  </div>
                  
                  {/* Quantity */}
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Qtd"
                    />
                  </div>
                  
                  {/* Add Button */}
                  <div className="col-span-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (matchedProduct) {
                          handleAddItemFromInventory();
                        } else if (productSearch.trim()) {
                          handleAddUnregisteredProduct();
                        }
                      }}
                      disabled={!productSearch.trim()}
                      className={`w-full px-3 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-1 ${
                        matchedProduct
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-amber-600 hover:bg-amber-700'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                      {matchedProduct ? 'Adicionar' : 'Novo'}
                    </button>
                  </div>
                </div>

                {/* Product not found warning */}
                {productSearch && !matchedProduct && (
                  <div className="mt-3 flex items-center p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mr-2 flex-shrink-0" />
                    <p className="text-xs text-amber-700">
                      <span className="font-medium">Produto não encontrado.</span> Ao adicionar, será criado como "produto não cadastrado".
                    </p>
                  </div>
                )}

                {/* Product dropdown */}
                {productSearch && filteredProducts.length > 0 && (
                  <div className="mt-3 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
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
                        className={`p-3 cursor-pointer hover:bg-blue-50 border-b border-gray-50 last:border-b-0 transition-colors ${
                          selectedProduct === product.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
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

              {/* Items List */}
              {items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                  <p>Nenhum item adicionado</p>
                  <p className="text-sm">Adicione pelo menos um item para continuar</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-200 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                          <span className="text-xs font-bold text-blue-600">#{index + 1}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              item.category === 'não cadastrado'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {item.category === 'não cadastrado' ? '⚠ Não cadastrado' : item.category}
                            </span>
                            <span className="text-xs text-gray-500">•</span>
                            <span className="text-xs font-medium text-blue-600">{item.quantity} {item.unit}</span>
                            {item.estimatedUnitPrice && (
                              <>
                                <span className="text-xs text-gray-500">•</span>
                                <span className="text-xs text-gray-600">Est. R$ {item.estimatedUnitPrice.toFixed(2)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Suppliers Step */}
          {step === 'suppliers' && (
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Buscar fornecedores..."
                />
              </div>

              {selectedSuppliers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedSuppliers.map(id => {
                    const supplier = suppliers.find(s => s.id === id);
                    return supplier ? (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                      >
                        {supplier.name}
                        <button
                          type="button"
                          onClick={() => handleToggleSupplier(id)}
                          className="p-0.5 hover:bg-blue-200 rounded-full"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {filteredSuppliers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Building2 className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                    <p>Nenhum fornecedor encontrado</p>
                  </div>
                ) : (
                  filteredSuppliers.map(supplier => {
                    const isSelected = selectedSuppliers.includes(supplier.id);
                    return (
                      <button
                        key={supplier.id}
                        type="button"
                        onClick={() => handleToggleSupplier(supplier.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-500'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isSelected ? 'bg-blue-100' : 'bg-gray-100'
                          }`}>
                            <Building2 className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
                          </div>
                          <div className="text-left">
                            <p className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                              {supplier.name}
                            </p>
                            <p className="text-xs text-gray-500">{supplier.email}</p>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                        }`}>
                          {isSelected && <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                            <path d="M10.28 2.28L4 8.56 1.72 6.28l-.72.72 3 3 7-7-.72-.72z"/>
                          </svg>}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Review Step */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Resumo da Cotação
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Título:</span>
                    <span className="font-medium text-gray-900">{title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Departamento:</span>
                    <span className="font-medium text-gray-900">{DepartmentLabels[department]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Prioridade:</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      PRIORITY_OPTIONS.find(p => p.value === priority)?.color
                    }`}>
                      {PRIORITY_OPTIONS.find(p => p.value === priority)?.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Summary */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {items.length} Item(ns)
                </h3>
                <div className="space-y-1">
                  {items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-gray-600">{item.productName}</span>
                      <span className="text-gray-900">{item.quantity} {item.unit}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suppliers Summary */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {selectedSuppliers.length} Fornecedor(es)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedSuppliers.map(id => {
                    const supplier = suppliers.find(s => s.id === id);
                    return supplier ? (
                      <span key={id} className="px-2 py-1 bg-white border border-gray-200 text-sm rounded-lg">
                        {supplier.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>

              {estimatedTotal > 0 && (
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-blue-700">Valor Estimado Total:</span>
                    <span className="text-lg font-bold text-blue-900">
                      R$ {estimatedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => {
                const idx = steps.indexOf(step as any);
                if (idx > 0) {
                  setStep(steps[idx - 1]);
                } else {
                  onClose();
                }
              }}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
            >
              {currentStepIndex === 0 ? 'Cancelar' : 'Voltar'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (step === 'review') {
                  handleSubmit();
                } else {
                  const idx = steps.indexOf(step as any);
                  setStep(steps[idx + 1]);
                }
              }}
              disabled={!canProceed() || loading}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Criando...
                </>
              ) : step === 'review' ? (
                'Criar Cotação'
              ) : (
                'Continuar'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateQuotationModal;
