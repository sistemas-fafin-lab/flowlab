import React, { useState } from 'react';
import { Calendar, AlertTriangle, Package, Clock, Filter, Trash2, ShoppingCart } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { useNotification } from '../hooks/useNotification';
import { useDialog } from '../hooks/useDialog';
import Notification from './Notification';
import ConfirmDialog from './ConfirmDialog';
import InputDialog from './InputDialog';

const ExpirationMonitor: React.FC = () => {
  const { products, writeOffProduct, requestReplenishment } = useInventory();
  const { notification, showSuccess, showError, hideNotification } = useNotification();
  const { confirmDialog, showConfirmDialog, hideConfirmDialog, handleConfirmDialogConfirm, inputDialog, showInputDialog, hideInputDialog, handleInputDialogConfirm } = useDialog();
  const [daysFilter, setDaysFilter] = useState(30);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'general' | 'technical'>('all');
  const [loading, setLoading] = useState<string | null>(null);

  const today = new Date();
  const filterDate = new Date();
  filterDate.setDate(today.getDate() + daysFilter);

  const getExpirationStatus = (expirationDate: string) => {
    const expDate = new Date(expirationDate);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { status: 'expired', days: Math.abs(diffDays), color: 'text-red-600' };
    if (diffDays <= 7) return { status: 'critical', days: diffDays, color: 'text-red-600' };
    if (diffDays <= 30) return { status: 'warning', days: diffDays, color: 'text-orange-600' };
    return { status: 'safe', days: diffDays, color: 'text-green-600' };
  };

  const filteredProducts = products.filter(product => {
    const expirationDate = new Date(product.expirationDate);
    const matchesDate = expirationDate <= filterDate;
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    const hasStock = product.quantity > 0;
    return matchesDate && matchesCategory && hasStock;
  }).sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());

  const expiredProducts = filteredProducts.filter(p => getExpirationStatus(p.expirationDate).status === 'expired');
  const criticalProducts = filteredProducts.filter(p => getExpirationStatus(p.expirationDate).status === 'critical');
  const warningProducts = filteredProducts.filter(p => getExpirationStatus(p.expirationDate).status === 'warning');

  const stats = [
    {
      label: 'Produtos Vencidos',
      value: expiredProducts.length,
      color: 'bg-red-500',
      textColor: 'text-red-600'
    },
    {
      label: 'Críticos (≤7 dias)',
      value: criticalProducts.length,
      color: 'bg-red-400',
      textColor: 'text-red-600'
    },
    {
      label: 'Atenção (≤30 dias)',
      value: warningProducts.length,
      color: 'bg-orange-500',
      textColor: 'text-orange-600'
    },
    {
      label: 'Total Monitorados',
      value: filteredProducts.length,
      color: 'bg-blue-500',
      textColor: 'text-blue-600'
    }
  ];

  const handleWriteOff = async (productId: string, productName: string) => {
    const reason = await showInputDialog(
      'Motivo da Baixa',
      `Digite o motivo da baixa para "${productName}":`,
      { placeholder: 'Ex: Produto vencido, danificado, etc.', required: true }
    );
    
    if (!reason) return;

    const authorizedBy = await showInputDialog(
      'Autorização',
      'Digite seu nome para autorizar a baixa:',
      { placeholder: 'Seu nome completo', required: true }
    );
    
    if (!authorizedBy) return;

    try {
      setLoading(productId);
      await writeOffProduct(productId, reason, authorizedBy);
      showSuccess('Produto dado baixa com sucesso!');
    } catch (error) {
      console.error('Erro ao dar baixa no produto:', error);
      showError('Erro ao dar baixa no produto. Tente novamente.');
    } finally {
      setLoading(null);
    }
  };

  const handleRequestReplenishment = async (productId: string, productName: string) => {
    const requestedBy = await showInputDialog(
      'Solicitar Reposição',
      `Digite seu nome para solicitar reposição de "${productName}":`,
      { placeholder: 'Seu nome completo', required: true }
    );
    
    if (!requestedBy) return;

    try {
      setLoading(productId);
      await requestReplenishment(productId, requestedBy);
      showSuccess('Solicitação de reposição criada com sucesso!');
    } catch (error) {
      console.error('Erro ao solicitar reposição:', error);
      showError('Erro ao solicitar reposição. Tente novamente.');
    } finally {
      setLoading(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
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

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        onConfirm={handleConfirmDialogConfirm}
        onCancel={hideConfirmDialog}
        type={confirmDialog.type}
      />

      <InputDialog
        isOpen={inputDialog.isOpen}
        title={inputDialog.title}
        message={inputDialog.message}
        placeholder={inputDialog.placeholder}
        confirmText={inputDialog.confirmText}
        cancelText={inputDialog.cancelText}
        onConfirm={handleInputDialogConfirm}
        onCancel={hideInputDialog}
        required={inputDialog.required}
      />

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Controle de Validade</h2>
        <p className="text-gray-600">Monitoramento de produtos próximos ao vencimento</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.textColor} mt-1`}>{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <Calendar className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por Prazo</label>
            <select
              value={daysFilter}
              onChange={(e) => setDaysFilter(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={7}>Próximos 7 dias</option>
              <option value={15}>Próximos 15 dias</option>
              <option value={30}>Próximos 30 dias</option>
              <option value={60}>Próximos 60 dias</option>
              <option value={90}>Próximos 90 dias</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todas as Categorias</option>
              <option value="general">Uso Geral</option>
              <option value="technical">Insumos Técnicos</option>
            </select>
          </div>

          <div className="flex items-end">
            <div className="flex items-center text-sm text-gray-600">
              <Filter className="w-4 h-4 mr-2" />
              {filteredProducts.length} produto(s) encontrado(s)
            </div>
          </div>
        </div>
      </div>

      {/* Products List */}
      <div className="space-y-4">
        {filteredProducts.map((product) => {
          const expirationInfo = getExpirationStatus(product.expirationDate);
          const isLoading = loading === product.id;
          
          return (
            <div key={product.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <Package className="w-6 h-6 text-blue-600 mr-3" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{product.name}</h3>
                    <p className="text-sm text-gray-500">{product.code}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {expirationInfo.status === 'expired' && (
                    <span className="px-3 py-1 text-sm font-medium bg-red-100 text-red-800 rounded-full">
                      Vencido há {expirationInfo.days} dia(s)
                    </span>
                  )}
                  {expirationInfo.status === 'critical' && (
                    <span className="px-3 py-1 text-sm font-medium bg-red-100 text-red-800 rounded-full">
                      Vence em {expirationInfo.days} dia(s)
                    </span>
                  )}
                  {expirationInfo.status === 'warning' && (
                    <span className="px-3 py-1 text-sm font-medium bg-orange-100 text-orange-800 rounded-full">
                      Vence em {expirationInfo.days} dia(s)
                    </span>
                  )}
                  
                  {expirationInfo.status === 'expired' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                  {expirationInfo.status === 'critical' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                  {expirationInfo.status === 'warning' && <Clock className="w-5 h-5 text-orange-500" />}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Categoria</p>
                  <p className="font-medium text-gray-800 capitalize">
                    {product.category}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Quantidade</p>
                  <p className="font-medium text-gray-800">{product.quantity} {product.unit}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Preço Unitário</p>
                  <p className="font-medium text-gray-800">{formatCurrency(product.unitPrice)}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Valor Total</p>
                  <p className="font-medium text-gray-800">{formatCurrency(product.totalValue)}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Localização</p>
                  <p className="font-medium text-gray-800">{product.location}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Data de Validade</p>
                  <p className={`font-medium ${expirationInfo.color}`}>
                    {product.expirationDate}
                  </p>
                </div>
              </div>

              {/* Action Buttons for Critical/Expired Products */}
              {(expirationInfo.status === 'expired' || expirationInfo.status === 'critical') && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleWriteOff(product.id, product.name)}
                      disabled={isLoading}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                          Processando...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Dar Baixa
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleRequestReplenishment(product.id, product.name)}
                      disabled={isLoading}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                          Processando...
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Solicitar Reposição
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-100">
          <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum produto encontrado</h3>
          <p className="text-gray-500">
            Não há produtos com estoque próximos ao vencimento no período selecionado.
          </p>
        </div>
      )}
    </div>
  );
};

export default ExpirationMonitor;