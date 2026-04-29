import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, DollarSign, Calendar, Package, Building2, ChevronDown, Plus, Trash2, Check, Search, CreditCard } from 'lucide-react';
import { Quotation, InvitedSupplier, SubmitProposalInput, PaymentMethod, PaymentMethodLabels } from '../types';

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
  unitPriceStr: string;   // raw string for controlled input
  unitPrice: number;      // parsed number used on submit
  deliveryDays: number;
  notes: string;
}

interface AdditionalCost {
  id: string;
  label: string;
  valueStr: string;
  value: number;
}

const COST_PRESETS = ['Frete', 'ICMS', 'IPI', 'ISS', 'Seguro', 'Outros'];

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [boletoDueDays, setBoletoDueDays] = useState<number>(30);
  const [itemProposals, setItemProposals] = useState<ItemProposal[]>(
    quotation.items.map(item => ({
      itemId: item.id,
      unitPriceStr: item.estimatedUnitPrice ? String(item.estimatedUnitPrice) : '',
      unitPrice: item.estimatedUnitPrice || 0,
      deliveryDays: 7,
      notes: '',
    }))
  );
  const [loading, setLoading] = useState(false);

  // Keep itemProposals in sync when quotation.items IDs change (e.g. legacy→real UUID swap)
  useEffect(() => {
    setItemProposals(prev => {
      const prevMap = new Map(prev.map(ip => [ip.itemId, ip]));
      return quotation.items.map(item => {
        // Try exact match first, then fall back to constructing a new entry
        return prevMap.get(item.id) ?? {
          itemId: item.id,
          unitPriceStr: item.estimatedUnitPrice ? String(item.estimatedUnitPrice) : '',
          unitPrice: item.estimatedUnitPrice || 0,
          deliveryDays: 7,
          notes: '',
        };
      });
    });
  }, [quotation.items]);
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCost[]>([]);
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!supplierDropdownOpen) {
      setSupplierSearch('');
      return;
    }
    // auto-focus search when dropdown opens
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSupplierDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [supplierDropdownOpen]);

  const addAdditionalCost = () => {
    setAdditionalCosts(prev => [
      ...prev,
      { id: crypto.randomUUID(), label: 'Frete', valueStr: '', value: 0 },
    ]);
  };

  const removeAdditionalCost = (id: string) => {
    setAdditionalCosts(prev => prev.filter(c => c.id !== id));
  };

  const updateAdditionalCost = (id: string, field: 'label' | 'valueStr', val: string) => {
    setAdditionalCosts(prev =>
      prev.map(c => {
        if (c.id !== id) return c;
        if (field === 'valueStr') {
          const parsed = parseFloat(val);
          return { ...c, valueStr: val, value: isNaN(parsed) ? 0 : parsed };
        }
        return { ...c, label: val };
      })
    );
  };

  const getItemsTotal = () =>
    itemProposals.reduce((sum, ip) => {
      const item = quotation.items.find(i => i.id === ip.itemId);
      if (!item) return sum;
      return sum + ip.unitPrice * item.quantity;
    }, 0);

  const getAdditionalTotal = () => additionalCosts.reduce((sum, c) => sum + c.value, 0);

  const updateItemProposal = (itemId: string, field: keyof ItemProposal, value: any) => {
    setItemProposals(prev =>
      prev.map(ip => {
        if (ip.itemId !== itemId) return ip;
        if (field === 'unitPriceStr') {
          const parsed = parseFloat(String(value));
          return { ...ip, unitPriceStr: String(value), unitPrice: isNaN(parsed) ? 0 : parsed };
        }
        return { ...ip, [field]: value };
      })
    );
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
        paymentMethod,
        boletoDueDays: paymentMethod === 'boleto' ? boletoDueDays : undefined,
        additionalCosts: additionalCosts.length > 0
          ? additionalCosts.map(c => ({ label: c.label, value: c.value }))
          : undefined,
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full min-h-[600px] max-h-[90vh] flex flex-col">
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
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                <div className="relative" ref={dropdownRef}>
                  {/* Hidden native input for form validation */}
                  <input type="hidden" value={selectedSupplierId} required />

                  {/* Hybrid trigger: when closed shows selected value; when open becomes a search input */}
                  <div
                    className={`w-full flex items-center gap-3 px-4 py-3 border rounded-xl transition-all cursor-text ${
                      supplierDropdownOpen
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-gray-700'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                    onClick={() => setSupplierDropdownOpen(true)}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      selectedSupplierId && !supplierDropdownOpen ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-gray-100 dark:bg-gray-600'
                    }`}>
                      {supplierDropdownOpen
                        ? <Search className="w-4 h-4 text-gray-400" />
                        : <Building2 className={`w-4 h-4 ${selectedSupplierId ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />}
                    </div>

                    {supplierDropdownOpen ? (
                      <input
                        ref={searchRef}
                        type="text"
                        value={supplierSearch}
                        onChange={(e) => setSupplierSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 outline-none placeholder-gray-400 dark:placeholder-gray-500"
                        placeholder="Buscar fornecedor..."
                      />
                    ) : (
                      <div className="flex-1 min-w-0">
                        {selectedSupplierId ? (
                          <>
                            <p className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">
                              {supplierOptions.find(s => s.id === selectedSupplierId)?.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {supplierOptions.find(s => s.id === selectedSupplierId)?.isInvited
                                ? 'Fornecedor convidado'
                                : 'Fornecedor manual'}
                            </p>
                          </>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">Selecione ou busque um fornecedor...</span>
                        )}
                      </div>
                    )}

                    <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${supplierDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>

                  {/* Dropdown list with scroll */}
                  {supplierDropdownOpen && (() => {
                    const q = supplierSearch.toLowerCase();
                    const invited = supplierOptions.filter(s => s.isInvited && s.name.toLowerCase().includes(q));
                    const others = supplierOptions.filter(s => !s.isInvited && s.name.toLowerCase().includes(q));
                    const hasResults = invited.length > 0 || others.length > 0;
                    return (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl z-20 overflow-hidden flex flex-col" style={{ maxHeight: '240px' }}>
                        <div className="overflow-y-auto flex-1">
                          {!hasResults && (
                            <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                              Nenhum fornecedor encontrado para "{supplierSearch}"
                            </div>
                          )}
                          {invited.length > 0 && (
                            <>
                              <div className="sticky top-0 px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700/80 border-b border-gray-100 dark:border-gray-700">
                                Convidados
                              </div>
                              {invited.map(supplier => (
                                <button
                                  key={supplier.id}
                                  type="button"
                                  onClick={() => { setSelectedSupplierId(supplier.id); setSupplierDropdownOpen(false); }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                >
                                  <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                  </div>
                                  <span className="flex-1 text-left text-sm font-medium text-gray-900 dark:text-gray-100">{supplier.name}</span>
                                  <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                                    Convidado
                                  </span>
                                  {selectedSupplierId === supplier.id && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
                                </button>
                              ))}
                            </>
                          )}
                          {others.length > 0 && (
                            <>
                              <div className="sticky top-0 px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700/80 border-b border-gray-100 dark:border-gray-700">
                                Outros fornecedores
                              </div>
                              {others.map(supplier => (
                                <button
                                  key={supplier.id}
                                  type="button"
                                  onClick={() => { setSelectedSupplierId(supplier.id); setSupplierDropdownOpen(false); }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                >
                                  <div className="w-7 h-7 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Building2 className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                                  </div>
                                  <span className="flex-1 text-left text-sm font-medium text-gray-900 dark:text-gray-100">{supplier.name}</span>
                                  {selectedSupplierId === supplier.id && <Check className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />}
                                </button>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {selectedSupplierId && (
              <>
                {/* Items */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Preços por Item
                  </h3>
                  {quotation.items.length === 0 ? (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
                      Esta cotação não possui itens cadastrados. Adicione itens na aba "Itens" antes de registrar propostas.
                    </div>
                  ) : (
                    <div className="space-y-4">
                    {quotation.items.map((item, index) => {
                      const itemProposal = itemProposals.find(ip => ip.itemId === item.id);
                      if (!itemProposal) return null;
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
                                  value={itemProposal.unitPriceStr}
                                  onChange={(e) => updateItemProposal(item.id, 'unitPriceStr', e.target.value)}
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
                  )}
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

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Forma de Pagamento *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['pix', 'credit_card', 'boleto'] as PaymentMethod[]).map(method => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                          paymentMethod === method
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        <CreditCard className="w-4 h-4" />
                        {PaymentMethodLabels[method]}
                      </button>
                    ))}
                  </div>
                  {paymentMethod === 'boleto' && (
                    <div className="mt-3">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Prazo do Boleto (dias)
                      </label>
                      <div className="relative max-w-xs">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="number"
                          value={boletoDueDays}
                          onChange={(e) => setBoletoDueDays(Math.max(1, parseInt(e.target.value) || 1))}
                          min="1"
                          max="365"
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="30"
                        />
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Vencimento em {boletoDueDays} {boletoDueDays === 1 ? 'dia' : 'dias'} após a emissão
                      </p>
                    </div>
                  )}
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

                {/* Additional Costs */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Custos Adicionais
                    </h3>
                    <button
                      type="button"
                      onClick={addAdditionalCost}
                      className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar custo
                    </button>
                  </div>
                  {additionalCosts.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                      Nenhum custo adicional. Clique em "Adicionar custo" para incluir frete, impostos, etc.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {additionalCosts.map(cost => (
                        <div key={cost.id} className="flex gap-2 items-center">
                          <select
                            value={cost.label}
                            onChange={(e) => updateAdditionalCost(cost.id, 'label', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                          >
                            {COST_PRESETS.map(preset => (
                              <option key={preset} value={preset}>{preset}</option>
                            ))}
                          </select>
                          <div className="relative w-40 flex-shrink-0">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="number"
                              value={cost.valueStr}
                              onChange={(e) => updateAdditionalCost(cost.id, 'valueStr', e.target.value)}
                              step="0.01"
                              min="0"
                              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                              placeholder="0,00"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAdditionalCost(cost.id)}
                            className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Total Summary */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm text-blue-700 dark:text-blue-300">
                    <span>Subtotal de itens</span>
                    <span className="font-medium">{formatCurrency(getItemsTotal())}</span>
                  </div>
                  {additionalCosts.filter(c => c.value > 0).map(c => (
                    <div key={c.id} className="flex items-center justify-between text-sm text-blue-700 dark:text-blue-300">
                      <span>{c.label}</span>
                      <span className="font-medium">{formatCurrency(c.value)}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-blue-200 dark:border-blue-700 flex items-center justify-between">
                    <span className="font-medium text-blue-700 dark:text-blue-300">Valor Total</span>
                    <span className="text-xl font-bold text-blue-900 dark:text-blue-200">
                      {formatCurrency(getItemsTotal() + getAdditionalTotal())}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex gap-3 flex-shrink-0">
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
