import React, { useState } from 'react';
import { Building2, Plus, Edit, Trash2, X, Save, Phone, Mail, MapPin, User } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { useNotification } from '../hooks/useNotification';
import { useDialog } from '../hooks/useDialog';
import { Supplier } from '../types';
import Notification from './Notification';
import ConfirmDialog from './ConfirmDialog';
import InputDialog from './InputDialog';

const SupplierManagement: React.FC = () => {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useInventory();
  const { notification, showSuccess, showError, hideNotification } = useNotification();
  const { showConfirmDialog } = useDialog();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    email: '',
    phone: '',
    address: '',
    contactPerson: '',
    products: [] as string[],
    status: 'active' as 'active' | 'inactive'
  });

  const resetForm = () => {
    setFormData({
      name: '',
      cnpj: '',
      email: '',
      phone: '',
      address: '',
      contactPerson: '',
      products: [],
      status: 'active'
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, formData);
        showSuccess('Fornecedor atualizado com sucesso!');
      } else {
        await addSupplier(formData);
        showSuccess('Fornecedor adicionado com sucesso!');
      }

      resetForm();
      setShowAddForm(false);
      setEditingSupplier(null);
    } catch (error) {
      console.error('Erro ao salvar fornecedor:', error);
      showError('Erro ao salvar fornecedor. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setFormData({
      name: supplier.name,
      cnpj: supplier.cnpj,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address || '',
      contactPerson: supplier.contactPerson || '',
      products: supplier.products || [],
      status: supplier.status
    });
    setEditingSupplier(supplier);
    setShowAddForm(true);
  };

  const handleCancel = () => {
    resetForm();
    setShowAddForm(false);
    setEditingSupplier(null);
  };

  const handleDelete = async (id: string, name: string) => {
    showConfirmDialog(
      'Confirmar Exclusão',
      'Tem certeza que deseja excluir o fornecedor "${name}"? Esta ação não pode ser desfeita.',
      async () => {
        try {
          await deleteSupplier(id);
          showSuccess('Fornecedor excluído com sucesso!');
        } catch (error) {
          console.error('Erro ao excluir fornecedor:', error);
          showError('Erro ao excluir fornecedor. Tente novamente.');
        }
      },
      { type: 'danger', confirmText: 'Excluir' }
    );
  };

  const formatCNPJ = (cnpj: string) => {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  const formatPhone = (phone: string) => {
    return phone.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
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

      {/* Header */}
      <div className="flex justify-between items-center animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Gerenciamento de Fornecedores</h2>
          <p className="text-gray-500">Cadastre e gerencie fornecedores do sistema</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 flex items-center font-medium shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Fornecedor
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
            </h3>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-xl transition-all duration-200">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Empresa *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">CNPJ *</label>
              <input
                type="text"
                value={formData.cnpj}
                onChange={(e) => setFormData(prev => ({ ...prev, cnpj: e.target.value }))}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Telefone *</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pessoa de Contato</label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50 cursor-pointer"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Endereço</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Produtos Oferecidos</label>
              <input
                type="text"
                value={formData.products.join(', ')}
                onChange={(e) =>
                  setFormData(prev => ({
                    ...prev,
                    products: e.target.value.split(',').map(p => p.trim()).filter(Boolean)
                  }))
                }
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
              />
            </div>

            <div className="md:col-span-2 flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2.5 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 transition-all duration-200 font-medium shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30"
              >
                {isSubmitting ? 'Salvando...' : editingSupplier ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de Fornecedores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suppliers.map((supplier, index) => (
          <div 
            key={supplier.id} 
            className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-blue-100 transition-all duration-300 hover:-translate-y-1 animate-fade-in-up group"
            style={{ animationDelay: `${Math.min(index * 0.05, 0.25)}s` }}
          >
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mr-3 shadow-md shadow-blue-500/25 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                    <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 group-hover:text-blue-600 transition-colors truncate">{supplier.name}</h3>
                    <p className="text-xs sm:text-sm text-gray-500">{formatCNPJ(supplier.cnpj)}</p>
                  </div>
                </div>
                {/* Botões sempre visíveis em mobile */}
                <div className="flex space-x-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0 ml-2">
                  <button onClick={() => handleEdit(supplier)} className="p-2 text-blue-500 md:text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Editar">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(supplier.id, supplier.name)} className="p-2 text-red-500 md:text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      supplier.status === 'active'
                        ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 text-green-700 border border-green-200'
                        : 'bg-gradient-to-r from-red-500/10 to-rose-500/10 text-red-700 border border-red-200'
                    }`}
                  >
                    {supplier.status === 'active' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div className="flex items-center group/item">
                  <Mail className="w-4 h-4 text-gray-400 mr-2 group-hover/item:text-blue-500 transition-colors" />
                  <span className="text-sm text-gray-700">{supplier.email}</span>
                </div>

                <div className="flex items-center group/item">
                  <Phone className="w-4 h-4 text-gray-400 mr-2 group-hover/item:text-blue-500 transition-colors" />
                  <span className="text-sm text-gray-700">{formatPhone(supplier.phone)}</span>
                </div>

                {supplier.contactPerson && (
                  <div className="flex items-center group/item">
                    <User className="w-4 h-4 text-gray-400 mr-2 group-hover/item:text-blue-500 transition-colors" />
                    <span className="text-sm text-gray-700">{supplier.contactPerson}</span>
                  </div>
                )}

                {supplier.address && (
                  <div className="flex items-start group/item">
                    <MapPin className="w-4 h-4 text-gray-400 mr-2 mt-0.5 group-hover/item:text-blue-500 transition-colors" />
                    <span className="text-sm text-gray-700">{supplier.address}</span>
                  </div>
                )}

                {supplier.products && supplier.products.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Produtos oferecidos:</p>
                    <div className="flex flex-wrap gap-1">
                      {supplier.products.slice(0, 3).map((product, index) => (
                        <span key={index} className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full">
                          {product}
                        </span>
                      ))}
                      {supplier.products.length > 3 && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                          +{supplier.products.length - 3} mais
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {suppliers.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-100 animate-fade-in-up">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum fornecedor cadastrado</h3>
          <p className="text-gray-500">Cadastre o primeiro fornecedor para começar a gerenciar cotações.</p>
        </div>
      )}
    </div>
  );
};

export default SupplierManagement;