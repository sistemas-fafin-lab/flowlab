import React, { useState, useMemo } from 'react';
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
  Minus,
  PieChart as PieChartIcon,
  Activity,
  Eye,
  EyeOff,
  LineChart,
  Building2,
  ClipboardList
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import PurchaseComparison from './PurchaseComparison';
import DetailModal from './DetailModal';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area
} from 'recharts';

// Cores para gráficos
const CHART_COLORS = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', 
  '#EF4444', '#6366F1', '#EC4899', '#14B8A6'
];

// Skeleton Component para loading
const SkeletonCard: React.FC = () => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="space-y-3 flex-1">
        <div className="h-4 bg-gray-200 rounded w-24 skeleton"></div>
        <div className="h-8 bg-gray-200 rounded w-16 skeleton"></div>
      </div>
      <div className="w-12 h-12 bg-gray-200 rounded-xl skeleton"></div>
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const { getDashboardData, getFinancialMetrics, products, movements, requests, loading, error } = useInventory();
  const [selectedDetail, setSelectedDetail] = useState<string | null>(null);
  const [showCharts, setShowCharts] = useState<boolean>(true);
  const [movementsPeriod, setMovementsPeriod] = useState<7 | 15 | 30 | 'custom'>(7);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Mover dashboardData e financialMetrics para antes dos hooks
  const dashboardData = !loading && !error ? getDashboardData() : null;
  const financialMetrics = !loading && !error ? getFinancialMetrics() : null;

  // Dados para gráficos - DEVE estar antes de qualquer return condicional
  const chartData = useMemo(() => {
    if (!dashboardData || !products || !movements) {
      return {
        categoryPieData: [],
        categoryValueData: [],
        movementsAreaData: [],
        statusData: []
      };
    }

    // Verificação de segurança para evitar erros
    const allCategories = dashboardData?.allCategories || {};
    const allCategoryValues = dashboardData?.allCategoryValues || {};

    // Dados para gráfico de pizza - Categorias
    const categoryPieData = Object.entries(allCategories).map(([name, count], index) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: count as number,
      color: CHART_COLORS[index % CHART_COLORS.length]
    }));

    // Dados para gráfico de barras - Valor por categoria
    const categoryValueData = Object.entries(allCategoryValues)
      .map(([name, value]) => ({
        name: name.length > 12 ? name.substring(0, 12) + '...' : name,
        fullName: name,
        valor: (value as number) || 0
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6);

    // Dados para gráfico de área - Movimentações por período
    const now = new Date();
    let startDate = new Date();
    
    // Definir período de filtro
    if (movementsPeriod === 'custom' && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
    } else if (typeof movementsPeriod === 'number') {
      startDate.setDate(now.getDate() - movementsPeriod);
    }
    
    const filteredMovements = (movements || []).filter(movement => {
      if (!movement?.date) return false;
      const movDate = new Date(movement.date);
      if (movementsPeriod === 'custom' && customEndDate) {
        return movDate >= startDate && movDate <= new Date(customEndDate);
      }
      return movDate >= startDate;
    });
    
    const movementsByPeriod = filteredMovements.reduce((acc: Record<string, { entradas: number; saidas: number }>, movement) => {
      if (!movement?.date) return acc;
      const date = new Date(movement.date);
      const key = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      
      if (!acc[key]) {
        acc[key] = { entradas: 0, saidas: 0 };
      }
      
      acc[key].saidas += 1; // Conta o número de movimentações, não a quantidade
      return acc;
    }, {});

    const movementsAreaData = Object.entries(movementsByPeriod)
      .sort((a, b) => {
        const [dayA, monthA] = a[0].split('/').map(Number);
        const [dayB, monthB] = b[0].split('/').map(Number);
        return monthA === monthB ? dayA - dayB : monthA - monthB;
      })
      .map(([date, values]) => ({
        date,
        ...values
      }));

    // Dados para indicadores de status
    const statusData = [
      { name: 'Ativos', value: (products || []).filter(p => p.status === 'active').length, color: '#10B981' },
      { name: 'Estoque Baixo', value: (products || []).filter(p => p.status === 'low-stock').length, color: '#F59E0B' },
      { name: 'Vencidos', value: (products || []).filter(p => {
        if (!p?.expirationDate) return false;
        const expDate = new Date(p.expirationDate);
        return expDate < new Date();
      }).length, color: '#EF4444' }
    ].filter(item => item.value > 0);

    // Dados para ranking de solicitações por departamento
    const departmentRanking = (requests || []).reduce((acc: Record<string, { total: number; pending: number; approved: number; rejected: number }>, request) => {
      const dept = request.department || 'Não informado';
      if (!acc[dept]) {
        acc[dept] = { total: 0, pending: 0, approved: 0, rejected: 0 };
      }
      acc[dept].total += 1;
      if (request.status === 'pending') acc[dept].pending += 1;
      else if (request.status === 'approved' || request.status === 'completed') acc[dept].approved += 1;
      else if (request.status === 'rejected') acc[dept].rejected += 1;
      return acc;
    }, {});

    const departmentRankingData = Object.entries(departmentRanking)
      .map(([name, data]) => ({
        name,
        ...data
      }))
      .sort((a, b) => b.total - a.total);

    return {
      categoryPieData,
      categoryValueData,
      movementsAreaData,
      statusData,
      departmentRankingData
    };
  }, [dashboardData, products, movements, requests, movementsPeriod, customStartDate, customEndDate]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-48 h-8 bg-gray-200 rounded skeleton"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 animate-fade-in">
        <div className="flex items-center">
          <AlertTriangle className="w-6 h-6 text-red-500 mr-3" />
          <span className="text-red-700 font-medium">Erro ao carregar dados: {error}</span>
        </div>
      </div>
    );
  }

  if (!dashboardData || !financialMetrics) {
    return null;
  }

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
    if (p.quantity <= 0) return false; // Não exibir produtos sem estoque
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
      allProducts: 'Todos os Produtos',
      departmentRanking: 'Solicitações por Departamento - Controle de Custos'
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
            if (p.quantity <= 0) return false; // Não exibir produtos sem estoque
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
        // Gerar dados de categoria dinamicamente a partir de todas as categorias
        const categoryColors = [
          { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', accent: 'bg-blue-500' },
          { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', accent: 'bg-green-500' },
          { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', accent: 'bg-purple-500' },
          { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', accent: 'bg-orange-500' },
          { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', accent: 'bg-red-500' },
          { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', accent: 'bg-indigo-500' },
          { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', accent: 'bg-pink-500' },
          { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', accent: 'bg-teal-500' }
        ];

        const allCategoryData = Object.entries(dashboardData.allCategories)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .map(([categoryName, count], index) => ({
            name: categoryName,
            count: count as number,
            value: dashboardData.allCategoryValues[categoryName] || 0,
            products: products.filter(p => p.category === categoryName),
            colors: categoryColors[index % categoryColors.length]
          }));
        
        return (
          <div className="space-y-6">
            {/* Resumo Geral */}
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-4 border border-gray-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{allCategoryData.length}</p>
                  <p className="text-xs text-gray-500">Categorias</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{products.length}</p>
                  <p className="text-xs text-gray-500">Total de Produtos</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(dashboardData.totalInventoryValue)}</p>
                  <p className="text-xs text-gray-500">Valor Total</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">{formatCurrency(dashboardData.averageProductValue)}</p>
                  <p className="text-xs text-gray-500">Valor Médio/Produto</p>
                </div>
              </div>
            </div>

            {/* Grid de Categorias */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allCategoryData.map((category) => (
                <div 
                  key={category.name} 
                  className={`${category.colors.bg} ${category.colors.border} border rounded-xl p-4 transition-all duration-200 hover:shadow-md`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${category.colors.accent}`}></div>
                      <h4 className={`text-sm font-semibold ${category.colors.text} capitalize`}>{category.name}</h4>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${category.colors.bg} ${category.colors.text} border ${category.colors.border}`}>
                      {category.count} {category.count === 1 ? 'item' : 'itens'}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">Valor Total:</span>
                      <span className="text-sm font-semibold text-gray-800">{formatCurrency(category.value)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">Valor Médio:</span>
                      <span className="text-sm font-medium text-gray-700">
                        {formatCurrency(category.count > 0 ? category.value / category.count : 0)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Lista de Produtos da Categoria */}
                  {category.products.length > 0 && (
                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <h5 className="text-xs font-medium text-gray-500 mb-2">Produtos:</h5>
                      <div className="max-h-32 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                        {category.products.map((product) => (
                          <div key={product.id} className="flex justify-between items-center text-xs bg-white/50 rounded-lg px-2 py-1.5">
                            <span className="text-gray-700 truncate flex-1 mr-2">{product.name}</span>
                            <span className="text-gray-800 font-medium whitespace-nowrap">{formatCurrency(product.totalValue || 0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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

      case 'departmentRanking':
        return (
          <div className="space-y-4">
            <p className="text-gray-600">
              Análise de solicitações por centro de custo - Total de {requests.length} solicitação(ões) registrada(s)
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">#</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Departamento</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Pendentes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Aprovadas</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Rejeitadas</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Taxa Aprovação</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {chartData.departmentRankingData.map((dept, index) => {
                    const approvalRate = dept.total > 0 ? ((dept.approved / dept.total) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={dept.name} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-slate-700">{index + 1}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="p-2 rounded-lg bg-slate-100 mr-3">
                              <Building2 className="w-4 h-4 text-slate-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-900">{dept.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-bold text-gray-900">{dept.total}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                            {dept.pending}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800">
                            {dept.approved}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-rose-100 text-rose-800">
                            {dept.rejected}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className="bg-emerald-500 h-2 rounded-full transition-all"
                                style={{ width: `${approvalRate}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-700">{approvalRate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
      <div className="space-y-6 animate-fade-in">
        {/* Stats Grid Básicos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div 
              key={stat.name} 
              className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 cursor-pointer hover:shadow-lg hover:border-blue-200 transition-all duration-300 hover-lift card-interactive animate-fade-in-up"
              style={{ animationDelay: `${index * 0.05}s` }}
              onClick={() => setSelectedDetail(stat.detailKey)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                  <p className={`text-3xl font-bold ${stat.textColor} mt-2`}>{stat.value}</p>
                </div>
                <div className={`p-4 rounded-2xl ${stat.color} shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Botão para Toggle dos Gráficos */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
            <LineChart className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800">Gráficos e Indicadores</h2>
        </div>
        <button
          onClick={() => setShowCharts(!showCharts)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 ${
            showCharts 
              ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {showCharts ? (
            <>
              <EyeOff className="w-4 h-4" />
              Ocultar Gráficos
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              Mostrar Gráficos
            </>
          )}
        </button>
      </div>

      {/* Seção de Gráficos Interativos */}
      {showCharts && (
      <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Pizza - Status dos Produtos */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <div className="p-2 rounded-xl bg-emerald-500 shadow-lg mr-3">
                <PieChartIcon className="w-5 h-5 text-white" />
              </div>
              Status do Estoque
            </h3>
          </div>
          <div className="h-48">
            {chartData.statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      borderRadius: '12px', 
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <PieChartIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sem dados de status</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Gráfico de Pizza - Distribuição por Categoria */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <div className="p-2 rounded-xl bg-purple-500 shadow-lg mr-3">
                <Package className="w-5 h-5 text-white" />
              </div>
              Categorias
            </h3>
          </div>
          <div className="h-48">
            {chartData.categoryPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.categoryPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {chartData.categoryPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      borderRadius: '12px', 
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                    formatter={(value: number) => [`${value} produtos`, 'Quantidade']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sem categorias cadastradas</p>
                </div>
              </div>
            )}
          </div>
          {chartData.categoryPieData.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {chartData.categoryPieData.slice(0, 4).map((cat, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }}></div>
                  <span className="text-gray-600 capitalize">{cat.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gráfico de Área - Movimentações */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all duration-300">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <div className="p-2 rounded-xl bg-blue-500 shadow-lg mr-3">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                Movimentações
              </h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setMovementsPeriod(7)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  movementsPeriod === 7
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                7 dias
              </button>
              <button
                onClick={() => setMovementsPeriod(15)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  movementsPeriod === 15
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                15 dias
              </button>
              <button
                onClick={() => setMovementsPeriod(30)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  movementsPeriod === 30
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                30 dias
              </button>
              <button
                onClick={() => setMovementsPeriod('custom')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  movementsPeriod === 'custom'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Personalizado
              </button>
              {movementsPeriod === 'custom' && (
                <div className="flex items-center gap-2 ml-2">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Data inicial"
                  />
                  <span className="text-xs text-gray-500">até</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Data final"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="h-48">
            {chartData.movementsAreaData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.movementsAreaData}>
                  <defs>
                    <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      borderRadius: '12px', 
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="saidas" 
                    stroke="#EF4444" 
                    fillOpacity={1} 
                    fill="url(#colorSaidas)"
                    name="Saídas"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Activity className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sem movimentações recentes</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gráfico de Barras - Valor por Categoria */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all duration-300">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <div className="p-2 rounded-xl bg-indigo-500 shadow-lg mr-3">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            Valor em Estoque por Categoria
          </h3>
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-indigo-50 text-indigo-600">
            Top 6
          </span>
        </div>
        <div className="h-64">
          {chartData.categoryValueData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.categoryValueData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={true} vertical={false} />
                <XAxis 
                  type="number" 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  width={100}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    borderRadius: '12px', 
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Valor']}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                />
                <Bar 
                  dataKey="valor" 
                  fill="#6366F1" 
                  radius={[0, 8, 8, 0]}
                  name="Valor em Estoque"
                >
                  {chartData.categoryValueData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sem dados disponíveis</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Solicitações por Departamento - Controle de Custos */}
      <div 
        className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 cursor-pointer hover:shadow-lg hover:border-slate-300 transition-all duration-300 hover-lift"
        onClick={() => setSelectedDetail('departmentRanking')}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <div className="p-2 rounded-xl bg-slate-700 shadow-lg mr-3">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            Solicitações por Departamento
          </h3>
          <span className="text-xs font-medium px-3 py-1 rounded-full bg-slate-100 text-slate-600">
            {chartData.departmentRankingData.length} centro(s) de custo
          </span>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {chartData.departmentRankingData.length > 0 ? (
            chartData.departmentRankingData.slice(0, 8).map((dept, index) => {
              const maxTotal = chartData.departmentRankingData[0]?.total || 1;
              const percentage = (dept.total / maxTotal) * 100;
              const approvalRate = dept.total > 0 ? ((dept.approved / dept.total) * 100).toFixed(0) : '0';

              return (
                <div key={dept.name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all">
                  <div className="flex items-center flex-1 min-w-0">
                    <span className="w-6 text-sm font-semibold text-slate-500 mr-3">{index + 1}.</span>
                    <div className="p-1.5 rounded-lg bg-white shadow-sm mr-3">
                      <Building2 className="w-4 h-4 text-slate-600" />
                    </div>
                    <span className="text-sm font-medium text-slate-700 truncate">{dept.name}</span>
                  </div>
                  <div className="flex items-center ml-3 gap-3">
                    <div className="w-20 bg-slate-200 rounded-full h-1.5">
                      <div
                        className="bg-slate-600 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center gap-2 min-w-[90px] justify-end">
                      <span className="text-sm font-bold text-slate-700">{dept.total}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">{approvalRate}% aprov.</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-400">
              <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma solicitação registrada</p>
            </div>
          )}
        </div>
        {chartData.departmentRankingData.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="text-slate-500">Total de solicitações:</span>
              <span className="font-bold text-slate-800">{requests.length}</span>
            </div>
            <span className="text-slate-500 text-xs">Clique para análise detalhada →</span>
          </div>
        )}
      </div>
      </>
      )}

      {/* Stats Financeiros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {financialStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div 
              key={stat.name} 
              className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 cursor-pointer hover:shadow-lg hover:border-blue-200 transition-all duration-300 hover-lift card-interactive animate-fade-in-up"
              style={{ animationDelay: `${(index + 4) * 0.05}s` }}
              onClick={() => setSelectedDetail(stat.detailKey)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${stat.color} shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center space-x-1 px-3 py-1 rounded-full bg-gray-50">
                  {getTrendIcon(stat.change)}
                  <span className={`text-sm font-medium ${getTrendColor(stat.change)}`}>
                    {formatPercentage(stat.change)}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{stat.value}</p>
                <p className={`text-sm mt-2 ${getTrendColor(stat.change)}`}>
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
          className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 cursor-pointer hover:shadow-lg hover:border-purple-200 transition-all duration-300 hover-lift"
          onClick={() => setSelectedDetail('categories')}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <div className="p-2 rounded-xl bg-purple-500 shadow-lg mr-3">
                <Package className="w-5 h-5 text-white" />
              </div>
              Produtos por Categoria
            </h3>
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-purple-50 text-purple-600">
              {Object.keys(dashboardData.allCategories).length} categorias
            </span>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {Object.entries(dashboardData.allCategories)
              .sort(([, a], [, b]) => b - a)
              .map(([category, count], index) => {
                const colorStyles = [
                  { bg: 'bg-blue-100', bar: 'bg-blue-500', text: 'text-blue-700', dot: 'bg-blue-500' },
                  { bg: 'bg-green-100', bar: 'bg-green-500', text: 'text-green-700', dot: 'bg-green-500' },
                  { bg: 'bg-purple-100', bar: 'bg-purple-500', text: 'text-purple-700', dot: 'bg-purple-500' },
                  { bg: 'bg-orange-100', bar: 'bg-orange-500', text: 'text-orange-700', dot: 'bg-orange-500' },
                  { bg: 'bg-red-100', bar: 'bg-red-500', text: 'text-red-700', dot: 'bg-red-500' },
                  { bg: 'bg-indigo-100', bar: 'bg-indigo-500', text: 'text-indigo-700', dot: 'bg-indigo-500' },
                  { bg: 'bg-pink-100', bar: 'bg-pink-500', text: 'text-pink-700', dot: 'bg-pink-500' },
                  { bg: 'bg-teal-100', bar: 'bg-teal-500', text: 'text-teal-700', dot: 'bg-teal-500' }
                ];
                const style = colorStyles[index % colorStyles.length];
                const percentage = dashboardData.totalProducts > 0 ? (count / dashboardData.totalProducts) * 100 : 0;

                return (
                  <div key={category} className={`flex items-center justify-between p-2.5 rounded-xl ${style.bg} hover:shadow-sm transition-all`}>
                    <div className="flex items-center flex-1 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full ${style.dot} mr-2.5 flex-shrink-0`}></div>
                      <span className={`text-sm font-medium ${style.text} capitalize truncate`}>{category}</span>
                    </div>
                    <div className="flex items-center ml-3">
                      <div className="w-20 bg-white/60 rounded-full h-1.5 mr-3">
                        <div
                          className={`${style.bar} h-1.5 rounded-full transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="text-right min-w-[70px]">
                        <span className={`text-sm font-bold ${style.text}`}>{count}</span>
                        <p className="text-xs text-gray-600">{formatCurrency(dashboardData.allCategoryValues[category] || 0)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Recent Movements */}
        <div 
          className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 cursor-pointer hover:shadow-lg hover:border-blue-200 transition-all duration-300 hover-lift"
          onClick={() => setSelectedDetail('recentMovements')}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <div className="p-2 rounded-xl bg-blue-500 shadow-lg mr-3">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              Movimentações Recentes
            </h3>
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-blue-50 text-blue-600">
              {recentMovements.length} itens
            </span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {recentMovements.length > 0 ? (
              recentMovements.map((movement) => (
                <div key={movement.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{movement.productName}</p>
                    <p className="text-xs text-gray-500">
                      {movement.reason === 'sale' && 'Saída'}
                      {movement.reason === 'internal-consumption' && 'Consumo Interno'}
                      {movement.reason === 'internal-transfer' && 'Transferência Interna'}
                      {movement.reason === 'return' && 'Devolução'}
                      {movement.reason === 'other' && 'Outros'}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-bold text-red-600">-{movement.quantity}</p>
                    <p className="text-xs font-medium text-gray-600">{formatCurrency(movement.totalValue || 0)}</p>
                    <p className="text-xs text-gray-400">{movement.date}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <TrendingUp className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">Nenhuma movimentação recente</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Value Products */}
        <div 
          className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 cursor-pointer hover:shadow-lg hover:border-green-200 transition-all duration-300 hover-lift"
          onClick={() => setSelectedDetail('topValue')}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <div className="p-2 rounded-xl bg-green-500 shadow-lg mr-3">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              Produtos de Maior Valor
            </h3>
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-green-50 text-green-600">
              Top 5
            </span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {dashboardData.topValueProducts.slice(0, 5).map((product, index) => (
              <div key={product.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl hover:from-green-100 hover:to-emerald-100 transition-colors">
                <div className="flex items-center flex-1 min-w-0">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold mr-3">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.code}</p>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-bold text-green-600">{formatCurrency(product.totalValue || 0)}</p>
                  <p className="text-xs text-gray-500">{product.quantity} {product.unit}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 && (
          <div 
            className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 cursor-pointer hover:shadow-lg hover:border-orange-200 transition-all duration-300 hover-lift"
            onClick={() => setSelectedDetail('lowStock')}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <div className="p-2 rounded-xl bg-orange-500 shadow-lg mr-3">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                Produtos com Estoque Baixo
              </h3>
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-orange-50 text-orange-600">
                {lowStockProducts.length} {lowStockProducts.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {lowStockProducts.slice(0, 10).map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl hover:from-orange-100 hover:to-amber-100 transition-colors">
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-orange-500 mr-3 animate-pulse"></div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.code}</p>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-bold text-orange-600">{product.quantity} {product.unit}</p>
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
            className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 cursor-pointer hover:shadow-lg hover:border-red-200 transition-all duration-300 hover-lift"
            onClick={() => setSelectedDetail('expiring')}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <div className="p-2 rounded-xl bg-red-500 shadow-lg mr-3">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                Produtos Próximos ao Vencimento
              </h3>
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-red-50 text-red-600">
                {expiringProducts.length} {expiringProducts.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {expiringProducts.map((product) => {
                const daysUntilExpiration = Math.ceil(
                  (new Date(product.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                );
                const isExpired = daysUntilExpiration < 0;
                const isCritical = daysUntilExpiration <= 7;
                
                return (
                  <div key={product.id} className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                    isExpired ? 'bg-gradient-to-r from-red-100 to-red-50' : 
                    isCritical ? 'bg-gradient-to-r from-red-50 to-orange-50' : 
                    'bg-gradient-to-r from-orange-50 to-yellow-50'
                  } hover:shadow-sm`}>
                    <div className="flex items-center flex-1 min-w-0">
                      <div className={`w-2 h-2 rounded-full mr-3 ${isExpired || isCritical ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`}></div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.code}</p>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className={`text-sm font-bold ${isExpired ? 'text-red-700' : isCritical ? 'text-red-600' : 'text-orange-600'}`}>
                        {isExpired ? `Vencido há ${Math.abs(daysUntilExpiration)}d` : `${daysUntilExpiration}d restantes`}
                      </p>
                      <p className="text-xs text-gray-500">{product.quantity} {product.unit}</p>
                      <p className="text-xs text-gray-400">{formatCurrency(product.totalValue || 0)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Resumo Financeiro */}
      <div 
        className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-6 border border-blue-100 cursor-pointer hover:shadow-lg transition-all duration-300 hover-lift"
        onClick={() => setSelectedDetail('financialStats')}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <div className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg mr-3">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            Resumo Financeiro do Mês
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-blue-100 text-center hover:bg-white/80 transition-colors">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500 shadow-lg mb-3">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Valor em Estoque</p>
            <p className="text-xl font-bold text-blue-600 mt-1">{formatCurrency(financialMetrics.currentMonth.inventoryValue)}</p>
            <div className="flex items-center justify-center mt-2 px-2 py-1 rounded-full bg-gray-50 w-fit mx-auto">
              {getTrendIcon(financialMetrics.trends.inventoryValueChangePercent)}
              <span className={`text-xs font-medium ml-1 ${getTrendColor(financialMetrics.trends.inventoryValueChangePercent)}`}>
                {formatPercentage(financialMetrics.trends.inventoryValueChangePercent)}
              </span>
            </div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-purple-100 text-center hover:bg-white/80 transition-colors">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500 shadow-lg mb-3">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Movimentações</p>
            <p className="text-xl font-bold text-purple-600 mt-1">{formatCurrency(financialMetrics.currentMonth.movementsValue)}</p>
            <div className="flex items-center justify-center mt-2 px-2 py-1 rounded-full bg-gray-50 w-fit mx-auto">
              {getTrendIcon(financialMetrics.trends.movementsValueChangePercent)}
              <span className={`text-xs font-medium ml-1 ${getTrendColor(financialMetrics.trends.movementsValueChangePercent)}`}>
                {formatPercentage(financialMetrics.trends.movementsValueChangePercent)}
              </span>
            </div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-green-100 text-center hover:bg-white/80 transition-colors">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-green-500 shadow-lg mb-3">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nº Movimentações</p>
            <p className="text-xl font-bold text-green-600 mt-1">{financialMetrics.currentMonth.movementsCount}</p>
            <div className="flex items-center justify-center mt-2 px-2 py-1 rounded-full bg-gray-50 w-fit mx-auto">
              {getTrendIcon(financialMetrics.trends.movementsCountChangePercent)}
              <span className={`text-xs font-medium ml-1 ${getTrendColor(financialMetrics.trends.movementsCountChangePercent)}`}>
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
          icon={
            selectedDetail === 'lowStock' ? <AlertTriangle className="w-5 h-5 text-white" /> :
            selectedDetail === 'expiring' ? <Calendar className="w-5 h-5 text-white" /> :
            selectedDetail === 'recentMovements' ? <TrendingUp className="w-5 h-5 text-white" /> :
            selectedDetail === 'topValue' ? <DollarSign className="w-5 h-5 text-white" /> :
            selectedDetail === 'financialStats' ? <BarChart3 className="w-5 h-5 text-white" /> :
            selectedDetail === 'categories' ? <Package className="w-5 h-5 text-white" /> :
            <Package className="w-5 h-5 text-white" />
          }
          accentColor={
            selectedDetail === 'lowStock' ? 'orange' :
            selectedDetail === 'expiring' ? 'red' :
            selectedDetail === 'recentMovements' ? 'blue' :
            selectedDetail === 'topValue' ? 'green' :
            selectedDetail === 'financialStats' ? 'purple' :
            selectedDetail === 'categories' ? 'purple' :
            'blue'
          }
        >
          {renderModalContent(selectedDetail, dashboardData, financialMetrics, products, movements, formatCurrency)}
        </DetailModal>
      )}
    </>
  );
};

export default Dashboard;