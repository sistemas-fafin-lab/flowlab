import React from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, User, DollarSign, Package, Building2, Crown, Star, Clock } from 'lucide-react';
import { Quotation, QuotationPermissions } from '../types';
import { getQuotationAmount } from '../utils/getQuotationAmount';
import { annotateProposals } from '../utils/annotateProposals';
import { ApprovalTimeline } from './ApprovalTimeline';

interface QuotationApprovalModalProps {
  quotation: Quotation;
  permissions: QuotationPermissions;
  onClose: () => void;
  onApprove: (comment?: string) => Promise<void>;
  onReject: (comment: string) => Promise<void>;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const QuotationApprovalModal: React.FC<QuotationApprovalModalProps> = ({
  quotation,
  permissions,
  onClose,
  onApprove,
  onReject,
}) => {
  // Sempre inclui todas as propostas (mesmo as marcadas como rejeitadas pela
  // seleção de vencedora) — a comparação padrão esconde as perdedoras, mas o
  // gestor precisa ver o quadro completo antes de decidir.
  const annotatedProposals = annotateProposals(quotation, { includeRejected: true });

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 bg-gradient-to-r from-amber-600 to-amber-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold truncate">Aprovar Cotação</h3>
              <p className="text-sm text-white/80 font-mono">{quotation.code}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Summary */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{quotation.title}</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <User className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{quotation.createdByName}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{quotation.department}</span>
              </div>
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                <DollarSign className="w-3.5 h-3.5 flex-shrink-0" />
                {formatCurrency(getQuotationAmount(quotation))}
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Package className="w-3.5 h-3.5 flex-shrink-0" />
                {quotation.items.length} item(ns)
              </div>
            </div>
            <ul className="divide-y divide-slate-200 dark:divide-slate-700 border-t border-slate-200 dark:border-slate-700 pt-2">
              {quotation.items.map(item => (
                <li key={item.id} className="py-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-700 dark:text-slate-300 truncate">{item.productName}</span>
                  <span className="text-slate-500 dark:text-slate-400 flex-shrink-0">{item.quantity} {item.unit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Proposals */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Propostas recebidas ({annotatedProposals.length})
            </h4>
            <div className="space-y-2">
              {annotatedProposals.map(proposal => {
                const isWinner = proposal.proposalId === quotation.selectedProposalId;
                return (
                  <div
                    key={proposal.proposalId}
                    className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
                      isWinner
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700'
                        : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {proposal.supplierName}
                      </span>
                      {isWinner && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full flex-shrink-0">
                          <Crown className="w-3 h-3" />
                          Vencedora atual
                        </span>
                      )}
                      {proposal.isLowestTotal && !isWinner && (
                        <span title="Menor preço" className="flex-shrink-0">
                          <Star className="w-3.5 h-3.5 text-emerald-500 fill-current" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Clock className="w-3 h-3" />
                        {proposal.deliveryTime || '—'}
                      </span>
                      <span className={`text-sm font-bold ${isWinner ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-slate-100'}`}>
                        {formatCurrency(proposal.totalAmount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Approve/Reject — reaproveita a decisão atômica e a checagem de alçada já existentes */}
          <ApprovalTimeline
            quotation={quotation}
            currentUserApprovalLimit={permissions.maxApprovalAmount}
            onApprove={permissions.canApprove ? onApprove : undefined}
            onReject={permissions.canReject ? onReject : undefined}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default QuotationApprovalModal;
