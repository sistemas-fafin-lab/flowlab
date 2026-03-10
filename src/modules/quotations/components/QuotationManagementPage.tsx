import React, { useState, useEffect } from 'react';
import {
  Plus,
  RefreshCcw,
  ChevronDown,
  BarChart3,
  FileText,
} from 'lucide-react';
import { useQuotation } from '../hooks/useQuotation';
import { Quotation } from '../types';
import { MetricsDashboard } from './MetricsDashboard';
import { QuotationList } from './QuotationList';
import { QuotationDrawer } from './QuotationDrawer';
import { CreateQuotationModal } from './CreateQuotationModal';

export const QuotationManagementPage: React.FC = () => {
  const {
    quotations,
    filteredQuotations,
    suppliers,
    loading,
    metrics,
    getPermissions,
    refresh,
    createQuotation,
    sendToSuppliers,
    submitProposal,
    selectWinner,
    submitForApproval,
    approveQuotation,
    rejectQuotation,
    cancelQuotation,
    convertToPurchase,
    setFilters,
    setSort,
    filters,
    sort,
  } = useQuotation();

  const [showMetrics, setShowMetrics] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  const permissions = getPermissions();

  useEffect(() => {
    refresh();
  }, []);

  const handleSelectQuotation = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setShowDrawer(true);
  };

  const handleCloseDrawer = () => {
    setShowDrawer(false);
    setTimeout(() => setSelectedQuotation(null), 300);
  };

  const handleCreateQuotation = async (data: any) => {
    console.log('handleCreateQuotation called with data:', data);
    try {
      // createQuotation já inclui os itens e fornecedores na cotação
      const newQuotation = await createQuotation(data);
      console.log('createQuotation returned:', newQuotation);
      if (newQuotation) {
        setShowCreateModal(false);
        await refresh();
      }
    } catch (error) {
      console.error('Error creating quotation:', error);
    }
  };

  const handleRefreshAfterAction = async () => {
    await refresh();
    if (selectedQuotation) {
      // Re-fetch the selected quotation to get updated data
      const updated = quotations.find(q => q.id === selectedQuotation.id);
      if (updated) {
        setSelectedQuotation(updated);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
                  Gestão de Cotações
                </h1>
                <p className="text-sm text-gray-500 mt-1 hidden sm:block">
                  Crie, gerencie e acompanhe cotações de fornecedores
                </p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {/* Toggle Metrics - Desktop */}
                <button
                  onClick={() => setShowMetrics(!showMetrics)}
                  className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                    showMetrics
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="text-sm font-medium">Métricas</span>
                </button>

                {/* Refresh */}
                <button
                  onClick={() => refresh()}
                  disabled={loading}
                  className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  title="Atualizar"
                >
                  <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>

                {/* Create Button */}
                {permissions.canCreate && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="hidden sm:inline">Nova Cotação</span>
                    <span className="sm:hidden">Nova</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Metrics Dashboard */}
        {showMetrics && (
          <div className="mb-6">
            <MetricsDashboard metrics={metrics} />
          </div>
        )}

        {/* Mobile Metrics Toggle */}
        <button
          onClick={() => setShowMetrics(!showMetrics)}
          className="sm:hidden w-full mb-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600"
        >
          <BarChart3 className="w-4 h-4" />
          <span className="text-sm font-medium">
            {showMetrics ? 'Ocultar Métricas' : 'Ver Métricas'}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showMetrics ? 'rotate-180' : ''}`} />
        </button>

        {/* Quotation List */}
        <QuotationList
          quotations={filteredQuotations}
          filters={filters}
          sort={sort}
          onFiltersChange={setFilters}
          onSortChange={setSort}
          onSelect={handleSelectQuotation}
          loading={loading}
        />

        {/* Stats Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Exibindo {filteredQuotations.length} de {quotations.length} cotações
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateQuotationModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateQuotation}
          suppliers={suppliers}
        />
      )}

      {/* Detail Drawer */}
      {selectedQuotation && (
        <QuotationDrawer
          isOpen={showDrawer}
          quotation={selectedQuotation}
          permissions={permissions}
          onClose={handleCloseDrawer}
          onSendToSuppliers={async () => {
            await sendToSuppliers(selectedQuotation.id);
            await handleRefreshAfterAction();
          }}
          onSelectWinner={async (proposalId) => {
            await selectWinner(selectedQuotation.id, proposalId);
            await handleRefreshAfterAction();
          }}
          onSubmitForApproval={async () => {
            await submitForApproval(selectedQuotation.id);
            await handleRefreshAfterAction();
          }}
          onApprove={async (comment) => {
            await approveQuotation(selectedQuotation.id, comment);
            await handleRefreshAfterAction();
          }}
          onReject={async (comment) => {
            await rejectQuotation(selectedQuotation.id, comment);
            await handleRefreshAfterAction();
          }}
          onCancel={async (reason) => {
            await cancelQuotation(selectedQuotation.id, reason);
            await handleRefreshAfterAction();
          }}
          onConvertToPurchase={async () => {
            await convertToPurchase(selectedQuotation.id);
            await handleRefreshAfterAction();
          }}
          onSubmitProposal={async (quotationId, data) => {
            await submitProposal({ ...data, quotationId });
            await handleRefreshAfterAction();
          }}
        />
      )}
    </div>
  );
};

export default QuotationManagementPage;
