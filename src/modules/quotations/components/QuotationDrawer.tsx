import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'framer-motion';
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
  Maximize2,
  Minimize2,
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState(780);
  const isResizingRef = useRef(false);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startW = drawerWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = startX - ev.clientX;
      setDrawerWidth(Math.max(480, Math.min(1200, startW + delta)));
    };
    const onUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [drawerWidth]);
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black/25 dark:bg-black/45 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <motion.div
        initial={isFullscreen ? { opacity: 0, scale: 0.97 } : { x: '100%', opacity: 0.5 }}
        animate={isFullscreen ? { opacity: 1, scale: 1 } : { x: 0, opacity: 1 }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
        style={!isFullscreen ? { width: drawerWidth, maxWidth: '100vw' } : undefined}
        className={`
          fixed z-50 flex flex-col overflow-hidden
          backdrop-blur-2xl
          ${isFullscreen
            ? 'inset-4 sm:inset-6 md:inset-8 rounded-[2rem] bg-white/[0.97] dark:bg-slate-900/[0.97] shadow-2xl shadow-black/20 dark:shadow-black/50 border border-slate-200/80 dark:border-slate-800/70'
            : 'inset-y-2 right-2 rounded-[2rem] bg-white/[0.97] dark:bg-slate-900/[0.97] border border-slate-200 dark:border-slate-800 shadow-2xl shadow-black/15 dark:shadow-black/40'
          }
        `}
      >
        {/* Resize handle (non-fullscreen) */}
        {!isFullscreen && (
          <div
            onMouseDown={handleResizeMouseDown}
            className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-[60] group"
          >
            <div className="absolute inset-y-0 left-0 w-full hover:bg-blue-500/10 transition-colors" />
            <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-1 h-12 rounded-full bg-slate-300/0 group-hover:bg-slate-400 dark:group-hover:bg-slate-500 transition-colors" />
          </div>
        )}

        {/* Header */}
        <div className="flex-shrink-0 px-5 sm:px-6 py-4 border-b border-slate-200/70 dark:border-slate-800/70 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0 shadow-sm">
              <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            {/* Title block */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 tracking-wide">{quotation.code}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">·</span>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${QuotationStatusColors[quotation.status]}`}>
                  {QuotationStatusLabels[quotation.status]}
                </span>
              </div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {quotation.title}
              </h2>
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Actions menu */}
              <div className="relative">
                <button
                  onClick={() => setShowActionsMenu(!showActionsMenu)}
                  className="p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70 rounded-xl transition-all"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                {showActionsMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowActionsMenu(false)} />
                    <div className="absolute right-0 mt-1 w-52 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/70 dark:border-slate-700/70 py-1.5 z-20">
                      <button
                        onClick={() => { setShowActionsMenu(false); generateQuotationPDF(quotation); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2.5 transition-colors"
                      >
                        <FileDown className="w-4 h-4 text-slate-500" />
                        Gerar PDF
                      </button>
                      {permissions.canCancel && (
                        <button
                          onClick={() => { setShowActionsMenu(false); setShowCancelModal(true); }}
                          className="w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2.5 transition-colors"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          Cancelar Cotação
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => setIsFullscreen(f => !f)}
                className="p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70 rounded-xl transition-all"
                aria-label={isFullscreen ? 'Minimizar' : 'Expandir'}
              >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
              <button
                onClick={onClose}
                className="p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70 rounded-xl transition-all"
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
                className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600/10 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full font-medium ${
                    activeTab === tab.id
                      ? 'bg-blue-600/15 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-400'
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
              <div className="space-y-4">
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/60 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1.5">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Valor Estimado</span>
                    </div>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(quotation.estimatedTotalAmount)}
                    </p>
                  </div>
                  {quotation.finalTotalAmount ? (
                    <div className="bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-200/70 dark:border-emerald-800/50 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1.5">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider">Valor Final</span>
                      </div>
                      <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(quotation.finalTotalAmount)}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white/60 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1.5">
                        <Building2 className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider">Propostas</span>
                      </div>
                      <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {quotation.proposals.length}
                      </p>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="bg-white/60 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100/70 dark:border-slate-700/40">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Departamento</span>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{quotation.department}</span>
                  </div>
                  {quotation.costCenter && (
                    <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100/70 dark:border-slate-700/40">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Centro de Custo</span>
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{quotation.costCenter}</span>
                    </div>
                  )}
                  <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100/70 dark:border-slate-700/40">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Prioridade</span>
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                      quotation.priority === 'urgent' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' :
                      quotation.priority === 'high'   ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' :
                      quotation.priority === 'medium' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                      'bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-400'
                    }`}>
                      {quotation.priority === 'urgent' ? 'Urgente' : quotation.priority === 'high' ? 'Alta' : quotation.priority === 'medium' ? 'Média' : 'Baixa'}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100/70 dark:border-slate-700/40">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Criada em</span>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{formatDate(quotation.createdAt)}</span>
                  </div>
                  <div className={`px-4 py-3 flex items-center justify-between ${quotation.responseDeadline ? 'border-b border-slate-100/70 dark:border-slate-700/40' : ''}`}>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Criada por</span>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{quotation.createdByName}</span>
                  </div>
                  {quotation.responseDeadline && (
                    <div className="px-4 py-3 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Prazo de Resposta</span>
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{formatDate(quotation.responseDeadline)}</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                {quotation.description && (
                  <div className="bg-white/60 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 rounded-2xl p-4 shadow-sm">
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Descrição</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{quotation.description}</p>
                  </div>
                )}

                {/* Justification */}
                {quotation.justification && (
                  <div className="bg-white/60 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 rounded-2xl p-4 shadow-sm">
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Justificativa</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{quotation.justification}</p>
                  </div>
                )}

                {/* Selected Winner */}
                {quotation.selectedSupplierName && (
                  <div className="bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-200/70 dark:border-emerald-800/50 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-300">Fornecedor Selecionado</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">{quotation.selectedSupplierName}</span>
                    </div>
                    {quotation.selectedTotalAmount && (
                      <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-2">
                        {formatCurrency(quotation.selectedTotalAmount)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Items Tab */}
            {activeTab === 'items' && (
              <div className="space-y-3">
                {quotation.status === 'draft' && onAddItem && (
                  <div>
                    {!showAddItemForm ? (
                      <button
                        onClick={() => setShowAddItemForm(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Item
                      </button>
                    ) : (
                      <div className="bg-white/60 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 rounded-2xl p-4 shadow-sm">
                        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Novo Item</h4>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input
                              type="text"
                              value={itemProductSearch}
                              onChange={(e) => setItemProductSearch(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white/80 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
                              placeholder="Nome do produto..."
                            />
                            {itemProductSearch && products && products.filter(p => p.name.toLowerCase().includes(itemProductSearch.toLowerCase())).length > 0 && (
                              <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200/70 dark:border-slate-700/70 rounded-xl shadow-xl z-10">
                                {products.filter(p => p.name.toLowerCase().includes(itemProductSearch.toLowerCase())).slice(0, 8).map(product => (
                                  <div
                                    key={product.id}
                                    onClick={() => setItemProductSearch(product.name)}
                                    className="px-3 py-2 text-sm text-slate-800 dark:text-slate-200 hover:bg-blue-50/70 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                                  >
                                    <span className="font-medium">{product.name}</span>
                                    <span className="text-xs text-slate-400 ml-2">{product.code}</span>
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
                              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white/80 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30 outline-none transition-all"
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
                              className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                              <Plus className="w-4 h-4" />
                              {addingItem ? 'Adicionando...' : 'Adicionar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowAddItemForm(false); setItemProductSearch(''); setNewItemQuantity(1); }}
                              className="px-3 py-2 text-slate-600 dark:text-slate-300 text-sm bg-slate-100 dark:bg-slate-700/70 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
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
                  <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <Package className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-sm">Nenhum item adicionado</p>
                  </div>
                ) : (
                  quotation.items.map((item, index) => (
                    <div key={item.id} className="bg-white/60 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400 dark:text-slate-500">#{index + 1}</span>
                            <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{item.productName}</h4>
                          </div>
                          {item.productCode && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.productCode}</p>}
                          {item.description && <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{item.description}</p>}
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.quantity} {item.unit}</p>
                            {item.estimatedUnitPrice && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Est. {formatCurrency(item.estimatedUnitPrice)}</p>
                            )}
                          </div>
                          {quotation.status === 'draft' && onRemoveItem && (
                            <button
                              onClick={() => onRemoveItem(quotation.id, item.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
                {canAddProposal && (
                  <div className={`flex items-center gap-3 p-3.5 rounded-2xl border ${
                    quotation.proposals.length >= 3
                      ? 'bg-emerald-50/80 dark:bg-emerald-900/15 border-emerald-200/70 dark:border-emerald-800/50'
                      : 'bg-amber-50/80 dark:bg-amber-900/15 border-amber-200/70 dark:border-amber-800/50'
                  }`}>
                    <ClipboardList className={`w-5 h-5 flex-shrink-0 ${
                      quotation.proposals.length >= 3 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`} />
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${
                        quotation.proposals.length >= 3 ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'
                      }`}>
                        {quotation.proposals.length}/3 propostas {quotation.proposals.length >= 3 ? '– mínimo atingido!' : '– mínimo necessário: 3'}
                      </p>
                      <div className="mt-1.5 w-full bg-slate-200/60 dark:bg-slate-700/60 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${quotation.proposals.length >= 3 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.min((quotation.proposals.length / 3) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {canAddProposal && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowProposalModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
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
                  <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <Building2 className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-sm font-medium">Nenhuma proposta recebida ainda</p>
                    <p className="text-xs mt-1 text-slate-400 dark:text-slate-500">Adicione propostas manualmente ou envie a cotação via WhatsApp.</p>
                    {canAddProposal && (
                      <button
                        onClick={() => setShowProposalModal(true)}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
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
        <div className="flex-shrink-0 px-5 sm:px-6 py-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-t border-slate-200/70 dark:border-slate-800/70">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {quotation.status === 'draft' && permissions.canSendToSuppliers && (
              <button
                onClick={onSendToSuppliers}
                disabled={quotation.items.length === 0 || quotation.invitedSuppliers.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-semibold text-sm rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <Send className="w-4 h-4" />
                Enviar via WhatsApp
                <span className="text-xs opacity-75">(opcional)</span>
              </button>
            )}
            {canAdvanceToReview && onAdvanceToReview && (
              <button
                onClick={onAdvanceToReview}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
              >
                <ClipboardList className="w-4 h-4" />
                Avançar para Análise
              </button>
            )}
            {canSubmitForApprovalNow && (
              <button
                onClick={onSubmitForApproval}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 text-white font-semibold text-sm rounded-xl hover:bg-amber-700 transition-colors shadow-sm"
              >
                <ChevronRight className="w-4 h-4" />
                Submeter para Aprovação
              </button>
            )}
            {canConvertNow && permissions.canConvertToPurchase && (
              <button
                onClick={onConvertToPurchase}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-semibold text-sm rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <ShoppingCart className="w-4 h-4" />
                Converter em Pedido
              </button>
            )}
            <button
              onClick={onClose}
              className="sm:w-auto px-4 py-2.5 text-slate-700 dark:text-slate-300 font-medium text-sm rounded-xl bg-white/70 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/70 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </motion.div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl max-w-md w-full p-6 border border-slate-200/80 dark:border-slate-800/70 shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Cancelar Cotação</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Esta ação não pode ser desfeita. Por favor, informe o motivo do cancelamento.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-red-500/30 focus:border-red-500 outline-none bg-white/80 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 transition-all resize-none"
              placeholder="Motivo do cancelamento..."
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowCancelModal(false); setCancelReason(''); }}
                className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 font-medium text-sm rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleCancel}
                disabled={!cancelReason.trim()}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white font-semibold text-sm rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </motion.div>
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
