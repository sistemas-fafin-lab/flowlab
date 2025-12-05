import React, { useState, useEffect } from 'react';
import { Plus, Package, Save, X } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { Product } from '../types';
import { useLocation } from 'react-router-dom';
import { supabase} from '../lib/supabase.ts';
import { useNotification } from '../hooks/useNotification';
import Notification from './Notification';

const AddProduct: React.FC = () => {
  const { addProduct } = useInventory();
  const location = useLocation();
  const prefilledData = location.state?.prefilledData;
  const { notification, showSuccess, showError, hideNotification } = useNotification();

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(['general']);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    const fetchSuppliers = async () => {
      const { data, error } = await supabase.from('suppliers').select('*');
      if (!error && data) setSuppliers(data);
    };
    
    const fetchCategories = async () => {
      // Buscar categorias únicas dos produtos existentes
      const { data, error } = await supabase
        .from('products')
        .select('category')
        .order('category');
      
      if (!error && data) {
        const uniqueCategories = [...new Set(data.map(item => item.category))];
        const allCategories = [...new Set([...categories, ...uniqueCategories])];
        setCategories(allCategories);
      }
    };
    
    fetchSuppliers();
    fetchCategories();
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: 'general',
    quantity: 0,
    unit: '',
    supplier: '',
    batch: '',
    entryDate: new Date().toISOString().split('T')[0],
    expirationDate: '',
    location: '',
    minStock: 0,
    unitPrice: 0,
    invoiceNumber: '',
    isWithholding: false,
    supplierId: '',
    supplierName: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preencher dados se vier da lista de produtos
  useEffect(() => {
    if (prefilledData) {
      setFormData(prev => ({
        ...prev,
        ...prefilledData,
        // Resetar campos específicos para nova entrada
        quantity: 0,
        batch: '',
        entryDate: new Date().toISOString().split('T')[0],
        expirationDate: '',
        // Gerar novo código baseado no original
        code: prefilledData.code ? `${prefilledData.code}-${Date.now().toString().slice(-4)}` : ''
      }));
    }
  }, [prefilledData]);

  // Calcular valor total automaticamente
  const totalValue = formData.quantity * formData.unitPrice;

  const handleAddNewCategory = () => {
    if (!newCategoryName.trim()) {
      showError('Digite um nome para a nova categoria');
      return;
    }

    const categoryKey = newCategoryName.toLowerCase().replace(/\s+/g, '-');
    
    if (categories.includes(categoryKey)) {
      showError('Esta categoria já existe');
      return;
    }

    setCategories(prev => [...prev, categoryKey]);
    setFormData(prev => ({ ...prev, category: categoryKey }));
    setNewCategoryName('');
    setShowNewCategoryInput(false);
    showSuccess('Nova categoria adicionada com sucesso!');
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'general': 'Uso Geral',
    };
    
    return labels[category] || category.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Determine status based on quantity and expiration
      let status: Product['status'] = 'active';
      if (formData.quantity <= formData.minStock) {
        status = 'low-stock';
      }
      const expirationDate = new Date(formData.expirationDate);
      if (expirationDate <= new Date()) {
        status = 'expired';
      }

      await addProduct({
        ...formData,
        status,
        totalValue
      });

      showSuccess('Produto adicionado com sucesso!');
      setFormData({
        name: '',
        code: '',
        category: 'general',
        quantity: 0,
        unit: '',
        supplier: '',
        batch: '',
        entryDate: new Date().toISOString().split('T')[0],
        expirationDate: '',
        location: '',
        minStock: 0,
        unitPrice: 0,
        invoiceNumber: '',
        isWithholding: false,
        supplierId: '',
        supplierName: ''
      });

    } catch (error) {
      console.error('Erro ao adicionar produto:', error);
      showError('Erro ao adicionar produto', 'Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' || name === 'minStock' ? parseInt(value) || 0 : 
              name === 'unitPrice' ? parseFloat(value) || 0 : value
    }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up">
      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />

      {/* Info Message for Stock Addition */}
      {prefilledData && (
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 flex items-center animate-scale-in shadow-sm">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/25">
              <Package className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="ml-4">
            <p className="text-sm font-semibold text-blue-800">
              Adicionando estoque para: {prefilledData.name}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Alguns campos foram pré-preenchidos. Ajuste conforme necessário.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-shadow duration-300">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mr-4 shadow-md shadow-blue-500/25">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                {prefilledData ? 'Adicionar Estoque' : 'Cadastrar Novo Produto'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">Preencha os dados do produto</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Nome do Produto *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
                placeholder="Ex: Luvas de Látex"
              />
            </div>

            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                Código *
              </label>
              <input
                type="text"
                id="code"
                name="code"
                value={formData.code}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
                placeholder="Ex: LAT001"
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                Categoria *
              </label>
              <div className="flex space-x-2">
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50 cursor-pointer"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {getCategoryLabel(category)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewCategoryInput(true)}
                  className="px-3 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-200 flex items-center shadow-md shadow-green-500/25"
                  title="Adicionar nova categoria"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              {/* Input para nova categoria */}
              {showNewCategoryInput && (
                <div className="mt-2 flex space-x-2 animate-fade-in-up">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nome da nova categoria"
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNewCategory();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddNewCategory}
                    className="px-3 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 shadow-md shadow-blue-500/25"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewCategoryInput(false);
                      setNewCategoryName('');
                    }}
                    className="px-3 py-2.5 bg-gray-400 text-white rounded-xl hover:bg-gray-500 transition-all duration-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
                Quantidade *
              </label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                required
                min="0"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
              />
            </div>

            <div>
              <label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-2">
                Unidade de Medida *
              </label>
              <input
                type="text"
                id="unit"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
                placeholder="Ex: caixas, litros, unidades"
              />
            </div>

            <div>
              <label htmlFor="unitPrice" className="block text-sm font-medium text-gray-700 mb-2">
                Preço Unitário (R$) *
              </label>
              <input
                type="number"
                id="unitPrice"
                name="unitPrice"
                value={formData.unitPrice}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
                placeholder="0,00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor Total
              </label>
              <div className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 font-semibold">
                {formatCurrency(totalValue)}
              </div>
            </div>

            <div>
              <label htmlFor="batch" className="block text-sm font-medium text-gray-700 mb-2">
                Lote *
              </label>
              <input
                type="text"
                id="batch"
                name="batch"
                value={formData.batch}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
                placeholder="Ex: LT240315"
              />
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                Localização *
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
                placeholder="Ex: Prateleira A1, Geladeira B2"
              />
            </div>

            <div>
              <label htmlFor="entryDate" className="block text-sm font-medium text-gray-700 mb-2">
                Data de Entrada *
              </label>
              <input
                type="date"
                id="entryDate"
                name="entryDate"
                value={formData.entryDate}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nota Fiscal</label>
              <input
              type="text"
              id="invoiceNumber"
              name="invoiceNumber"
              value={formData.invoiceNumber}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
              placeholder="Número da nota fiscal"
            />
            </div>
            
              <div className="flex items-center space-x-3 py-2">
                <input
                  type="checkbox"
                  id="isWithholding"
                  name="isWithholding"
                  checked={formData.isWithholding}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, isWithholding: e.target.checked }))
                  }
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded-lg cursor-pointer"
                />
                <label htmlFor="isWithholding" className="text-sm text-gray-700 cursor-pointer">Produto com retenção?</label>
              </div>

            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fornecedor</label>
              <select
                name="supplierId"
                value={formData.supplierId}
                onChange={(e) => {
                  const selected = suppliers.find(s => s.id === e.target.value);
                  setFormData(prev => ({
                    ...prev,
                    supplierId: e.target.value,
                    supplierName: selected?.name || ''
                  }));
                }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50 cursor-pointer"
              >
                <option value="">Selecione um fornecedor</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
            </div>
          
            <div>
              <label htmlFor="expirationDate" className="block text-sm font-medium text-gray-700 mb-2">
                Data de Validade *
              </label>
              <input
                type="date"
                id="expirationDate"
                name="expirationDate"
                value={formData.expirationDate}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50 cursor-pointer"
              />
            </div>

            <div>
              <label htmlFor="minStock" className="block text-sm font-medium text-gray-700 mb-2">
                Estoque Mínimo *
              </label>
              <input
                type="number"
                id="minStock"
                name="minStock"
                value={formData.minStock}
                onChange={handleChange}
                required
                min="0"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setFormData({
                name: '',
                code: '',
                category: 'general',
                quantity: 0,
                unit: '',
                supplier: '',
                batch: '',
                entryDate: new Date().toISOString().split('T')[0],
                expirationDate: '',
                location: '',
                minStock: 0,
                unitPrice: 0,
                invoiceNumber: '',
                isWithholding: false,
                supplierId: '',
                supplierName: ''
              })}
              className="px-5 py-2.5 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium"
            >
              Limpar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium flex items-center shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {prefilledData ? 'Adicionar Estoque' : 'Salvar Produto'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProduct;