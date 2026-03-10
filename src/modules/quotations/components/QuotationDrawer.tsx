import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { Quotation, QuotationStatusColors, QuotationStatusLabels, QuotationPermissions, SubmitProposalInput } from '../types';
import { StatusStepper } from './StatusStepper';
import { ProposalComparison } from './ProposalComparison';
import { ApprovalTimeline } from './ApprovalTimeline';
import { AuditLogTimeline } from './AuditLogTimeline';
import { AddProposalModal } from './AddProposalModal';

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
}) => {
  const [activeTab, setActiveTab] = React.useState<Tab>('overview');
  const [showCancelModal, setShowCancelModal] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState('');
  const [showActionsMenu, setShowActionsMenu] = React.useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);

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

  const handleCancel = () => {
    if (cancelReason.trim()) {
      onCancel?.(cancelReason);
      setShowCancelModal(false);
      setCancelReason('');
    }
  };

  return (
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
        className={`fixed inset-y-0 right-0 w-full sm:w-[600px] lg:w-[800px] bg-white shadow-2xl z-50 transform transition-transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col`}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-white border-b border-gray-200">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-mono text-gray-500">{quotation.code}</span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${QuotationStatusColors[quotation.status]}`}>
                  {QuotationStatusLabels[quotation.status]}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                {quotation.title}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {/* Actions Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowActionsMenu(!showActionsMenu)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                {showActionsMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowActionsMenu(false)}
                    />
                    <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-20">
                      {permissions.canCancel && (
                        <button
                          onClick={() => {
                            setShowActionsMenu(false);
                            setShowCancelModal(true);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
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
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
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
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                    activeTab === tab.id ? 'bg-blue-100' : 'bg-gray-100'
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
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-xs font-medium">Valor Estimado</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900">
                      {formatCurrency(quotation.estimatedTotalAmount)}
                    </p>
                  </div>
                  {quotation.finalTotalAmount && (
                    <div className="bg-green-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-green-600 mb-1">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-xs font-medium">Valor Final</span>
                      </div>
                      <p className="text-xl font-bold text-green-700">
                        {formatCurrency(quotation.finalTotalAmount)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-500">Departamento</span>
                    <span className="text-sm font-medium text-gray-900">{quotation.department}</span>
                  </div>
                  {quotation.costCenter && (
                    <div className="px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-gray-500">Centro de Custo</span>
                      <span className="text-sm font-medium text-gray-900">{quotation.costCenter}</span>
                    </div>
                  )}
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-500">Prioridade</span>
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
                    <span className="text-sm text-gray-500">Criada em</span>
                    <span className="text-sm font-medium text-gray-900">{formatDate(quotation.createdAt)}</span>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-500">Criada por</span>
                    <span className="text-sm font-medium text-gray-900">{quotation.createdByName}</span>
                  </div>
                  {quotation.responseDeadline && (
                    <div className="px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-gray-500">Prazo de Resposta</span>
                      <span className="text-sm font-medium text-gray-900">{formatDate(quotation.responseDeadline)}</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                {quotation.description && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Descrição</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4">
                      {quotation.description}
                    </p>
                  </div>
                )}

                {/* Justification */}
                {quotation.justification && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Justificativa</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4">
                      {quotation.justification}
                    </p>
                  </div>
                )}

                {/* Selected Winner */}
                {quotation.selectedSupplierName && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-green-700 mb-2">
                      <Check className="w-5 h-5" />
                      <span className="font-medium">Fornecedor Selecionado</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">{quotation.selectedSupplierName}</span>
                    </div>
                    {quotation.selectedTotalAmount && (
                      <p className="text-lg font-bold text-green-700 mt-2">
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
                {quotation.items.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                    <p>Nenhum item adicionado</p>
                  </div>
                ) : (
                  quotation.items.map((item, index) => (
                    <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-gray-400">#{index + 1}</span>
                            <h4 className="font-medium text-gray-900 truncate">{item.productName}</h4>
                          </div>
                          {item.productCode && (
                            <p className="text-xs text-gray-500 mt-0.5">{item.productCode}</p>
                          )}
                          {item.description && (
                            <p className="text-sm text-gray-600 mt-2">{item.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {item.quantity} {item.unit}
                          </p>
                          {item.estimatedUnitPrice && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              Est. {formatCurrency(item.estimatedUnitPrice)}
                            </p>
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
                {/* Add Proposal Button */}
                {['sent_to_suppliers', 'waiting_responses'].includes(quotation.status) && 
                 quotation.invitedSuppliers.length > quotation.proposals.length && (
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
                    canSelect={permissions.canSelectWinner && quotation.status === 'under_review'}
                  />
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Building2 className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                    <p>Nenhuma proposta recebida ainda</p>
                    <p className="text-sm mt-1">As propostas aparecerão aqui quando os fornecedores responderem.</p>
                    {['sent_to_suppliers', 'waiting_responses'].includes(quotation.status) && 
                     quotation.invitedSuppliers.length > 0 && (
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
        <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Send to Suppliers */}
            {quotation.status === 'draft' && permissions.canSendToSuppliers && (
              <button
                onClick={onSendToSuppliers}
                disabled={quotation.items.length === 0 || quotation.invitedSuppliers.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                Enviar aos Fornecedores
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
              className="sm:w-auto px-4 py-2.5 bg-white text-gray-700 font-medium rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Cancelar Cotação</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Esta ação não pode ser desfeita. Por favor, informe o motivo do cancelamento.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Motivo do cancelamento..."
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200"
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
          onClose={() => setShowProposalModal(false)}
          onSubmit={async (data) => {
            await onSubmitProposal(quotation.id, data);
          }}
        />
      )}
    </>
  );
};

export default QuotationDrawer;
