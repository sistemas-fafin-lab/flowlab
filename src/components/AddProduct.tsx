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
    <div className="max-w-2xl mx-auto">
      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />

      {/* Info Message for Stock Addition */}
      {prefilledData && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Package className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-blue-800">
              Adicionando estoque para: {prefilledData.name}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Alguns campos foram pré-preenchidos. Ajuste conforme necessário.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <Package className="w-6 h-6 text-blue-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-800">
              {prefilledData ? 'Adicionar Estoque' : 'Cadastrar Novo Produto'}
            </h2>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
                  title="Adicionar nova categoria"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              {/* Input para nova categoria */}
              {showNewCategoryInput && (
                <div className="mt-2 flex space-x-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nome da nova categoria"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewCategoryInput(false);
                      setNewCategoryName('');
                    }}
                    className="px-3 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0,00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor Total
              </label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nota Fiscal</label>
              <input
              type="text"
              id="invoiceNumber"
              name="invoiceNumber"
              value={formData.invoiceNumber}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Número da nota fiscal"
            />
            </div>
            
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isWithholding"
                  name="isWithholding"
                  checked={formData.isWithholding}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, isWithholding: e.target.checked }))
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isWithholding" className="text-sm text-gray-700">Produto com retenção?</label>
              </div>

            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
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
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Limpar
            </button>
            <button
              type="submit"
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