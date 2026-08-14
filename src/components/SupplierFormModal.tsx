import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { Supplier } from '../types';
import { formatCpfCnpj } from '../utils/paymentUtils';

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (supplier: Supplier) => void;
  editingSupplier?: Supplier | null;
}

interface SupplierFormData {
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  address: string;
  contactPerson: string;
  products: string[];
  status: 'active' | 'inactive';
}

type ValidatedField = 'name' | 'cnpj' | 'email' | 'phone';

const emptyFormData: SupplierFormData = {
  name: '',
  cnpj: '',
  email: '',
  phone: '',
  address: '',
  contactPerson: '',
  products: [],
  status: 'active',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatPhoneDisplay = (digits: string): string => {
  if (digits.length === 11) return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (digits.length === 10) return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return digits;
};

const validateField = (field: ValidatedField, data: SupplierFormData): string | undefined => {
  switch (field) {
    case 'name':
      return data.name.trim() ? undefined : 'Informe o nome da empresa.';
    case 'cnpj':
      return data.cnpj.replace(/\D/g, '').length === 14 ? undefined : 'CNPJ deve ter 14 dígitos.';
    case 'email':
      return EMAIL_REGEX.test(data.email.trim()) ? undefined : 'Informe um email válido.';
    case 'phone': {
      const digits = data.phone.replace(/\D/g, '').length;
      return digits === 10 || digits === 11 ? undefined : 'Telefone deve ter 10 ou 11 dígitos (DDD + número).';
    }
  }
};

const validateAll = (data: SupplierFormData): Partial<Record<ValidatedField, string>> => {
  const errors: Partial<Record<ValidatedField, string>> = {};
  (['name', 'cnpj', 'email', 'phone'] as ValidatedField[]).forEach(field => {
    const message = validateField(field, data);
    if (message) errors[field] = message;
  });
  return errors;
};

const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  editingSupplier,
}) => {
  const { addSupplier, updateSupplier } = useInventory();
  const [formData, setFormData] = useState<SupplierFormData>(emptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ValidatedField, string>>>({});

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setFieldErrors({});
    setFormData(
      editingSupplier
        ? {
            name: editingSupplier.name,
            cnpj: editingSupplier.cnpj.replace(/\D/g, ''),
            email: editingSupplier.email,
            phone: editingSupplier.phone.replace(/\D/g, ''),
            address: editingSupplier.address || '',
            contactPerson: editingSupplier.contactPerson || '',
            products: editingSupplier.products || [],
            status: editingSupplier.status,
          }
        : emptyFormData
    );
  }, [isOpen, editingSupplier]);

  const handleFieldBlur = (field: ValidatedField) => {
    setFieldErrors(prev => ({ ...prev, [field]: validateField(field, formData) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const errors = validateAll(formData);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, formData);
        onSaved({ ...editingSupplier, ...formData });
      } else {
        const created = await addSupplier(formData);
        onSaved(created);
      }
      onClose();
    } catch (err) {
      console.error('Erro ao salvar fornecedor:', err);
      setError('Erro ao salvar fornecedor. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70]">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nome da Empresa *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                onBlur={() => handleFieldBlur('name')}
                required
                className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200 bg-gray-50/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 ${
                  fieldErrors.name
                    ? 'border-red-400 dark:border-red-600 focus:ring-red-500'
                    : 'border-gray-200 dark:border-gray-600 focus:ring-blue-500 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              />
              {fieldErrors.name && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">CNPJ *</label>
              <input
                type="text"
                inputMode="numeric"
                value={formatCpfCnpj(formData.cnpj)}
                onChange={(e) => setFormData(prev => ({ ...prev, cnpj: e.target.value.replace(/\D/g, '').slice(0, 14) }))}
                onBlur={() => handleFieldBlur('cnpj')}
                placeholder="00.000.000/0000-00"
                required
                className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200 bg-gray-50/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 ${
                  fieldErrors.cnpj
                    ? 'border-red-400 dark:border-red-600 focus:ring-red-500'
                    : 'border-gray-200 dark:border-gray-600 focus:ring-blue-500 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              />
              {fieldErrors.cnpj && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.cnpj}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                onBlur={() => handleFieldBlur('email')}
                required
                className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200 bg-gray-50/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 ${
                  fieldErrors.email
                    ? 'border-red-400 dark:border-red-600 focus:ring-red-500'
                    : 'border-gray-200 dark:border-gray-600 focus:ring-blue-500 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              />
              {fieldErrors.email && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Telefone *</label>
              <input
                type="text"
                inputMode="numeric"
                value={formatPhoneDisplay(formData.phone)}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                onBlur={() => handleFieldBlur('phone')}
                placeholder="(00) 00000-0000"
                required
                className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200 bg-gray-50/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 ${
                  fieldErrors.phone
                    ? 'border-red-400 dark:border-red-600 focus:ring-red-500'
                    : 'border-gray-200 dark:border-gray-600 focus:ring-blue-500 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              />
              {fieldErrors.phone && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.phone}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pessoa de Contato</label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 cursor-pointer"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Endereço</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Produtos Oferecidos</label>
              <input
                type="text"
                value={formData.products.join(', ')}
                onChange={(e) =>
                  setFormData(prev => ({
                    ...prev,
                    products: e.target.value.split(',').map(p => p.trim()).filter(Boolean)
                  }))
                }
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
        </div>

          <div className="flex-shrink-0 flex justify-end space-x-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 font-medium"
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
    </div>,
    document.body
  );
};

export default SupplierFormModal;
