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
    level_1: 'bg-blue-100 text-blue-800 border-blue-200',
    level_2: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    level_3: 'bg-purple-100 text-purple-800 border-purple-200',
    level_4: 'bg-rose-100 text-rose-800 border-rose-200',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border ${colors[level]} ${isActive ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}>
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
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Aprovação</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Nível necessário: <ApprovalLevelBadge level={quotation.requiredApprovalLevel} />
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Valor para aprovação</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(amount)}</p>
          </div>
        </div>
      </div>

      {/* User Limit Warning */}
      {!isWithinLimit && quotation.status === 'awaiting_approval' && (
        <div className="px-4 sm:px-6 py-3 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">Fora da sua alçada</p>
              <p className="text-xs text-amber-700">
                Seu limite de aprovação é {formatCurrency(currentUserApprovalLimit)}. 
                Esta cotação requer aprovação de nível superior.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Approval Steps */}
      <div className="px-4 sm:px-6 py-4">
        <div className="space-y-4">
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
                className={`relative flex items-start gap-4 p-4 rounded-xl border ${
                  isRequired
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                {/* Status Icon */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  approval?.status === 'approved'
                    ? 'bg-green-100 text-green-600'
                    : approval?.status === 'rejected'
                    ? 'bg-red-100 text-red-600'
                    : approval?.status === 'pending'
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {approval?.status === 'approved' ? (
                    <Check className="w-5 h-5" />
                  ) : approval?.status === 'rejected' ? (
                    <X className="w-5 h-5" />
                  ) : approval?.status === 'pending' ? (
                    <Clock className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {threshold.label}
                    </h4>
                    <ApprovalLevelBadge level={threshold.level} isActive={isRequired} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {threshold.description}
                  </p>

                  {/* Approver Info */}
                  {approval?.approverId && (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700">{approval.approverName}</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-500">
                        {formatDate(approval.approvedAt || approval.rejectedAt || approval.createdAt)}
                      </span>
                    </div>
                  )}

                  {/* Comment */}
                  {approval?.comment && (
                    <div className="mt-2 p-2 bg-white rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-600 italic">"{approval.comment}"</p>
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
        <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200">
          {!showRejectForm ? (
            <div className="space-y-3">
              {/* Approve Comment (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comentário (opcional)
                </label>
                <textarea
                  value={approveComment}
                  onChange={(e) => setApproveComment(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Adicione um comentário à aprovação..."
                />
              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                {canApprove && (
                  <button
                    onClick={() => onApprove?.(approveComment || undefined)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Aprovar Cotação
                  </button>
                )}
                {canReject && (
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-red-600 font-medium rounded-xl border border-red-200 hover:bg-red-50 transition-colors"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo da Rejeição *
                </label>
                <textarea
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  rows={3}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Informe o motivo da rejeição..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectComment('');
                  }}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (rejectComment.trim()) {
                      onReject?.(rejectComment);
                    }
                  }}
                  disabled={!rejectComment.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="px-4 sm:px-6 py-4 bg-green-50 border-t border-green-200">
          <div className="flex items-center gap-2 text-green-700">
            <Check className="w-5 h-5" />
            <span className="font-medium">Cotação aprovada</span>
          </div>
        </div>
      )}

      {quotation.status === 'rejected' && (
        <div className="px-4 sm:px-6 py-4 bg-red-50 border-t border-red-200">
          <div className="flex items-center gap-2 text-red-700">
            <X className="w-5 h-5" />
            <span className="font-medium">Cotação rejeitada</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalTimeline;
