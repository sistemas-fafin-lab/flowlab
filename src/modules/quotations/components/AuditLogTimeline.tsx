import React from 'react';
import {
  FileText,
  Send,
  MessageSquare,
  Check,
  X,
  AlertCircle,
  ArrowUpRight,
  ShoppingCart,
  Plus,
  Minus,
  Building2,
  User,
  Clock,
} from 'lucide-react';
import { QuotationAuditLog, QuotationActionType } from '../types';

interface AuditLogTimelineProps {
  logs: QuotationAuditLog[];
  maxItems?: number;
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const getActionIcon = (action: QuotationActionType) => {
  const iconMap: Record<QuotationActionType, React.ReactNode> = {
    created: <FileText className="w-4 h-4" />,
    updated: <FileText className="w-4 h-4" />,
    sent_to_suppliers: <Send className="w-4 h-4" />,
    supplier_response: <MessageSquare className="w-4 h-4" />,
    proposal_selected: <Check className="w-4 h-4" />,
    proposal_rejected: <X className="w-4 h-4" />,
    submitted_for_approval: <ArrowUpRight className="w-4 h-4" />,
    approved: <Check className="w-4 h-4" />,
    rejected: <X className="w-4 h-4" />,
    escalated: <ArrowUpRight className="w-4 h-4" />,
    converted_to_purchase: <ShoppingCart className="w-4 h-4" />,
    cancelled: <AlertCircle className="w-4 h-4" />,
    comment_added: <MessageSquare className="w-4 h-4" />,
    item_added: <Plus className="w-4 h-4" />,
    item_removed: <Minus className="w-4 h-4" />,
    supplier_added: <Building2 className="w-4 h-4" />,
    supplier_removed: <Building2 className="w-4 h-4" />,
  };
  return iconMap[action] || <FileText className="w-4 h-4" />;
};

const getActionColor = (action: QuotationActionType) => {
  const colorMap: Record<QuotationActionType, string> = {
    created: 'bg-blue-100 text-blue-600',
    updated: 'bg-gray-100 text-gray-600',
    sent_to_suppliers: 'bg-indigo-100 text-indigo-600',
    supplier_response: 'bg-purple-100 text-purple-600',
    proposal_selected: 'bg-green-100 text-green-600',
    proposal_rejected: 'bg-red-100 text-red-600',
    submitted_for_approval: 'bg-amber-100 text-amber-600',
    approved: 'bg-green-100 text-green-600',
    rejected: 'bg-red-100 text-red-600',
    escalated: 'bg-orange-100 text-orange-600',
    converted_to_purchase: 'bg-emerald-100 text-emerald-600',
    cancelled: 'bg-gray-100 text-gray-600',
    comment_added: 'bg-blue-100 text-blue-600',
    item_added: 'bg-green-100 text-green-600',
    item_removed: 'bg-red-100 text-red-600',
    supplier_added: 'bg-green-100 text-green-600',
    supplier_removed: 'bg-red-100 text-red-600',
  };
  return colorMap[action] || 'bg-gray-100 text-gray-600';
};

const getActionLabel = (action: QuotationActionType): string => {
  const labelMap: Record<QuotationActionType, string> = {
    created: 'Cotação criada',
    updated: 'Cotação atualizada',
    sent_to_suppliers: 'Enviada aos fornecedores',
    supplier_response: 'Proposta recebida',
    proposal_selected: 'Proposta selecionada',
    proposal_rejected: 'Proposta rejeitada',
    submitted_for_approval: 'Submetida para aprovação',
    approved: 'Cotação aprovada',
    rejected: 'Cotação rejeitada',
    escalated: 'Escalonada para próximo nível',
    converted_to_purchase: 'Convertida em pedido',
    cancelled: 'Cotação cancelada',
    comment_added: 'Comentário adicionado',
    item_added: 'Item adicionado',
    item_removed: 'Item removido',
    supplier_added: 'Fornecedor adicionado',
    supplier_removed: 'Fornecedor removido',
  };
  return labelMap[action] || action;
};

export const AuditLogTimeline: React.FC<AuditLogTimelineProps> = ({
  logs,
  maxItems = 10,
}) => {
  const [showAll, setShowAll] = React.useState(false);

  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime()
  );

  const displayedLogs = showAll ? sortedLogs : sortedLogs.slice(0, maxItems);

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
        <Clock className="w-10 h-10 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500">Nenhuma atividade registrada</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-4 sm:px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Histórico de Atividades</h3>
        <p className="text-sm text-gray-500">{logs.length} registro(s)</p>
      </div>

      <div className="divide-y divide-gray-100">
        {displayedLogs.map((log, index) => (
          <div key={log.id} className="px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getActionColor(log.action)}`}>
                {getActionIcon(log.action)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">
                    {getActionLabel(log.action)}
                  </p>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(log.performedAt)}
                  </span>
                </div>

                {/* User */}
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                  <User className="w-3 h-3" />
                  <span>{log.performedByName}</span>
                </div>

                {/* Metadata */}
                {log.metadata && (
                  <div className="mt-2 space-y-1">
                    {log.metadata.supplierName && (
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Building2 className="w-3 h-3" />
                        <span>{log.metadata.supplierName}</span>
                      </div>
                    )}
                    {log.metadata.amount && (
                      <div className="text-xs font-medium text-gray-700">
                        Valor: {formatCurrency(log.metadata.amount)}
                      </div>
                    )}
                    {log.metadata.itemName && (
                      <div className="text-xs text-gray-600">
                        Item: {log.metadata.itemName}
                      </div>
                    )}
                    {log.metadata.comment && (
                      <div className="mt-1 p-2 bg-gray-100 rounded text-xs text-gray-600 italic">
                        "{log.metadata.comment}"
                      </div>
                    )}
                    {log.metadata.previousStatus && log.metadata.newStatus && (
                      <div className="text-xs text-gray-500">
                        Status: {log.metadata.previousStatus} → {log.metadata.newStatus}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Show more button */}
      {logs.length > maxItems && (
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-200">
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {showAll ? 'Mostrar menos' : `Ver mais ${logs.length - maxItems} registro(s)`}
          </button>
        </div>
      )}
    </div>
  );
};

export default AuditLogTimeline;
