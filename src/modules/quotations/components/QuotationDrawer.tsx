import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  X,
  FileText,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  Package,
  Send,
  Check,
  AlertTriangle,
  ChevronRight,
  ShoppingCart,
  MoreHorizontal,
  Plus,
  ClipboardList,
  FileDown,
  Trash2,
  Search,
} from 'lucide-react';
import { Quotation, QuotationStatusColors, QuotationStatusLabels, QuotationPermissions, SubmitProposalInput, QuotationItem } from '../types';
import { StatusStepper } from './StatusStepper';
import { ProposalComparison } from './ProposalComparison';
import { ApprovalTimeline } from './ApprovalTimeline';
import { AuditLogTimeline } from './AuditLogTimeline';
import { AddProposalModal } from './AddProposalModal';
import { generateQuotationPDF } from '../utils/generateQuotationPDF';

interface SupplierOption {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

interface QuotationDrawerProps {
  quotation: Quotation | null;
  permissions: QuotationPermissions;
  isOpen: boolean;
  onClose: () => void;
  onSendToSuppliers?: () => void;
  onSelectWinner?: (proposalId: string) => void;
  onSubmitForApproval?: () => void;
  onApprove?: (comment?: string) => void;
  onReject?: (comment: string) => void;
  onConvertToPurchase?: () => void;
  onCancel?: (reason: string) => void;
  onSubmitProposal?: (quotationId: string, data: SubmitProposalInput) => Promise<void>;
  onAdvanceToReview?: () => void;
  onAddItem?: (quotationId: string, item: Omit<QuotationItem, 'id' | 'quotationId' | 'createdAt' | 'updatedAt'>) => Promise<QuotationItem>;
  onRemoveItem?: (quotationId: string, itemId: string) => Promise<void>;
  allSuppliers?: SupplierOption[];
  products?: { id: string; name: string; code: string; unit?: string; category?: string; unitPrice?: number }[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

type Tab = 'overview' | 'items' | 'proposals' | 'approval' | 'history';

export const QuotationDrawer: React.FC<QuotationDrawerProps> = ({
  quotation,
  permissions,
  isOpen,
  onClose,
  onSendToSuppliers,
  onSelectWinner,
  onSubmitForApproval,
  onApprove,
  onReject,
  onConvertToPurchase,
  onCancel,
  onSubmitProposal,
  onAdvanceToReview,
  onAddItem,
  onRemoveItem,
  allSuppliers,
  products,
}) => {
  const [activeTab, setActiveTab] = React.useState<Tab>('overview');
  const [showCancelModal, setShowCancelModal] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState('');
  const [showActionsMenu, setShowActionsMenu] = React.useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [itemProductSearch, setItemProductSearch] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [addingItem, setAddingItem] = useState(false);

  // Reset tab when quotation changes
  useEffect(() => {
    if (quotation) {
      setActiveTab('overview');
    }
  }, [quotation?.id]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!quotation || !isOpen) return null;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Visão Geral' },
    { id: 'items', label: 'Itens', count: quotation.items.length },
    { id: 'proposals', label: 'Propostas', count: quotation.proposals.length },
    { id: 'approval', label: 'Aprovação' },
    { id: 'history', label: 'Histórico', count: quotation.auditLog.length },
  ];

  const canShowComparison = quotation.proposals.length > 0;
  const canSubmitForApprovalNow = quotation.status === 'under_review' && quotation.selectedProposalId;
  const canConvertNow = quotation.status === 'approved';
  const canAdvanceToReview = ['draft', 'sent_to_suppliers', 'waiting_responses'].includes(quotation.status) && quotation.proposals.length >= 3;
  const canAddProposal = ['draft', 'sent_to_suppliers', 'waiting_responses'].includes(quotation.status);

  const handleCancel = () => {
    if (cancelReason.trim()) {
      onCancel?.(cancelReason);
      setShowCancelModal(false);
      setCancelReason('');
    }
  };

  return ReactDOM.createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 w-full sm:w-[600px] lg:w-[800px] bg-white dark:bg-gray-800 shadow-2xl z-50 transform transition-transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col`}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-mono text-gray-500 dark:text-gray-400">{quotation.code}</span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${QuotationStatusColors[quotation.status]}`}>
                  {QuotationStatusLabels[quotation.status]}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                {quotation.title}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {/* Actions Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowActionsMenu(!showActionsMenu)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                {showActionsMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowActionsMenu(false)}
                    />
                    <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          generateQuotationPDF(quotation);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <FileDown className="w-4 h-4" />
                        Gerar PDF
                      </button>
                      {permissions.canCancel && (
                        <button
                          onClick={() => {
                            setShowActionsMenu(false);
                            setShowCancelModal(true);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Cancelar Cotação
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Status Stepper */}
          <div className="mt-4">
            <StatusStepper currentStatus={quotation.status} />
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 overflow-x-auto pb-1 -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                    activeTab === tab.id ? 'bg-blue-100 dark:bg-blue-800' : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-xs font-medium">Valor Estimado</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {formatCurrency(quotation.estimatedTotalAmount)}
                    </p>
                  </div>
                  {quotation.finalTotalAmount && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-xs font-medium">Valor Final</span>
                      </div>
                      <p className="text-xl font-bold text-green-700 dark:text-green-300">
                        {formatCurrency(quotation.finalTotalAmount)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Departamento</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{quotation.department}</span>
                  </div>
                  {quotation.costCenter && (
                    <div className="px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Centro de Custo</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{quotation.costCenter}</span>
                    </div>
                  )}
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Prioridade</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      quotation.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                      quotation.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                      quotation.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {quotation.priority === 'urgent' ? 'Urgente' :
                       quotation.priority === 'high' ? 'Alta' :
                       quotation.priority === 'medium' ? 'Média' : 'Baixa'}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Criada em</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatDate(quotation.createdAt)}</span>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Criada por</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{quotation.createdByName}</span>
                  </div>
                  {quotation.responseDeadline && (
                    <div className="px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Prazo de Resposta</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatDate(quotation.responseDeadline)}</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                {quotation.description && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Descrição</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                      {quotation.description}
                    </p>
                  </div>
                )}

                {/* Justification */}
                {quotation.justification && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Justificativa</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                      {quotation.justification}
                    </p>
                  </div>
                )}

