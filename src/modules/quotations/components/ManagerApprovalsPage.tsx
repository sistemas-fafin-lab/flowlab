import React, { useMemo, useState } from 'react';
import { ChevronRight, ClipboardCheck, Inbox, RefreshCcw, User } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { Quotation, QuotationTypeLabels } from '../types';
import { useQuotation } from '../hooks/useQuotation';
import { useSyncFromQuotations } from '../hooks/useSyncFromQuotations';
import { getQuotationAmount } from '../utils/getQuotationAmount';
import { filterQuotationsAwaitingMyManagerApproval } from '../utils/filterQuotationsAwaitingMyManagerApproval';
import { QuotationApprovalModal } from './QuotationApprovalModal';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (date: string) => new Date(date).toLocaleDateString('pt-BR');

/**
 * "Minhas aprovações de cotação": tela enxuta para o gestor do pedido dar o
 * "de acordo" na etapa do gestor, aberta a qualquer usuário logado — sem
 * exigir acesso ao módulo de Cotações. Lista só as cotações pendentes com o
 * usuário e abre o mesmo modal-resumo da lista completa.
 */
export const ManagerApprovalsPage: React.FC = () => {
  const { user } = useAuth();
  const {
    quotations,
    loading,
    getPermissions,
    refresh,
    selectWinner,
    approveQuotation,
    rejectQuotation,
  } = useQuotation();

  const [approvalQuotation, setApprovalQuotation] = useState<Quotation | null>(null);

  // Sincroniza pela lista completa (não a filtrada): depois da decisão a
  // cotação sai da etapa do gestor, e o modal ainda precisa do estado novo
  // até o usuário fechá-lo.
  useSyncFromQuotations(quotations, approvalQuotation?.id, setApprovalQuotation);

  const myPendingManagerApprovals = useMemo(
    () => filterQuotationsAwaitingMyManagerApproval(quotations, user?.id),
    [quotations, user?.id],
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center mr-4 shadow-lg shadow-amber-500/25">
            <ClipboardCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
              Minhas aprovações de cotação
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Cotações aguardando o seu "de acordo" como gestor do pedido
            </p>
          </div>
        </div>
        <button
          onClick={() => refresh()}
          disabled={loading}
          className="self-start sm:self-auto p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors shadow-sm"
          title="Atualizar"
        >
          <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* List */}
      {loading && myPendingManagerApprovals.length === 0 ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-amber-500 border-t-transparent" />
        </div>
      ) : myPendingManagerApprovals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-10 text-center">
          <Inbox className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="font-medium text-gray-700 dark:text-gray-200">Nenhuma cotação aguardando sua aprovação</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {myPendingManagerApprovals.map((quotation) => (
            <li key={quotation.id}>
              <button
                onClick={() => setApprovalQuotation(quotation)}
                className="group w-full text-left rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-amber-300 dark:hover:border-amber-600 transition-all flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{quotation.code}</span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {QuotationTypeLabels[quotation.quotationType]}
                    </span>
                  </div>
                  <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100 truncate">{quotation.title}</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    {quotation.createdByName} · {formatDate(quotation.createdAt)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(getQuotationAmount(quotation))}
                  </p>
                  {quotation.selectedSupplierName && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[10rem]">
                      {quotation.selectedSupplierName}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-amber-500 transition-colors flex-shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {approvalQuotation && (
        <QuotationApprovalModal
          quotation={approvalQuotation}
          permissions={getPermissions(approvalQuotation)}
          onClose={() => setApprovalQuotation(null)}
          onApprove={async (comment) => {
            const newStatus = await approveQuotation(approvalQuotation.id, comment);
            await refresh();
            return newStatus;
          }}
          onReject={async (comment) => {
            await rejectQuotation(approvalQuotation.id, comment);
            await refresh();
          }}
          onSelectWinner={async (proposalId) => {
            await selectWinner(approvalQuotation.id, proposalId);
            await refresh();
          }}
        />
      )}
    </div>
  );
};

export default ManagerApprovalsPage;
