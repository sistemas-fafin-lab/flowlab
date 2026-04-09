import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, DollarSign, Calendar, Package, Building2 } from 'lucide-react';
import { Quotation, InvitedSupplier, SubmitProposalInput } from '../types';

interface SupplierOption {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

interface AddProposalModalProps {
  isOpen: boolean;
  quotation: Quotation;
  suppliers: InvitedSupplier[];
  allSuppliers?: SupplierOption[];
  onClose: () => void;
  onSubmit: (data: SubmitProposalInput) => Promise<void>;
}

interface ItemProposal {
  itemId: string;
  unitPrice: number;
  deliveryDays: number;
  notes: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const AddProposalModal: React.FC<AddProposalModalProps> = ({
  isOpen,
  quotation,
  suppliers,
  allSuppliers,
  onClose,
  onSubmit,
}) => {
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [proposalNotes, setProposalNotes] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [itemProposals, setItemProposals] = useState<ItemProposal[]>(
    quotation.items.map(item => ({
      itemId: item.id,
      unitPrice: item.estimatedUnitPrice || 0,
      deliveryDays: 7,
      notes: '',
    }))
  );
  const [loading, setLoading] = useState(false);

  // Build the unified supplier options: invited suppliers first, then any un-invited from allSuppliers
  const supplierOptions: { id: string; name: string; isInvited: boolean }[] = (() => {
    const invitedIds = new Set(suppliers.map(s => s.supplierId));
    const alreadyProposed = new Set(quotation.proposals.map(p => p.supplierId));
    
    const options: { id: string; name: string; isInvited: boolean }[] = [];
    
    // Add invited suppliers that haven't proposed yet
    suppliers.forEach(s => {
      if (!alreadyProposed.has(s.supplierId)) {
        options.push({ id: s.supplierId, name: s.supplierName, isInvited: true });
      }
    });
    
    // Add non-invited suppliers from allSuppliers (manual flow)
    if (allSuppliers) {
      allSuppliers.forEach(s => {
        if (!invitedIds.has(s.id) && !alreadyProposed.has(s.id)) {
          options.push({ id: s.id, name: s.name, isInvited: false });
        }
      });
    }
    
    return options;
  })();

  const updateItemProposal = (itemId: string, field: keyof ItemProposal, value: any) => {
    setItemProposals(prev =>
      prev.map(ip => (ip.itemId === itemId ? { ...ip, [field]: value } : ip))
    );
  };

  const getTotalAmount = () => {
    return itemProposals.reduce((sum, ip) => {
      const item = quotation.items.find(i => i.id === ip.itemId);
      if (!item) return sum;
      return sum + (ip.unitPrice * item.quantity);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) return;

    setLoading(true);
    try {
      const proposalData: SubmitProposalInput = {
        quotationId: quotation.id,
        supplierId: selectedSupplierId,
        items: itemProposals.map(ip => ({
          quotationItemId: ip.itemId,
          unitPrice: ip.unitPrice,
          deliveryTime: `${ip.deliveryDays} dias`,
          notes: ip.notes || undefined,
        })),
        deliveryTime: `${Math.max(...itemProposals.map(ip => ip.deliveryDays))} dias`,
        notes: proposalNotes || undefined,
        validUntil: validUntil || undefined,
      };

      await onSubmit(proposalData);
      onClose();
    } catch (error) {
      console.error('Error submitting proposal:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Adicionar Proposta</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{quotation.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Supplier Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fornecedor *
              </label>
              {supplierOptions.length === 0 ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
                  Todos os fornecedores disponíveis já enviaram propostas.
                </div>
              ) : (
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                >
                  <option value="">Selecione um fornecedor</option>
                  {supplierOptions.filter(s => s.isInvited).length > 0 && (
                    <optgroup label="Fornecedores convidados">
                      {supplierOptions.filter(s => s.isInvited).map(supplier => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {supplierOptions.filter(s => !s.isInvited).length > 0 && (
                    <optgroup label="Outros fornecedores (manual)">
                      {supplierOptions.filter(s => !s.isInvited).map(supplier => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}
            </div>

            {selectedSupplierId && (
              <>
                {/* Items */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Preços por Item
                  </h3>
                  <div className="space-y-4">
                    {quotation.items.map((item, index) => {
                      const itemProposal = itemProposals.find(ip => ip.itemId === item.id)!;
                      return (
                        <div key={item.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                          <div className="flex items-start gap-3 mb-4">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-gray-100">{item.productName}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {item.quantity} {item.unit}
                                {item.estimatedUnitPrice && (
                                  <span className="ml-2 text-gray-400 dark:text-gray-500">
                                    (Est: {formatCurrency(item.estimatedUnitPrice)}/un)
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Unit Price */}
                            <div>
                              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                Preço Unitário (R$) *
                              </label>
                              <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="number"
                                  value={itemProposal.unitPrice || ''}
                                  onChange={(e) => updateItemProposal(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                  step="0.01"
                                  min="0"
                                  required
                                  className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                  placeholder="0,00"
                                />
                              </div>
                            </div>

                            {/* Delivery Days */}
                            <div>
                              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                Prazo de Entrega (dias) *
                              </label>
                              <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="number"
                                  value={itemProposal.deliveryDays || ''}
                                  onChange={(e) => updateItemProposal(item.id, 'deliveryDays', parseInt(e.target.value) || 0)}
                                  min="1"
                                  required
                                  className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                  placeholder="7"
                                />
                              </div>
                            </div>

                            {/* Total */}
                            <div>
                              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                Total do Item
                              </label>
                              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                                {formatCurrency(itemProposal.unitPrice * item.quantity)}
                              </div>
                            </div>
                          </div>

                          {/* Item Notes */}
                          <div className="mt-3">
                            <input
                              type="text"
                              value={itemProposal.notes}
                              onChange={(e) => updateItemProposal(item.id, 'notes', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              placeholder="Observações do item (opcional)"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Validity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Validade da Proposta
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* General Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Observações Gerais
                  </label>
                  <textarea
                    value={proposalNotes}
                    onChange={(e) => setProposalNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Condições de pagamento, garantias, etc..."
                  />
                </div>

                {/* Total Summary */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Valor Total da Proposta</span>
                    <span className="text-xl font-bold text-blue-900 dark:text-blue-200">
                      {formatCurrency(getTotalAmount())}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !selectedSupplierId || supplierOptions.length === 0}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              {loading ? 'Salvando...' : 'Salvar Proposta'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default AddProposalModal;
