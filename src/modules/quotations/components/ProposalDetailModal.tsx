import React from 'react';
import ReactDOM from 'react-dom';
import {
  X,
  Building2,
  Package,
  Calendar,
  Clock,
  CreditCard,
  FileText,
} from 'lucide-react';
import { SupplierProposal, PaymentMethodLabels, paymentMethodHasDueDays, ProposalStatusLabels, ProposalStatusColors } from '../types';
import { formatDate } from '../utils/formatDate';

interface ProposalDetailModalProps {
  isOpen: boolean;
  proposal: SupplierProposal;
  onClose: () => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const ProposalDetailModal: React.FC<ProposalDetailModalProps> = ({ isOpen, proposal, onClose }) => {
  if (!isOpen) return null;

  const additionalTotal = (proposal.additionalCosts || []).reduce((sum, c) => sum + c.value, 0);
  const itemsTotal = proposal.totalAmount - additionalTotal;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Detalhes da Proposta</h2>
            <div className="flex items-center gap-2 mt-1">
              <Building2 className="w-4 h-4 text-gray-400" />
              <p className="text-sm text-gray-500 dark:text-gray-400">{proposal.supplierName}</p>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${ProposalStatusColors[proposal.status]}`}>
                {ProposalStatusLabels[proposal.status]}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Items */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Itens Propostos</h3>
            <div className="space-y-3">
              {proposal.items.map(item => (
                <div key={item.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{item.productName}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{item.quantity} un</p>
                      {item.notes && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{item.notes}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(item.totalPrice)}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {formatCurrency(item.unitPrice)}/un
                      </p>
                      {item.deliveryTime && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center justify-end gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {item.deliveryTime}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment & Validity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                <CreditCard className="w-3.5 h-3.5" />
                Forma de Pagamento
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {proposal.paymentMethod ? PaymentMethodLabels[proposal.paymentMethod] : proposal.paymentTerms || '—'}
                {paymentMethodHasDueDays(proposal.paymentMethod) && proposal.boletoDueDays != null
                  ? ` — ${proposal.boletoDueDays} dias`
                  : ''}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                <Calendar className="w-3.5 h-3.5" />
                Validade da Proposta
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatDate(proposal.validUntil)}
              </p>
            </div>
          </div>

          {/* Notes */}
          {proposal.notes && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <FileText className="w-4 h-4" />
                Observações Gerais
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                {proposal.notes}
              </p>
            </div>
          )}

          {/* Total Summary */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-sm text-blue-700 dark:text-blue-300">
              <span>Subtotal de itens</span>
              <span className="font-medium">{formatCurrency(itemsTotal)}</span>
            </div>
            {(proposal.additionalCosts || []).map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm text-blue-700 dark:text-blue-300">
                <span>{c.label}</span>
                <span className="font-medium">{formatCurrency(c.value)}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-blue-200 dark:border-blue-700 flex items-center justify-between">
              <span className="font-medium text-blue-700 dark:text-blue-300">Valor Total</span>
              <span className="text-xl font-bold text-blue-900 dark:text-blue-200">
                {formatCurrency(proposal.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProposalDetailModal;
