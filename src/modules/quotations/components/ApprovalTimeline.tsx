import React from 'react';
import { Check, X, Clock, AlertTriangle, ChevronRight, User, Shield } from 'lucide-react';
import {
  Quotation,
  QuotationApproval,
  ApprovalLevel,
  APPROVAL_THRESHOLDS,
} from '../types';

interface ApprovalTimelineProps {
  quotation: Quotation;
  currentUserApprovalLimit: number;
  onApprove?: (comment?: string) => void;
  onReject?: (comment: string) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ApprovalLevelBadge: React.FC<{ level: ApprovalLevel; isActive?: boolean }> = ({ level, isActive }) => {
  const threshold = APPROVAL_THRESHOLDS.find(t => t.level === level);
  
  const colors = {
    level_1: 'bg-blue-100/80 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200/70 dark:border-blue-800/50',
    level_2: 'bg-indigo-100/80 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/70 dark:border-indigo-800/50',
    level_3: 'bg-purple-100/80 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200/70 dark:border-purple-800/50',
    level_4: 'bg-rose-100/80 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-200/70 dark:border-rose-800/50',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border ${colors[level]} ${isActive ? 'ring-2 ring-offset-1 ring-blue-500 dark:ring-offset-slate-900' : ''}`}>
      <Shield className="w-3 h-3 mr-1" />
      {threshold?.label.replace('Nível ', 'N')}
    </span>
  );
};

export const ApprovalTimeline: React.FC<ApprovalTimelineProps> = ({
  quotation,
  currentUserApprovalLimit,
  onApprove,
  onReject,
}) => {
  const [rejectComment, setRejectComment] = React.useState('');
  const [approveComment, setApproveComment] = React.useState('');
  const [showRejectForm, setShowRejectForm] = React.useState(false);

  const amount = quotation.finalTotalAmount || quotation.estimatedTotalAmount;
  const isWithinLimit = amount <= currentUserApprovalLimit;
  const canApprove = quotation.status === 'awaiting_approval' && isWithinLimit;
  const canReject = quotation.status === 'awaiting_approval';

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="bg-white/60 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 sm:px-5 py-4 border-b border-slate-100/70 dark:border-slate-700/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Aprovação</h3>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-slate-500 dark:text-slate-400">Nível necessário:</span>
                <ApprovalLevelBadge level={quotation.requiredApprovalLevel} />
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Valor para aprovação</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{formatCurrency(amount)}</p>
            </div>
          </div>
        </div>

        {/* User Limit Warning */}
        {!isWithinLimit && quotation.status === 'awaiting_approval' && (
          <div className="px-4 sm:px-5 py-3 bg-amber-50/80 dark:bg-amber-900/15 border-b border-amber-200/70 dark:border-amber-800/50">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Fora da sua alçada</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Seu limite de aprovação é {formatCurrency(currentUserApprovalLimit)}.
                  Esta cotação requer aprovação de nível superior.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Approval Steps */}
        <div className="px-4 sm:px-5 py-4 space-y-3">
          {APPROVAL_THRESHOLDS.map((threshold, index) => {
            const isRequired = threshold.level === quotation.requiredApprovalLevel;
            const approval = quotation.approvals.find(a => a.level === threshold.level);
            const isPast = APPROVAL_THRESHOLDS.indexOf(
              APPROVAL_THRESHOLDS.find(t => t.level === quotation.requiredApprovalLevel)!
            ) > index;
            
            if (!isRequired && !isPast && !approval) return null;

            return (
              <div
                key={threshold.level}
                className={`relative flex items-start gap-3.5 p-3.5 rounded-xl border transition-colors ${
                  isRequired
                    ? 'bg-blue-50/70 dark:bg-blue-900/15 border-blue-200/70 dark:border-blue-800/50'
                    : 'bg-slate-50/60 dark:bg-slate-900/30 border-slate-200/60 dark:border-slate-700/40'
                }`}
              >
                {/* Status Icon */}
                <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
                  approval?.status === 'approved'
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                    : approval?.status === 'rejected'
                    ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                    : approval?.status === 'pending'
                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                    : 'bg-slate-100 dark:bg-slate-700/70 text-slate-400 dark:text-slate-500'
                }`}>
                  {approval?.status === 'approved' ? (
                    <Check className="w-4 h-4" />
                  ) : approval?.status === 'rejected' ? (
                    <X className="w-4 h-4" />
                  ) : approval?.status === 'pending' ? (
                    <Clock className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {threshold.label}
                    </h4>
                    <ApprovalLevelBadge level={threshold.level} isActive={isRequired} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {threshold.description}
                  </p>

                  {/* Approver Info */}
                  {approval?.approverId && (
                    <div className="mt-2.5 flex items-center gap-2 text-sm">
                      <User className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{approval.approverName}</span>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(approval.approvedAt || approval.rejectedAt || approval.createdAt)}
                      </span>
                    </div>
                  )}

                  {/* Comment */}
                  {approval?.comment && (
                    <div className="mt-2 p-2.5 bg-white/70 dark:bg-slate-800/70 rounded-xl border border-slate-200/60 dark:border-slate-700/40">
                      <p className="text-xs text-slate-600 dark:text-slate-400 italic">"{approval.comment}"</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      {(canApprove || canReject) && (
        <div className="bg-white/60 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 rounded-2xl p-4 shadow-sm">
          {!showRejectForm ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Comentário (opcional)
                </label>
                <textarea
                  value={approveComment}
                  onChange={(e) => setApproveComment(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none bg-white/80 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all resize-none"
                  placeholder="Adicione um comentário à aprovação..."
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5">
                {canApprove && (
                  <button
                    onClick={() => onApprove?.(approveComment || undefined)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-semibold text-sm rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    Aprovar Cotação
                  </button>
                )}
                {canReject && (
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-red-600 dark:text-red-400 font-semibold text-sm rounded-xl border border-red-200 dark:border-red-800/60 bg-red-50/60 dark:bg-red-900/15 hover:bg-red-100/70 dark:hover:bg-red-900/25 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Rejeitar
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Motivo da Rejeição *
                </label>
                <textarea
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  rows={3}
                  required
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-red-500/30 focus:border-red-500 outline-none bg-white/80 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all resize-none"
                  placeholder="Informe o motivo da rejeição..."
                />
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={() => { setShowRejectForm(false); setRejectComment(''); }}
                  className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 font-medium text-sm rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { if (rejectComment.trim()) onReject?.(rejectComment); }}
                  disabled={!rejectComment.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white font-semibold text-sm rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <X className="w-4 h-4" />
                  Confirmar Rejeição
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Completed States */}
      {quotation.status === 'approved' && (
        <div className="flex items-center gap-2.5 px-4 py-3.5 bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-200/70 dark:border-emerald-800/50 rounded-2xl">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Cotação aprovada</span>
        </div>
      )}

      {quotation.status === 'rejected' && (
        <div className="flex items-center gap-2.5 px-4 py-3.5 bg-red-50/80 dark:bg-red-900/20 border border-red-200/70 dark:border-red-800/50 rounded-2xl">
          <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center flex-shrink-0">
            <X className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <span className="text-sm font-semibold text-red-700 dark:text-red-300">Cotação rejeitada</span>
        </div>
      )}
    </div>
  );
};

export default ApprovalTimeline;
