import React, { useState } from 'react';
import { Building2, Plus, Edit, Trash2, Phone, Mail, MapPin, User } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { useNotification } from '../hooks/useNotification';
import { useDialog } from '../hooks/useDialog';
import { Supplier } from '../types';
import Notification from './Notification';
import ConfirmDialog from './ConfirmDialog';
import InputDialog from './InputDialog';
import SupplierFormModal from './SupplierFormModal';
import { SupplierManagementSkeleton } from './PageLoadingSkeleton';

const SupplierManagement: React.FC = () => {
  const { suppliers, deleteSupplier, loading } = useInventory();
  const { notification, showSuccess, showError, hideNotification } = useNotification();
  const { confirmDialog, showConfirmDialog, hideConfirmDialog } = useDialog();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const handleSaved = (supplier: Supplier) => {
    showSuccess(editingSupplier ? `Fornecedor ${supplier.name} atualizado com sucesso!` : `Fornecedor ${supplier.name} adicionado com sucesso!`);
    setShowAddForm(false);
    setEditingSupplier(null);
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setShowAddForm(true);
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingSupplier(null);
  };

  const handleDelete = async (id: string, name: string) => {
    showConfirmDialog(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir o fornecedor "${name}"? Esta ação não pode ser desfeita.`,
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

  // Loading state
  if (loading) {
    return <SupplierManagementSkeleton />;
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

      {/* Header */}
      <div className="flex justify-between items-center animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">Gerenciamento de Fornecedores</h2>
          <p className="text-gray-500 dark:text-gray-400">Cadastre e gerencie fornecedores do sistema</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 flex items-center font-medium shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Fornecedor
        </button>
      </div>

      {showAddForm && (
        <SupplierFormModal
          isOpen={showAddForm}
          onClose={handleCancel}
          onSaved={handleSaved}
          editingSupplier={editingSupplier}
        />
      )}

      {/* Lista de Fornecedores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suppliers.map((supplier, index) => (
          <div 
            key={supplier.id} 
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:border-blue-100 dark:hover:border-blue-800 transition-all duration-300 hover:-translate-y-1 animate-fade-in-up group"
            style={{ animationDelay: `${Math.min(index * 0.05, 0.25)}s` }}
          >
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mr-3 shadow-md shadow-blue-500/25 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                    <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">{supplier.name}</h3>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{formatCNPJ(supplier.cnpj)}</p>
                  </div>
                </div>
                {/* Botões sempre visíveis em mobile */}
                <div className="flex space-x-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0 ml-2">
                  <button onClick={() => handleEdit(supplier)} className="p-2 text-blue-500 md:text-gray-400 dark:md:text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all" title="Editar">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(supplier.id, supplier.name)} className="p-2 text-red-500 md:text-gray-400 dark:md:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all" title="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
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
                  <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2 group-hover/item:text-blue-500 transition-colors" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{supplier.email}</span>
                </div>

                <div className="flex items-center group/item">
                  <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2 group-hover/item:text-blue-500 transition-colors" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{formatPhone(supplier.phone)}</span>
                </div>

                {supplier.contactPerson && (
                  <div className="flex items-center group/item">
                    <User className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2 group-hover/item:text-blue-500 transition-colors" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{supplier.contactPerson}</span>
                  </div>
                )}

                {supplier.address && (
                  <div className="flex items-start group/item">
                    <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2 mt-0.5 group-hover/item:text-blue-500 transition-colors" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{supplier.address}</span>
                  </div>
                )}

                {supplier.products && supplier.products.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Produtos oferecidos:</p>
                    <div className="flex flex-wrap gap-1">
                      {supplier.products.slice(0, 3).map((product, index) => (
                        <span key={index} className="px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                          {product}
                        </span>
                      ))}
                      {supplier.products.length > 3 && (
                        <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
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

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        type={confirmDialog.type}
        onConfirm={() => {
          confirmDialog.onConfirm?.();
          hideConfirmDialog();
        }}
        onCancel={hideConfirmDialog}
      />

      {suppliers.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-12 text-center border border-gray-100 dark:border-gray-700 animate-fade-in-up">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Nenhum fornecedor cadastrado</h3>
          <p className="text-gray-500 dark:text-gray-400">Cadastre o primeiro fornecedor para começar a gerenciar cotações.</p>
        </div>
      )}
    </div>
  );
};

export default SupplierManagement;