                {/* Selected Winner */}
                {quotation.selectedSupplierName && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
                      <Check className="w-5 h-5" />
                      <span className="font-medium">Fornecedor Selecionado</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">{quotation.selectedSupplierName}</span>
                    </div>
                    {quotation.selectedTotalAmount && (
                      <p className="text-lg font-bold text-green-700 dark:text-green-300 mt-2">
                        {formatCurrency(quotation.selectedTotalAmount)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Items Tab */}
            {activeTab === 'items' && (
              <div className="space-y-4">
                {/* Add Item (only in draft) */}
                {quotation.status === 'draft' && onAddItem && (
                  <div>
                    {!showAddItemForm ? (
                      <button
                        onClick={() => setShowAddItemForm(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Item
                      </button>
                    ) : (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Novo Item</h4>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                              type="text"
                              value={itemProductSearch}
                              onChange={(e) => setItemProductSearch(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              placeholder="Nome do produto..."
                            />
                            {/* Product suggestions dropdown */}
                            {itemProductSearch && products && products.filter(p => p.name.toLowerCase().includes(itemProductSearch.toLowerCase())).length > 0 && (
                              <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10">
                                {products.filter(p => p.name.toLowerCase().includes(itemProductSearch.toLowerCase())).slice(0, 8).map(product => (
                                  <div
                                    key={product.id}
                                    onClick={() => setItemProductSearch(product.name)}
                                    className="px-3 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer"
                                  >
                                    <span className="font-medium">{product.name}</span>
                                    <span className="text-xs text-gray-400 ml-2">{product.code}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="w-24">
                            <input
                              type="number"
                              value={newItemQuantity}
                              onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)}
                              min="1"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              placeholder="Qtd"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={!itemProductSearch.trim() || addingItem}
                              onClick={async () => {
                                if (!itemProductSearch.trim()) return;
                                setAddingItem(true);
                                try {
                                  const matchedProduct = products?.find(p => p.name.toLowerCase().trim() === itemProductSearch.toLowerCase().trim());
                                  await onAddItem(quotation.id, {
                                    productName: matchedProduct?.name || itemProductSearch.trim(),
                                    productCode: matchedProduct?.code,
                                    quantity: newItemQuantity,
                                    unit: matchedProduct?.unit || 'un',
                                    category: matchedProduct?.category || 'general',
                                    estimatedUnitPrice: matchedProduct?.unitPrice,
                                  });
                                  setItemProductSearch('');
                                  setNewItemQuantity(1);
                                  setShowAddItemForm(false);
                                } catch (error) {
                                  console.error('Error adding item:', error);
                                } finally {
                                  setAddingItem(false);
                                }
                              }}
                              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                            >
                              <Plus className="w-4 h-4" />
                              {addingItem ? 'Adicionando...' : 'Adicionar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddItemForm(false);
                                setItemProductSearch('');
                                setNewItemQuantity(1);
                              }}
                              className="px-3 py-2 text-gray-600 dark:text-gray-300 text-sm bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {quotation.items.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Package className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p>Nenhum item adicionado</p>
                  </div>
                ) : (
                  quotation.items.map((item, index) => (
                    <div key={item.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-gray-400 dark:text-gray-500">#{index + 1}</span>
                            <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.productName}</h4>
                          </div>
                          {item.productCode && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.productCode}</p>
                          )}
                          {item.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{item.description}</p>
                          )}
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {item.quantity} {item.unit}
                            </p>
                            {item.estimatedUnitPrice && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Est. {formatCurrency(item.estimatedUnitPrice)}
                              </p>
                            )}
                          </div>
                          {quotation.status === 'draft' && onRemoveItem && (
                            <button
                              onClick={() => onRemoveItem(quotation.id, item.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                              title="Remover item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Proposals Tab */}
            {activeTab === 'proposals' && (
              <div className="space-y-4">
                {/* Proposal progress indicator */}
                {canAddProposal && (
                  <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                    quotation.proposals.length >= 3
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                  }`}>
                    <ClipboardList className={`w-5 h-5 flex-shrink-0 ${
                      quotation.proposals.length >= 3 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                    }`} />
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${
                        quotation.proposals.length >= 3 ? 'text-green-800 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'
                      }`}>
                        {quotation.proposals.length}/3 propostas {quotation.proposals.length >= 3 ? '— mínimo atingido!' : '— mínimo necessário: 3'}
                      </p>
                      <div className="mt-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            quotation.proposals.length >= 3 ? 'bg-green-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min((quotation.proposals.length / 3) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Add Proposal Button - now available in draft, sent_to_suppliers, waiting_responses */}
                {canAddProposal && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowProposalModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Proposta
                    </button>
                  </div>
                )}

                {canShowComparison ? (
                  <ProposalComparison
                    quotation={quotation}
                    onSelectWinner={onSelectWinner}
                    canSelect={permissions.canSelectWinner && ['under_review', 'waiting_responses'].includes(quotation.status)}
                  />
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Building2 className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p>Nenhuma proposta recebida ainda</p>
                    <p className="text-sm mt-1">Adicione propostas manualmente ou envie a cotação aos fornecedores via WhatsApp.</p>
                    {canAddProposal && (
                      <button
                        onClick={() => setShowProposalModal(true)}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Proposta
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Approval Tab */}
            {activeTab === 'approval' && (
              <ApprovalTimeline
                quotation={quotation}
                currentUserApprovalLimit={permissions.maxApprovalAmount}
                onApprove={permissions.canApprove ? onApprove : undefined}
                onReject={permissions.canReject ? onReject : undefined}
              />
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <AuditLogTimeline logs={quotation.auditLog} maxItems={15} />
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Send to Suppliers (WhatsApp - optional) */}
            {quotation.status === 'draft' && permissions.canSendToSuppliers && (
              <button
                onClick={onSendToSuppliers}
                disabled={quotation.items.length === 0 || quotation.invitedSuppliers.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Enviar via WhatsApp (opcional)"
              >
                <Send className="w-4 h-4" />
                Enviar via WhatsApp
                <span className="text-xs opacity-75">(opcional)</span>
              </button>
            )}

            {/* Advance to Review (manual flow) */}
            {canAdvanceToReview && onAdvanceToReview && (
              <button
                onClick={onAdvanceToReview}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
              >
                <ClipboardList className="w-4 h-4" />
                Avançar para Análise
              </button>
            )}

            {/* Submit for Approval */}
            {canSubmitForApprovalNow && (
              <button
                onClick={onSubmitForApproval}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 text-white font-medium rounded-xl hover:bg-amber-700 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
                Submeter para Aprovação
              </button>
            )}

            {/* Convert to Purchase */}
            {canConvertNow && permissions.canConvertToPurchase && (
              <button
                onClick={onConvertToPurchase}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                Converter em Pedido
              </button>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              className="sm:w-auto px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cancelar Cotação</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Esta ação não pode ser desfeita. Por favor, informe o motivo do cancelamento.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Motivo do cancelamento..."
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Voltar
              </button>
              <button
                onClick={handleCancel}
                disabled={!cancelReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 disabled:opacity-50"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Proposal Modal */}
      {showProposalModal && quotation && onSubmitProposal && (
        <AddProposalModal
          isOpen={showProposalModal}
          quotation={quotation}
          suppliers={quotation.invitedSuppliers}
          allSuppliers={allSuppliers}
          onClose={() => setShowProposalModal(false)}
          onSubmit={async (data) => {
            await onSubmitProposal(quotation.id, data);
          }}
        />
      )}
    </>,
    document.body
  );
};

export default QuotationDrawer;
