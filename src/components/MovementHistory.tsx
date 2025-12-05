import React, { useState } from 'react';
import { ArrowUpDown, Filter, Calendar, Package, User, FileText } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { useNotification } from '../hooks/useNotification';
import Notification from './Notification';

const MovementHistory: React.FC = () => {
  const { movements, products, addMovement } = useInventory();
  const { notification, showSuccess, showError, hideNotification } = useNotification();
  const [showAddMovement, setShowAddMovement] = useState(false);
  const [filterReason, setFilterReason] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('');

  const [newMovement, setNewMovement] = useState({
    productId: '',
    quantity: 0,
    reason: 'internal-consumption' as any,
    notes: '',
    authorizedBy: ''
  });

  const reasonLabels = {
    'internal-transfer': 'Transferência Interna',
    'return': 'Devolução',
    'internal-consumption': 'Consumo Interno',
    'other': 'Outros'
  };

  const filteredMovements = movements.filter(movement => {
    const matchesReason = filterReason === 'all' || movement.reason === filterReason;
    const matchesDate = !dateFilter || movement.date === dateFilter;
    return matchesReason && matchesDate;
  });

  const handleSubmitMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.id === newMovement.productId);
    if (!product) {
      showError('Produto não encontrado');
      return;
    }

    try {
      await addMovement({
        productId: newMovement.productId,
        productName: product.name,
        type: 'out',
        reason: newMovement.reason,
        quantity: newMovement.quantity,
        date: new Date().toISOString().split('T')[0],
        authorizedBy: newMovement.authorizedBy,
        notes: newMovement.notes
      });

      setNewMovement({
        productId: '',
        quantity: 0,
        reason: 'internal-consumption',
        notes: '',
        authorizedBy: ''
      });
      setShowAddMovement(false);
      showSuccess('Movimentação registrada com sucesso!');
    } catch (error) {
      console.error('Erro ao registrar movimentação:', error);
      showError('Erro ao registrar movimentação. Tente novamente.');
    }
  };

  return (
    <div className="space-y-6">
      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />

      {/* Header and Add Button */}
      <div className="flex justify-between items-center animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Histórico de Movimentações</h2>
          <p className="text-gray-500">Controle todas as saídas de produtos do estoque</p>
        </div>
        <button
          onClick={() => setShowAddMovement(!showAddMovement)}
          className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 flex items-center font-medium shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30"
        >
          <ArrowUpDown className="w-4 h-4 mr-2" />
          Nova Movimentação
        </button>
      </div>

      {/* Add Movement Form */}
      {showAddMovement && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 animate-scale-in">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Registrar Nova Saída</h3>
          <form onSubmit={handleSubmitMovement} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Produto *</label>
              <select
                value={newMovement.productId}
                onChange={(e) => setNewMovement(prev => ({ ...prev, productId: e.target.value }))}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50 cursor-pointer"
              >
                <option value="">Selecione um produto</option>
                {products.filter(p => p.quantity > 0).map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} - {product.code} (Estoque: {product.quantity} {product.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quantidade *</label>
              <input
                type="number"
                value={newMovement.quantity}
                onChange={(e) => setNewMovement(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                required
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Motivo *</label>
              <select
                value={newMovement.reason}
                onChange={(e) => setNewMovement(prev => ({ ...prev, reason: e.target.value as any }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="internal-consumption">Consumo Interno</option>
                <option value="internal-transfer">Transferência Interna</option>
                <option value="return">Devolução</option>
                <option value="other">Outros</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Autorizado por *</label>
              <input
                type="text"
                value={newMovement.authorizedBy}
                onChange={(e) => setNewMovement(prev => ({ ...prev, authorizedBy: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nome do responsável"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
              <input
                type="text"
                value={newMovement.notes}
                onChange={(e) => setNewMovement(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Informações adicionais (opcional)"
              />
            </div>

            <div className="md:col-span-2 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowAddMovement(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Registrar Saída
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por Motivo</label>
            <select
              value={filterReason}
              onChange={(e) => setFilterReason(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50 cursor-pointer"
            >
              <option value="all">Todos os Motivos</option>

            <option value="internal-transfer">Transferência Interna</option>
              <option value="return">Devolução</option>
              <option value="internal-consumption">Consumo Interno</option>
              <option value="other">Outros</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por Data</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
            />
          </div>

          <div className="flex items-end">
            <div className="flex items-center text-sm text-gray-500">
              <Filter className="w-4 h-4 mr-2" />
              <span className="font-medium text-gray-700">{filteredMovements.length}</span>&nbsp;movimentação(ões) encontrada(s)
            </div>
          </div>
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Produto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Motivo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Autorizado por
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Observações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMovements.map((movement) => (
                <tr key={movement.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Package className="w-5 h-5 text-gray-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {movement.productName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-red-600">
                      -{movement.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      {reasonLabels[movement.reason]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">{movement.date}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <User className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">{movement.authorizedBy}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-500">{movement.notes || '-'}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredMovements.length === 0 && (
          <div className="p-12 text-center">
            <ArrowUpDown className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma movimentação encontrada</h3>
            <p className="text-gray-500">Registre a primeira saída de produtos do estoque.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MovementHistory;