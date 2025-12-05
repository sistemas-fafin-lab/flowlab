import React, { useState } from 'react';
import {
  Package,
  AlertTriangle,
  Calendar,
  TrendingUp,
  Loader2,
  DollarSign,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus
  
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import PurchaseComparison from './PurchaseComparison';
import DetailModal from './DetailModal';

const Dashboard: React.FC = () => {
  const { getDashboardData, getFinancialMetrics, products, movements, loading, error } = useInventory();
  const [selectedDetail, setSelectedDetail] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Carregando dados...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
          <span className="text-red-700">Erro ao carregar dados: {error}</span>
        </div>
      </div>
    );
  }

  const dashboardData = getDashboardData();
  const financialMetrics = getFinancialMetrics();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return <ArrowUpRight className="w-4 h-4 text-green-600" />;
    if (value < 0) return <ArrowDownRight className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-600" />;
  };

  const getTrendColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const stats = [
    {
      name: 'Total de Produtos',
      value: dashboardData.totalProducts,
      icon: Package,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      detailKey: 'allProducts'
    },
    {
      name: 'Estoque Baixo',
      value: dashboardData.lowStockProducts,
      icon: AlertTriangle,
      color: 'bg-orange-500',
      textColor: 'text-orange-600',
      detailKey: 'lowStock'
    },
    {
      name: 'Próximos ao Vencimento',
      value: dashboardData.expiringProducts,
      icon: Calendar,
      color: 'bg-red-500',
      textColor: 'text-red-600',
      detailKey: 'expiring'
    },
    {
      name: 'Movimentações Recentes',
      value: dashboardData.recentMovements,
      icon: TrendingUp,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      detailKey: 'recentMovements'
    }
  ];

  const financialStats = [
    {
      name: 'Valor Total do Estoque',
      value: formatCurrency(dashboardData.totalInventoryValue),
      change: dashboardData.monthlyInventoryChangePercent,
      changeValue: formatCurrency(dashboardData.monthlyInventoryChange),
      icon: DollarSign,
      color: 'bg-emerald-500',
      detailKey: 'financialStats'
    },
    {
      name: 'Movimentações do Mês',
      value: formatCurrency(dashboardData.monthlyMovementsValue),
      change: dashboardData.monthlyMovementsChangePercent,
      changeValue: formatCurrency(dashboardData.monthlyMovementsChange),
      icon: BarChart3,
      color: 'bg-purple-500',
      detailKey: 'financialStats'
    },
    {
      name: 'Valor Médio por Produto',
      value: formatCurrency(dashboardData.averageProductValue),
      change: 0, // Pode ser calculado se necessário
      changeValue: formatCurrency(0),
      icon: Package,
      color: 'bg-indigo-500',
      detailKey: 'financialStats'
    }
  ];

  const lowStockProducts = products.filter(p => p.status === 'low-stock');
  const expiringProducts = products.filter(p => {
    const expirationDate = new Date(p.expirationDate);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expirationDate <= thirtyDaysFromNow;
  });

  const recentMovements = movements.slice(0, 5);

  const getModalTitle = (detail: string): string => {
    const titles: Record<string, string> = {
      lowStock: 'Produtos com Estoque Baixo',
      expiring: 'Produtos Próximos ao Vencimento',
      recentMovements: 'Movimentações Recentes',
      topValue: 'Produtos de Maior Valor',
      financialStats: 'Métricas Financeiras Detalhadas',
      categories: 'Produtos por Categoria',
      allProducts: 'Todos os Produtos'
    };
    return titles[detail] || 'Detalhes';
  };

  const renderModalContent = (
    detail: string, 
    dashboardData: any, 
    financialMetrics: any, 
    products: any[], 
    movements: any[], 
    formatCurrency: (value: number) => string
  ) => {
    switch (detail) {
      case 'lowStock':
        const lowStockProducts = products.filter(p => p.status === 'low-stock');
        return (
          <div className="space-y-4">
            <p className="text-gray-600">
              {lowStockProducts.length} produto(s) com estoque abaixo do mínimo
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estoque Atual</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estoque Mínimo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Localização</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lowStockProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          <div className="text-sm text-gray-500">{product.code}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 font-medium">
                        {product.quantity} {product.unit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.minStock} {product.unit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(product.totalValue || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.location}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'expiring':
        const expiringProducts = products
          .filter(p => {
            const expirationDate = new Date(p.expirationDate);
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
            return expirationDate <= thirtyDaysFromNow;
          })
          .sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());
        
        return (
          <div className="space-y-4">
            <p className="text-gray-600">
              {expiringProducts.length} produto(s) próximos ao vencimento (próximos 30 dias)
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data de Validade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dias Restantes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {expiringProducts.map((product) => {
                    const daysUntilExpiration = Math.ceil(
                      (new Date(product.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <tr key={product.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{product.name}</div>
                            <div className="text-sm text-gray-500">{product.code}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.expirationDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${
                            daysUntilExpiration < 0 ? 'text-red-600' : 
                            daysUntilExpiration <= 7 ? 'text-red-600' : 'text-orange-600'
                          }`}>
                            {daysUntilExpiration < 0 ? `Vencido há ${Math.abs(daysUntilExpiration)} dias` : 
                             `${daysUntilExpiration} dias`}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.quantity} {product.unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(product.totalValue || 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'recentMovements':
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthlyMovements = movements.filter(movement => {
          const moveDate = new Date(movement.date);
          return moveDate.getMonth() === currentMonth && moveDate.getFullYear() === currentYear;
        });
        
        return (
          <div className="space-y-4">
            <p className="text-gray-600">
              {monthlyMovements.length} movimentação(ões) no mês atual
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Autorizado por</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {monthlyMovements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {movement.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {movement.productName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                        -{movement.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          {movement.reason === 'sale' && 'Saída'}
                          {movement.reason === 'internal-consumption' && 'Consumo Interno'}
                          {movement.reason === 'internal-transfer' && 'Transferência Interna'}
                          {movement.reason === 'return' && 'Devolução'}
                          {movement.reason === 'other' && 'Outros'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(movement.totalValue || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {movement.authorizedBy || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'topValue':
        const sortedProducts = [...products].sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0));
        
        return (
          <div className="space-y-4">
            <p className="text-gray-600">
              Todos os produtos ordenados por valor total (decrescente)
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Posição</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preço Unitário</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedProducts.map((product, index) => (
                    <tr key={product.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          <div className="text-sm text-gray-500">{product.code}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.quantity} {product.unit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(product.unitPrice || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {formatCurrency(product.totalValue || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          product.category === 'general' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {product.category === 'general' ? 'Uso Geral' : 'Insumo Técnico'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'financialStats':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="text-lg font-semibold text-blue-800 mb-3">Mês Atual</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Valor do Estoque:</span>
                    <span className="font-medium text-blue-900">{formatCurrency(financialMetrics.currentMonth.inventoryValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Movimentações:</span>
                    <span className="font-medium text-blue-900">{formatCurrency(financialMetrics.currentMonth.movementsValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Nº Movimentações:</span>
                    <span className="font-medium text-blue-900">{financialMetrics.currentMonth.movementsCount}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Mês Anterior</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Valor do Estoque:</span>
                    <span className="font-medium text-gray-900">{formatCurrency(financialMetrics.previousMonth.inventoryValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Movimentações:</span>
                    <span className="font-medium text-gray-900">{formatCurrency(financialMetrics.previousMonth.movementsValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Nº Movimentações:</span>
                    <span className="font-medium text-gray-900">{financialMetrics.previousMonth.movementsCount}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="text-lg font-semibold text-green-800 mb-3">Variações</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-sm text-green-700">Valor do Estoque</div>
                  <div className={`text-lg font-bold ${getTrendColor(financialMetrics.trends.inventoryValueChangePercent)}`}>
                    {formatCurrency(financialMetrics.trends.inventoryValueChange)}
                  </div>
                  <div className={`text-sm ${getTrendColor(financialMetrics.trends.inventoryValueChangePercent)}`}>
                    {formatPercentage(financialMetrics.trends.inventoryValueChangePercent)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-green-700">Movimentações</div>
                  <div className={`text-lg font-bold ${getTrendColor(financialMetrics.trends.movementsValueChangePercent)}`}>
                    {formatCurrency(financialMetrics.trends.movementsValueChange)}
                  </div>
                  <div className={`text-sm ${getTrendColor(financialMetrics.trends.movementsValueChangePercent)}`}>
                    {formatPercentage(financialMetrics.trends.movementsValueChangePercent)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-green-700">Nº Movimentações</div>
                  <div className={`text-lg font-bold ${getTrendColor(financialMetrics.trends.movementsCountChangePercent)}`}>
                    {financialMetrics.trends.movementsCountChange >= 0 ? '+' : ''}{financialMetrics.trends.movementsCountChange}
                  </div>
                  <div className={`text-sm ${getTrendColor(financialMetrics.trends.movementsCountChangePercent)}`}>
                    {formatPercentage(financialMetrics.trends.movementsCountChangePercent)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'categories':
        const categoryData = [
          {
            name: 'Uso Geral',
            count: dashboardData.categories.general,
            value: dashboardData.categoryValues.general,
            products: products.filter(p => p.category === 'limpeza')
          },
          {
            name: 'Insumos Técnicos',
            count: dashboardData.categories.technical,
            value: dashboardData.categoryValues.technical,
            products: products.filter(p => p.category === 'insumo técnico')
          }
        ];
        
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categoryData.map((category) => (
                <div key={category.name} className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">{category.name}</h4>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Quantidade de Produtos:</span>
                      <span className="font-medium text-gray-900">{category.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Valor Total:</span>
                      <span className="font-medium text-gray-900">{formatCurrency(category.value)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Valor Médio:</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(category.count > 0 ? category.value / category.count : 0)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="max-h-40 overflow-y-auto">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Produtos:</h5>
                    <div className="space-y-1">
                      {category.products.map((product) => (
                        <div key={product.id} className="flex justify-between text-xs">
                          <span className="text-gray-600 truncate">{product.name}</span>
                          <span className="text-gray-800 font-medium ml-2">{formatCurrency(product.totalValue || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'allProducts':
        return (
          <div className="space-y-4">
            <p className="text-gray-600">
              {products.length} produto(s) cadastrado(s) no sistema
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validade</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          <div className="text-sm text-gray-500">{product.code}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          product.category === 'general' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {product.category === 'general' ? 'Uso Geral' : 'Insumo Técnico'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.quantity} {product.unit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          product.status === 'active' ? 'bg-green-100 text-green-800' :
                          product.status === 'low-stock' ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {product.status === 'active' ? 'Ativo' :
                           product.status === 'low-stock' ? 'Estoque Baixo' : 'Vencido'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(product.totalValue || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.expirationDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      default:
        return <div className="text-gray-500">Conteúdo não encontrado</div>;
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Stats Grid Básicos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div 
              key={stat.name} 
              className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedDetail(stat.detailKey)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className={`text-2xl font-bold ${stat.textColor} mt-1`}>{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats Financeiros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {financialStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div 
              key={stat.name} 
              className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedDetail(stat.detailKey)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center space-x-1">
                  {getTrendIcon(stat.change)}
                  <span className={`text-sm font-medium ${getTrendColor(stat.change)}`}>
                    {formatPercentage(stat.change)}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{stat.value}</p>
                <p className={`text-sm mt-1 ${getTrendColor(stat.change)}`}>
                  {stat.change >= 0 ? '+' : ''}{stat.changeValue} vs mês anterior
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories Chart */}
        <div
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setSelectedDetail('categories')}
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Produtos por Categoria</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {Object.entries(dashboardData.allCategories)
              .sort(([, a], [, b]) => b - a)
              .map(([category, count], index) => {
                const colors = [
                  'bg-blue-600',
                  'bg-green-600',
                  'bg-purple-600',
                  'bg-orange-600',
                  'bg-red-600',
                  'bg-indigo-600',
                  'bg-pink-600',
                  'bg-teal-600'
                ];
                const colorClass = colors[index % colors.length];

                return (
                  <div key={category} className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <Package className={`w-4 h-4 mr-2 ${colorClass.replace('bg-', 'text-')}`} />
                      <span className="text-sm text-gray-700 capitalize">{category}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                        <div
                          className={`${colorClass} h-2 rounded-full`}
                          style={{ width: `${dashboardData.totalProducts > 0 ? (count / dashboardData.totalProducts) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <div className="text-right min-w-[80px]">
                        <span className="text-sm font-medium text-gray-600">{count}</span>
                        <p className="text-xs text-gray-500">{formatCurrency(dashboardData.allCategoryValues[category] || 0)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Recent Movements */}
        <div 
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setSelectedDetail('recentMovements')}
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Movimentações Recentes</h3>
          <div className="space-y-3">
            {recentMovements.length > 0 ? (
              recentMovements.map((movement) => (
                <div key={movement.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{movement.productName}</p>
                    <p className="text-xs text-gray-500">
                      {movement.reason === 'sale' && 'Saída'}
                      {movement.reason === 'internal-consumption' && 'Consumo Interno'}
                      {movement.reason === 'internal-transfer' && 'Transferência Interna'}
                      {movement.reason === 'return' && 'Devolução'}
                      {movement.reason === 'other' && 'Outros'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-red-600">-{movement.quantity}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(movement.totalValue || 0)}</p>
                    <p className="text-xs text-gray-400">{movement.date}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">Nenhuma movimentação recente</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Value Products */}
        <div 
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setSelectedDetail('topValue')}
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 text-green-500 mr-2" />
            Produtos de Maior Valor
          </h3>
          <div className="space-y-3">
            {dashboardData.topValueProducts.slice(0, 5).map((product) => (
              <div key={product.id} className="flex items-center justify-between py-2 px-3 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-800">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.code}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-green-600">{formatCurrency(product.totalValue || 0)}</p>
                  <p className="text-xs text-gray-500">{product.quantity} {product.unit}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 && (
          <div 
            className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedDetail('lowStock')}
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 text-orange-500 mr-2" />
              Produtos com Estoque Baixo
            </h3>
            <div className="space-y-3">
              {lowStockProducts.slice(0, 10).map((product) => (
                <div key={product.id} className="flex items-center justify-between py-2 px-3 bg-orange-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-orange-600">{product.quantity} {product.unit}</p>
                    <p className="text-xs text-gray-500">Mín: {product.minStock}</p>
                    <p className="text-xs text-gray-400">{formatCurrency(product.totalValue || 0)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expiring Products */}
        {expiringProducts.length > 0 && (
          <div 
            className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedDetail('expiring')}
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Calendar className="w-5 h-5 text-red-500 mr-2" />
              Produtos Próximos ao Vencimento
            </h3>
            <div className="space-y-3">
              {expiringProducts.map((product) => (
                <div key={product.id} className="flex items-center justify-between py-2 px-3 bg-red-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-red-600">{product.expirationDate}</p>
                    <p className="text-xs text-gray-500">{product.quantity} {product.unit}</p>
                    <p className="text-xs text-gray-400">{formatCurrency(product.totalValue || 0)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Resumo Financeiro */}
      <div 
        className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setSelectedDetail('financialStats')}
      >
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Resumo Financeiro do Mês</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-sm text-gray-600">Valor Total em Estoque</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(financialMetrics.currentMonth.inventoryValue)}</p>
            <div className="flex items-center justify-center mt-1">
              {getTrendIcon(financialMetrics.trends.inventoryValueChangePercent)}
              <span className={`text-sm ml-1 ${getTrendColor(financialMetrics.trends.inventoryValueChangePercent)}`}>
                {formatPercentage(financialMetrics.trends.inventoryValueChangePercent)}
              </span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Movimentações do Mês</p>
            <p className="text-2xl font-bold text-purple-600">{formatCurrency(financialMetrics.currentMonth.movementsValue)}</p>
            <div className="flex items-center justify-center mt-1">
              {getTrendIcon(financialMetrics.trends.movementsValueChangePercent)}
              <span className={`text-sm ml-1 ${getTrendColor(financialMetrics.trends.movementsValueChangePercent)}`}>
                {formatPercentage(financialMetrics.trends.movementsValueChangePercent)}
              </span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Número de Movimentações</p>
            <p className="text-2xl font-bold text-green-600">{financialMetrics.currentMonth.movementsCount}</p>
            <div className="flex items-center justify-center mt-1">
              {getTrendIcon(financialMetrics.trends.movementsCountChangePercent)}
              <span className={`text-sm ml-1 ${getTrendColor(financialMetrics.trends.movementsCountChangePercent)}`}>
                {formatPercentage(financialMetrics.trends.movementsCountChangePercent)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Comparativo de Compras */}
      <PurchaseComparison />
      </div>

      {/* Detail Modal */}
      {selectedDetail && (
        <DetailModal
          title={getModalTitle(selectedDetail)}
          onClose={() => setSelectedDetail(null)}
        >
          {renderModalContent(selectedDetail, dashboardData, financialMetrics, products, movements, formatCurrency)}
        </DetailModal>
      )}
    </>
  );
};

export default Dashboard;