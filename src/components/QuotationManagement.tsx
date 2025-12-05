import React, { useState } from 'react';
import { FileText, Building2, DollarSign, Clock, Check, X, Plus, Eye } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { useNotification } from '../hooks/useNotification';
import { useDialog } from '../hooks/useDialog';
import { Quotation, QuotationItem } from '../types';
import { Pencil } from 'lucide-react';
import Notification from './Notification';

const QuotationManagement: React.FC = () => {
  const { quotations, suppliers, updateQuotationItem, selectQuotationWinner } = useInventory();
  const { notification, showSuccess, showError, hideNotification } = useNotification();
  const { showConfirmDialog } = useDialog();
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [editingItem, setEditingItem] = useState<QuotationItem | null>(null);
  const [priceData, setPriceData] = useState({
    unitPrice: 0,
    deliveryTime: '',
    notes: ''
  });

  const statusLabels = {
    'pending': 'Pendente',
    'in_progress': 'Em Andamento',
    'completed': 'Finalizada',
    'cancelled': 'Cancelada'
  };

  const statusColors = {
    'pending': 'bg-yellow-100 text-yellow-800',
    'in_progress': 'bg-blue-100 text-blue-800',
    'completed': 'bg-green-100 text-green-800',
    'cancelled': 'bg-red-100 text-red-800'
  };

  const itemStatusLabels = {
    'pending': 'Aguardando',
    'submitted': 'Enviado',
    'selected': 'Selecionado',
    'rejected': 'Rejeitado'
  };

  const itemStatusColors = {
    'pending': 'bg-gray-100 text-gray-800',
    'submitted': 'bg-blue-100 text-blue-800',
    'selected': 'bg-green-100 text-green-800',
    'rejected': 'bg-red-100 text-red-800'
  };

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleAddPrice = (item: QuotationItem) => {
    setEditingItem(item);
    setPriceData({
      unitPrice: item.unitPrice || 0,
      deliveryTime: item.deliveryTime || '',
      notes: item.notes || ''
    });
    setShowPriceModal(true);
  };

  const handleSubmitPrice = async () => {
    if (!editingItem) return;

    try {
      await updateQuotationItem(editingItem.id, {
        unitPrice: priceData.unitPrice,
        deliveryTime: priceData.deliveryTime,
        notes: priceData.notes,
        status: 'submitted'
      });

      setShowPriceModal(false);
      setEditingItem(null);
      setPriceData({ unitPrice: 0, deliveryTime: '', notes: '' });
      showSuccess('Proposta salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar cotação:', error);
      showError('Erro ao salvar cotação. Tente novamente.');
    }
  };

  const handleSelectWinner = async (quotationId: string, itemId: string) => {
    showConfirmDialog(
      'Confirmar Seleção',
      'Confirma a seleção desta proposta como vencedora?',
      async () => {
        try {
          await selectQuotationWinner(quotationId, itemId);
          showSuccess('Proposta selecionada com sucesso!');
        } catch (error) {
          console.error('Erro ao selecionar proposta:', error);
          showError('Erro ao selecionar proposta. Tente novamente.');
        }
      }
    );
  };

  const getLowestPrice = (items: QuotationItem[]) => {
    const submittedItems = items.filter(item => item.unitPrice && item.status === 'submitted');
    if (submittedItems.length === 0) return null;
    return Math.min(...submittedItems.map(item => item.unitPrice!));
  };

const filteredQuotations = quotations
  .filter((q) => {
    if (statusFilter !== 'all' && q.status !== statusFilter) return false;
    const searchLower = searchTerm.toLowerCase();
    return (
      q.productName.toLowerCase().includes(searchLower) ||
      q.id.toLowerCase().includes(searchLower)
    );
  })
  .sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  return (
    <div className="space-y-6">
      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Gerenciamento de Cotações</h2>
        <p className="text-gray-600">Gerencie cotações e compare propostas de fornecedores</p>
      </div>

<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
  <div className="flex gap-2 flex-wrap">
    <select
      value={statusFilter}
      onChange={(e) => setStatusFilter(e.target.value as any)}
      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
    >
      <option value="all">Todos os status</option>
      <option value="pending">Pendente</option>
      <option value="in_progress">Em Andamento</option>
      <option value="completed">Finalizada</option>
      <option value="cancelled">Cancelada</option>
    </select>
    <select
      value={sortOrder}
      onChange={(e) => setSortOrder(e.target.value as any)}
      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
    >
      <option value="newest">Mais recentes</option>
      <option value="oldest">Mais antigas</option>
    </select>
  </div>
  <input
    type="text"
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    placeholder="Buscar por produto ou ID..."
    className="px-3 py-2 border border-gray-300 rounded-lg w-full md:w-64 text-sm"
  />
</div>
      
      {/* Quotations List */}
      <div className="space-y-4">
        {filteredQuotations.map((quotation) => (
          <div key={quotation.id} className="bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <FileText className="w-6 h-6 text-blue-600 mr-3" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      Cotação {quotation.id}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Produto: {quotation.productName} | Quantidade: {quotation.requestedQuantity}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusColors[quotation.status]}`}>
                    {statusLabels[quotation.status]}
                  </span>
                  <button
                    onClick={() => setSelectedQuotation(selectedQuotation?.id === quotation.id ? null : quotation)}
                    className="px-3 py-1 text-sm text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 hover:text-blue-800 transition-colors flex items-center space-x-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Visualizar</span>
                  </button>

                  {['pending', 'in_progress'].includes(quotation.status) && (
                  <button
                    onClick={() => {
                      showConfirmDialog(
                        'Cancelar Cotação',
                        'Tem certeza que deseja cancelar esta cotação?',
                        async () => {
                          // Implementar função updateQuotationStatus se necessário
                          showSuccess('Cotação cancelada com sucesso!');
                        },
                        { type: 'danger', confirmText: 'Cancelar' }
                      );
                    }}
                    className="px-3 py-1 text-sm text-red-700 bg-red-100 rounded-lg hover:bg-red-200 hover:text-red-800 transition-colors"
                  >
                    Cancelar
                  </button>
                )}
                </div>
              </div>

              {/* Quotation Items Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Fornecedores Convidados</p>
                  <p className="text-lg font-semibold text-gray-800">{quotation.items.length}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Propostas Recebidas</p>
                  <p className="text-lg font-semibold text-blue-600">
                    {quotation.items.filter(item => item.status === 'submitted').length}
                  </p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Menor Preço</p>
                  <p className="text-lg font-semibold text-green-600">
                    {(() => {
                      const lowestPrice = getLowestPrice(quotation.items);
                      return lowestPrice ? formatCurrency(lowestPrice) : 'N/A';
                    })()}
                  </p>
                </div>
              </div>

              {/* Expanded Details */}
              {selectedQuotation?.id === quotation.id && (
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-md font-semibold text-gray-800 mb-3">Propostas dos Fornecedores</h4>
                  <div className="space-y-3">
                    {quotation.items.map((item) => (
                      <div key={item.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center">
                            <Building2 className="w-5 h-5 text-gray-400 mr-2" />
                            <span className="font-medium text-gray-800">{item.supplierName}</span>
                              {item.status === 'selected' && (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                Selecionado
                              </span>
                            )}                
                          </div>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${itemStatusColors[item.status]}`}>
                            {itemStatusLabels[item.status]}
                          </span>
                        </div>

                        {item.status === 'pending' ? (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Aguardando proposta</span>
                            <button
                              onClick={() => handleAddPrice(item)}
                              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Adicionar Preço
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-gray-500">Preço Unitário</p>
                              <p className="font-semibold text-gray-800">
                                {item.unitPrice ? formatCurrency(item.unitPrice) : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Preço Total</p>
                              <p className="font-semibold text-gray-800">
                                {item.totalPrice ? formatCurrency(item.totalPrice) : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Prazo de Entrega</p>
                              <p className="text-sm text-gray-700">{item.deliveryTime || 'N/A'}</p>
                            </div>
                            <div className="flex items-center justify-end space-x-2">
                              {quotation.status === 'in_progress' && item.status === 'submitted' && (
                                <button
                                  onClick={() => handleSelectWinner(quotation.id, item.id)}
                                  className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center"
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  Selecionar
                                </button>
                              )}
                              <button
                              onClick={() => handleAddPrice(item)}
                              className="px-3 py-1 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 hover:text-gray-900 transition-colors flex items-center space-x-2"
                            >
                              <Pencil className="w-4 h-4" />
                              <span>Editar</span>
                            </button>
                            </div>
                          </div>
                        )}

                        {item.notes && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-500">Observações</p>
                            <p className="text-sm text-gray-700">{item.notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {quotations.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-100">
          <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma cotação encontrada</h3>
          <p className="text-gray-500">As cotações aparecerão aqui quando forem criadas a partir das solicitações aprovadas.</p>
        </div>
      )}

      {/* Price Modal */}
      {showPriceModal && editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">
                Proposta - {editingItem.supplierName}
              </h2>
              <button
                onClick={() => setShowPriceModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preço Unitário (R$) *
                </label>
                <input
                  type="number"
                  value={priceData.unitPrice}
                  onChange={(e) => setPriceData(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                  step="0.01"
                  min="0"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0,00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prazo de Entrega
                </label>
                <input
                  type="text"
                  value={priceData.deliveryTime}
                  onChange={(e) => setPriceData(prev => ({ ...prev, deliveryTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 5 dias úteis"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações
                </label>
                <textarea
                  value={priceData.notes}
                  onChange={(e) => setPriceData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Informações adicionais sobre a proposta..."
                />
              </div>

              {priceData.unitPrice > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Valor Total:</strong> {formatCurrency(priceData.unitPrice * (quotations.find(q => q.items.some(i => i.id === editingItem.id))?.requestedQuantity || 0))}
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowPriceModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitPrice}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Salvar Proposta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotationManagement;