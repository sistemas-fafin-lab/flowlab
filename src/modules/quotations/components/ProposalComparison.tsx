import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Award,
  Building2,
  Check,
  Clock,
  Crown,
  Filter,
  SortAsc,
  SortDesc,
  Star,
  TrendingDown,
} from 'lucide-react';
import { Quotation, SupplierProposal, SupplierComparisonData } from '../types';

interface ProposalComparisonProps {
  quotation: Quotation;
  onSelectWinner?: (proposalId: string) => void;
  canSelect?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatPercentage = (value: number) => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
};

type SortField = 'totalAmount' | 'deliveryTime' | 'supplierName';
type SortOrder = 'asc' | 'desc';

export const ProposalComparison: React.FC<ProposalComparisonProps> = ({
  quotation,
  onSelectWinner,
  canSelect = false,
}) => {
  const [sortField, setSortField] = useState<SortField>('totalAmount');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string | null>(null);

  // Calculate comparison data
  const comparisonData = useMemo((): SupplierComparisonData[] => {
    const proposals = quotation.proposals.filter(p => p.status !== 'rejected' || p.id === quotation.selectedProposalId);
    
    if (proposals.length === 0) return [];

    // Find lowest and highest totals
    const totals = proposals.map(p => p.totalAmount);
    const lowestTotal = Math.min(...totals);
    const highestTotal = Math.max(...totals);

    // Find best delivery times
    const deliveryDays = proposals.map(p => {
      const match = p.deliveryTime?.match(/(\d+)/);
      return match ? parseInt(match[1]) : Infinity;
    });
    const bestDelivery = Math.min(...deliveryDays);

    return proposals.map((proposal, index) => {
      const deliveryMatch = proposal.deliveryTime?.match(/(\d+)/);
      const deliveryDaysNum = deliveryMatch ? parseInt(deliveryMatch[1]) : Infinity;

      const isLowestTotal = proposal.totalAmount === lowestTotal;
      const isBestDelivery = deliveryDaysNum === bestDelivery;
      const savingsVsHighest = highestTotal - proposal.totalAmount;
      const savingsPercentage = highestTotal > 0 
        ? ((highestTotal - proposal.totalAmount) / highestTotal) * 100 
        : 0;

      // Check per-item lowest prices
      const items = proposal.items.map(item => {
        const allPricesForItem = proposals
          .flatMap(p => p.items.filter(i => i.quotationItemId === item.quotationItemId))
          .map(i => i.unitPrice);
        const lowestPrice = Math.min(...allPricesForItem);
        
        const allDeliveriesForItem = proposals
          .flatMap(p => p.items.filter(i => i.quotationItemId === item.quotationItemId))
          .map(i => {
            const match = i.deliveryTime?.match(/(\d+)/);
            return match ? parseInt(match[1]) : Infinity;
          });
        const bestItemDelivery = Math.min(...allDeliveriesForItem);
        const itemDeliveryMatch = item.deliveryTime?.match(/(\d+)/);
        const itemDeliveryDays = itemDeliveryMatch ? parseInt(itemDeliveryMatch[1]) : Infinity;

        return {
          itemId: item.quotationItemId,
          itemName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          deliveryTime: item.deliveryTime,
          isLowestPrice: item.unitPrice === lowestPrice,
          isBestDelivery: itemDeliveryDays === bestItemDelivery,
        };
      });

      return {
        supplierId: proposal.supplierId,
        supplierName: proposal.supplierName,
        proposalId: proposal.id,
        items,
        totalAmount: proposal.totalAmount,
        deliveryTime: proposal.deliveryTime,
        paymentTerms: proposal.paymentTerms,
        isLowestTotal,
        isBestOverall: isLowestTotal && isBestDelivery,
        savingsVsHighest,
        savingsPercentage,
      };
    });
  }, [quotation]);

  // Sort data
  const sortedData = useMemo(() => {
    let data = [...comparisonData];

    if (selectedSupplierFilter) {
      data = data.filter(d => d.supplierId === selectedSupplierFilter);
    }

    data.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'totalAmount':
          comparison = a.totalAmount - b.totalAmount;
          break;
        case 'deliveryTime':
          const aDays = parseInt(a.deliveryTime?.match(/(\d+)/)?.[1] || '999');
          const bDays = parseInt(b.deliveryTime?.match(/(\d+)/)?.[1] || '999');
          comparison = aDays - bDays;
          break;
        case 'supplierName':
          comparison = a.supplierName.localeCompare(b.supplierName);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return data;
  }, [comparisonData, sortField, sortOrder, selectedSupplierFilter]);

  // Stats summary
  const stats = useMemo(() => {
    if (comparisonData.length === 0) return null;

    const lowestTotal = Math.min(...comparisonData.map(d => d.totalAmount));
    const highestTotal = Math.max(...comparisonData.map(d => d.totalAmount));
    const avgTotal = comparisonData.reduce((sum, d) => sum + d.totalAmount, 0) / comparisonData.length;
    const potentialSavings = highestTotal - lowestTotal;
    const savingsPercentage = highestTotal > 0 ? (potentialSavings / highestTotal) * 100 : 0;

    return {
      lowestTotal,
      highestTotal,
      avgTotal,
      potentialSavings,
      savingsPercentage,
      proposalCount: comparisonData.length,
    };
  }, [comparisonData]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  if (quotation.proposals.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma proposta recebida</h3>
        <p className="text-gray-500">
          As propostas dos fornecedores aparecerão aqui quando forem enviadas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      {stats && (
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-2xl border border-gray-200 p-4 sm:p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Propostas</p>
              <p className="text-2xl font-bold text-gray-900">{stats.proposalCount}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Menor Valor</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(stats.lowestTotal)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Maior Valor</p>
              <p className="text-xl sm:text-2xl font-bold text-red-600">{formatCurrency(stats.highestTotal)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Economia Potencial</p>
              <div className="flex items-center justify-center gap-1">
                <TrendingDown className="w-4 h-4 text-green-600" />
                <p className="text-xl sm:text-2xl font-bold text-green-600">
                  {stats.savingsPercentage.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Sort */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={selectedSupplierFilter || ''}
            onChange={(e) => setSelectedSupplierFilter(e.target.value || null)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Todos os fornecedores</option>
            {comparisonData.map(d => (
              <option key={d.supplierId} value={d.supplierId}>
                {d.supplierName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Ordenar por:</span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {[
              { field: 'totalAmount' as SortField, label: 'Preço' },
              { field: 'deliveryTime' as SortField, label: 'Prazo' },
              { field: 'supplierName' as SortField, label: 'Nome' },
            ].map(({ field, label }) => (
              <button
                key={field}
                onClick={() => toggleSort(field)}
                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 ${
                  sortField === field
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label}
                {sortField === field && (
                  sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Fornecedor
                </th>
                {quotation.items.map(item => (
                  <th
                    key={item.id}
                    className="px-4 sm:px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider"
                  >
                    <div className="truncate max-w-[120px]" title={item.productName}>
                      {item.productName}
                    </div>
                    <div className="text-gray-400 font-normal">
                      {item.quantity} {item.unit}
                    </div>
                  </th>
                ))}
                <th className="px-4 sm:px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-4 sm:px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Prazo
                </th>
                {canSelect && (
                  <th className="px-4 sm:px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ação
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedData.map((supplier, index) => {
                const isSelected = supplier.proposalId === quotation.selectedProposalId;
                
                return (
                  <tr
                    key={supplier.proposalId}
                    className={`${
                      isSelected
                        ? 'bg-green-50'
                        : supplier.isBestOverall
                        ? 'bg-blue-50'
                        : 'bg-white hover:bg-gray-50'
                    } transition-colors`}
                  >
                    {/* Supplier */}
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-medium text-gray-900">
                              {supplier.supplierName}
                            </span>
                            {isSelected && (
                              <span className="px-1.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded">
                                Selecionado
                              </span>
                            )}
                            {supplier.isBestOverall && !isSelected && (
                              <Crown className="w-4 h-4 text-amber-500" />
                            )}
                          </div>
                          {supplier.paymentTerms && (
                            <p className="text-xs text-gray-500">{supplier.paymentTerms}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Item Prices */}
                    {quotation.items.map(item => {
                      const proposalItem = supplier.items.find(i => i.itemId === item.id);
                      
                      return (
                        <td key={item.id} className="px-4 sm:px-6 py-4 text-center">
                          {proposalItem ? (
                            <div>
                              <div className="flex items-center justify-center gap-1">
                                <span className={`text-sm font-medium ${
                                  proposalItem.isLowestPrice ? 'text-green-600' : 'text-gray-900'
                                }`}>
                                  {formatCurrency(proposalItem.unitPrice)}
                                </span>
                                {proposalItem.isLowestPrice && (
                                  <Star className="w-3 h-3 text-green-500 fill-current" />
                                )}
                              </div>
                              {proposalItem.deliveryTime && (
                                <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mt-0.5">
                                  <Clock className="w-3 h-3" />
                                  {proposalItem.deliveryTime}
                                  {proposalItem.isBestDelivery && (
                                    <Award className="w-3 h-3 text-blue-500" />
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Total */}
                    <td className="px-4 sm:px-6 py-4 text-center">
                      <div className={`text-sm font-bold ${
                        supplier.isLowestTotal ? 'text-green-600' : 'text-gray-900'
                      }`}>
                        {formatCurrency(supplier.totalAmount)}
                      </div>
                      {supplier.savingsVsHighest > 0 && (
                        <div className="flex items-center justify-center gap-1 text-xs text-green-600 mt-0.5">
                          <ArrowDown className="w-3 h-3" />
                          {formatCurrency(supplier.savingsVsHighest)}
                        </div>
                      )}
                    </td>

                    {/* Delivery */}
                    <td className="px-4 sm:px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">
                          {supplier.deliveryTime || '-'}
                        </span>
                      </div>
                    </td>

                    {/* Action */}
                    {canSelect && (
                      <td className="px-4 sm:px-6 py-4 text-center">
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            <Check className="w-3 h-3" />
                            Selecionado
                          </span>
                        ) : (
                          <button
                            onClick={() => onSelectWinner?.(supplier.proposalId)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Check className="w-3 h-3" />
                            Selecionar
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Star className="w-3 h-3 text-green-500 fill-current" />
          <span>Menor preço do item</span>
        </div>
        <div className="flex items-center gap-1">
          <Award className="w-3 h-3 text-blue-500" />
          <span>Melhor prazo do item</span>
        </div>
        <div className="flex items-center gap-1">
          <Crown className="w-4 h-4 text-amber-500" />
          <span>Melhor proposta geral</span>
        </div>
      </div>
    </div>
  );
};

export default ProposalComparison;
