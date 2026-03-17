import React, { useState, useEffect } from 'react';
import { 
  ArrowUpDown, 
  Filter, 
  Calendar, 
  Package, 
  User, 
  FileText, 
  Repeat, 
  RotateCcw, 
  Coffee, 
  MoreHorizontal,
  X,
  Search
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { useNotification } from '../hooks/useNotification';
import Notification from './Notification';

const ITEMS_PER_PAGE = 25;

const MovementHistory: React.FC = () => {
  const { movements, products, addMovement } = useInventory();
  const { notification, showSuccess, showError, hideNotification } = useNotification();
  const [showAddMovement, setShowAddMovement] = useState(false);
  const [filterReason, setFilterReason] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  
  // Card filter states
  const [selectedReasonFilters, setSelectedReasonFilters] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const [newMovement, setNewMovement] = useState({
    productId: '',
    quantity: 0,
    reason: 'internal-consumption' as any,
    notes: '',
    authorizedBy: ''
  });

  const reasonLabels: Record<string, string> = {
    'internal-transfer': 'Transferência Interna',
    'return': 'Devolução',
    'internal-consumption': 'Consumo Interno',
    'other': 'Outros'
  };

  const reasonColors: Record<string, { bg: string; bgActive: string; text: string; textActive: string; border: string; borderActive: string }> = {
    'internal-transfer': {
      bg: 'bg-purple-100 dark:bg-purple-900/50',
      bgActive: 'bg-purple-500',
      text: 'text-purple-600 dark:text-purple-400',
      textActive: 'text-white',
      border: 'border-gray-100 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-700',
      borderActive: 'border-purple-400 ring-2 ring-purple-400/30 bg-purple-50 dark:bg-purple-900/20'
    },
    'return': {
      bg: 'bg-green-100 dark:bg-green-900/50',
      bgActive: 'bg-green-500',
      text: 'text-green-600 dark:text-green-400',
      textActive: 'text-white',
      border: 'border-gray-100 dark:border-gray-700 hover:border-green-200 dark:hover:border-green-700',
      borderActive: 'border-green-400 ring-2 ring-green-400/30 bg-green-50 dark:bg-green-900/20'
    },
    'internal-consumption': {
      bg: 'bg-blue-100 dark:bg-blue-900/50',
      bgActive: 'bg-blue-500',
      text: 'text-blue-600 dark:text-blue-400',
      textActive: 'text-white',
      border: 'border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700',
      borderActive: 'border-blue-400 ring-2 ring-blue-400/30 bg-blue-50 dark:bg-blue-900/20'
    },
    'other': {
      bg: 'bg-gray-200 dark:bg-gray-600',
      bgActive: 'bg-gray-500',
      text: 'text-gray-600 dark:text-gray-300',
      textActive: 'text-white',
      border: 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
      borderActive: 'border-gray-400 ring-2 ring-gray-400/30 bg-gray-100 dark:bg-gray-700'
    }
  };

  const reasonIcons: Record<string, React.ReactNode> = {
    'internal-transfer': <Repeat className="w-5 h-5" />,
    'return': <RotateCcw className="w-5 h-5" />,
    'internal-consumption': <Coffee className="w-5 h-5" />,
    'other': <MoreHorizontal className="w-5 h-5" />
  };

  // Filtra movimentações baseado em todos os filtros
  const filteredMovements = movements.filter(movement => {
    // Filtro por reason cards (cumulativo)
    const matchesReasonCards = selectedReasonFilters.size === 0 || selectedReasonFilters.has(movement.reason);
    // Filtro por dropdown de reason (quando cards não estão ativos)
    const matchesReasonDropdown = selectedReasonFilters.size > 0 || filterReason === 'all' || movement.reason === filterReason;
    // Filtro por data
    const matchesDate = !dateFilter || movement.date === dateFilter;
    // Filtro por busca textual
    const matchesSearch = !searchTerm || 
      movement.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (movement.authorizedBy && movement.authorizedBy.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (movement.notes && movement.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesReasonCards && matchesReasonDropdown && matchesDate && matchesSearch;
  });

  const displayedMovements = filteredMovements.slice(0, displayCount);
  const hasMoreItems = filteredMovements.length > displayCount;

  const handleShowMore = () => {
    setDisplayCount(prev => prev + ITEMS_PER_PAGE);
  };

  // Calcula quantos itens serão exibidos no próximo clique
  const remainingItems = filteredMovements.length - displayCount;
  const nextBatchSize = Math.min(ITEMS_PER_PAGE, remainingItems);

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
  }, [filterReason, dateFilter, selectedReasonFilters, searchTerm]);

  // Toggle reason filter via cards (multi-select cumulativo)
  const toggleReasonCardFilter = (reason: string) => {
    setSelectedReasonFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reason)) {
        newSet.delete(reason);
      } else {
        newSet.add(reason);
      }
      // Limpa o filtro dropdown quando usar cards
      if (newSet.size > 0) {
        setFilterReason('all');
      }
      return newSet;
    });
  };

  // Limpar filtros de cards
  const clearReasonCardFilters = () => {
    setSelectedReasonFilters(new Set());
  };

  // Contagem por motivo
  const getCountByReason = (reason: string) => {
    return movements.filter(m => m.reason === reason).length;
  };

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
        notes: newMovement.notes,
        unitPrice: 0,
        totalValue: 0
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
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">Histórico de Movimentações</h2>
          <p className="text-gray-500 dark:text-gray-400">Controle todas as saídas de produtos do estoque</p>
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 animate-scale-in">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Registrar Nova Saída</h3>
          <form onSubmit={handleSubmitMovement} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Produto *</label>
              <select
                value={newMovement.productId}
                onChange={(e) => setNewMovement(prev => ({ ...prev, productId: e.target.value }))}
                required
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 cursor-pointer"
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quantidade *</label>
              <input
                type="number"
                value={newMovement.quantity}
                onChange={(e) => setNewMovement(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                required
                min="1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Motivo *</label>
              <select
                value={newMovement.reason}
                onChange={(e) => setNewMovement(prev => ({ ...prev, reason: e.target.value as any }))}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
              >
                <option value="internal-consumption">Consumo Interno</option>
                <option value="internal-transfer">Transferência Interna</option>
                <option value="return">Devolução</option>
                <option value="other">Outros</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Autorizado por *</label>
              <input
                type="text"
                value={newMovement.authorizedBy}
                onChange={(e) => setNewMovement(prev => ({ ...prev, authorizedBy: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                placeholder="Nome do responsável"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Observações</label>
              <input
                type="text"
                value={newMovement.notes}
                onChange={(e) => setNewMovement(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                placeholder="Informações adicionais (opcional)"
              />
            </div>

            <div className="md:col-span-2 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowAddMovement(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
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

      {/* Stats Cards - Filtros visuais por motivo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        {/* Transferência Interna */}
        <button
          onClick={() => toggleReasonCardFilter('internal-transfer')}
          className={`bg-white dark:bg-gray-800 rounded-xl p-3 md:p-4 border shadow-sm hover:shadow-md transition-all duration-200 text-left ${
            selectedReasonFilters.has('internal-transfer') 
              ? reasonColors['internal-transfer'].borderActive 
              : reasonColors['internal-transfer'].border
          }`}
        >
          <div className="flex items-center gap-2 md:gap-3">
            <div className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center ${
              selectedReasonFilters.has('internal-transfer') 
                ? reasonColors['internal-transfer'].bgActive 
                : reasonColors['internal-transfer'].bg
            }`}>
              <Repeat className={`w-4 h-4 md:w-5 md:h-5 ${
                selectedReasonFilters.has('internal-transfer') 
                  ? reasonColors['internal-transfer'].textActive 
                  : reasonColors['internal-transfer'].text
              }`} />
            </div>
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">
                {getCountByReason('internal-transfer')}
              </p>
              <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium truncate">Transferência</p>
            </div>
          </div>
        </button>

        {/* Devolução */}
        <button
          onClick={() => toggleReasonCardFilter('return')}
          className={`bg-white dark:bg-gray-800 rounded-xl p-3 md:p-4 border shadow-sm hover:shadow-md transition-all duration-200 text-left ${
            selectedReasonFilters.has('return') 
              ? reasonColors['return'].borderActive 
              : reasonColors['return'].border
          }`}
        >
          <div className="flex items-center gap-2 md:gap-3">
            <div className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center ${
              selectedReasonFilters.has('return') 
                ? reasonColors['return'].bgActive 
                : reasonColors['return'].bg
            }`}>
              <RotateCcw className={`w-4 h-4 md:w-5 md:h-5 ${
                selectedReasonFilters.has('return') 
                  ? reasonColors['return'].textActive 
                  : reasonColors['return'].text
              }`} />
            </div>
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">
                {getCountByReason('return')}
              </p>
              <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium truncate">Devolução</p>
            </div>
          </div>
        </button>

        {/* Consumo Interno */}
        <button
          onClick={() => toggleReasonCardFilter('internal-consumption')}
          className={`bg-white dark:bg-gray-800 rounded-xl p-3 md:p-4 border shadow-sm hover:shadow-md transition-all duration-200 text-left ${
            selectedReasonFilters.has('internal-consumption') 
              ? reasonColors['internal-consumption'].borderActive 
              : reasonColors['internal-consumption'].border
          }`}
        >
          <div className="flex items-center gap-2 md:gap-3">
            <div className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center ${
              selectedReasonFilters.has('internal-consumption') 
                ? reasonColors['internal-consumption'].bgActive 
                : reasonColors['internal-consumption'].bg
            }`}>
              <Coffee className={`w-4 h-4 md:w-5 md:h-5 ${
                selectedReasonFilters.has('internal-consumption') 
                  ? reasonColors['internal-consumption'].textActive 
                  : reasonColors['internal-consumption'].text
              }`} />
            </div>
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">
                {getCountByReason('internal-consumption')}
              </p>
              <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium truncate">Consumo</p>
            </div>
          </div>
        </button>

        {/* Outros */}
        <button
          onClick={() => toggleReasonCardFilter('other')}
          className={`bg-white dark:bg-gray-800 rounded-xl p-3 md:p-4 border shadow-sm hover:shadow-md transition-all duration-200 text-left ${
            selectedReasonFilters.has('other') 
              ? reasonColors['other'].borderActive 
              : reasonColors['other'].border
          }`}
        >
          <div className="flex items-center gap-2 md:gap-3">
            <div className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center ${
              selectedReasonFilters.has('other') 
                ? reasonColors['other'].bgActive 
                : reasonColors['other'].bg
            }`}>
              <MoreHorizontal className={`w-4 h-4 md:w-5 md:h-5 ${
                selectedReasonFilters.has('other') 
                  ? reasonColors['other'].textActive 
                  : reasonColors['other'].text
              }`} />
            </div>
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">
                {getCountByReason('other')}
              </p>
              <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium truncate">Outros</p>
            </div>
          </div>
        </button>
      </div>

      {/* Indicador de filtros ativos por cards */}
      {selectedReasonFilters.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 animate-fade-in">
          <span className="text-sm text-gray-500 dark:text-gray-400">Filtros ativos:</span>
          {Array.from(selectedReasonFilters).map(reason => (
            <span 
              key={reason}
              className={`px-2.5 py-1 text-xs font-medium rounded-full ${reasonColors[reason]?.bg} ${reasonColors[reason]?.text}`}
            >
              {reasonLabels[reason]}
            </span>
          ))}
          <button
            onClick={clearReasonCardFilters}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            title="Limpar filtros"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 md:p-6 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Busca textual */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Produto, responsável ou observações..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Filtrar por Data</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
            />
          </div>

          <div className="flex items-end">
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg">
              <Filter className="w-4 h-4 mr-2" />
              <span className="font-medium text-gray-700 dark:text-gray-300">{filteredMovements.length}</span>&nbsp;resultado(s)
            </div>
          </div>
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        {/* Scroll container with scrollbar at top using transform */}
        <div className="overflow-x-auto" style={{ transform: 'rotateX(180deg)' }}>
          <div style={{ transform: 'rotateX(180deg)' }}>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700 dark:to-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Produto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Quantidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Motivo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Autorizado por
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Observações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {displayedMovements.map((movement) => (
                <tr key={movement.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Package className="w-5 h-5 text-gray-400 dark:text-gray-500 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {movement.productName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      -{movement.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full">
                      {reasonLabels[movement.reason]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2" />
                      <span className="text-sm text-gray-900 dark:text-gray-100">{movement.date}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <User className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2" />
                      <span className="text-sm text-gray-900 dark:text-gray-100">{movement.authorizedBy}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">{movement.notes || '-'}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Show More Button and Footer */}
        {hasMoreItems && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex flex-col items-center gap-2">
            <button
              onClick={handleShowMore}
              className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 font-medium text-sm"
            >
              Exibir mais {nextBatchSize}
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Exibindo {displayCount} de {filteredMovements.length} • {remainingItems} restante(s)
            </span>
          </div>
        )}

        {/* Footer info when all items are displayed */}
        {!hasMoreItems && displayedMovements.length > 0 && (
          <div className="p-3 border-t border-gray-100 dark:border-gray-700 text-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Exibindo {displayedMovements.length} de {filteredMovements.length} movimentação(ões)
            </span>
          </div>
        )}

        {displayedMovements.length === 0 && (
          <div className="p-12 text-center">
            <ArrowUpDown className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Nenhuma movimentação encontrada</h3>
            <p className="text-gray-500 dark:text-gray-400">Registre a primeira saída de produtos do estoque.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MovementHistory;