import { SupplierProposal, SupplierComparisonData } from '../types';

export interface AnnotateProposalsOptions {
  // Por padrão, propostas perdedoras (status 'rejected' via seleção de
  // vencedora) somem da lista — comportamento da tabela de comparação. O
  // modal de aprovação precisa de todas, vencedora incluída, daí a opção.
  includeRejected?: boolean;
}

type ProposalsSource = {
  proposals: SupplierProposal[];
  selectedProposalId?: string;
};

/**
 * Anota as propostas de uma cotação com menor preço/melhor prazo (por item e
 * no total) e destaques daí derivados. Usada tanto pela tabela de comparação
 * quanto pelo modal-resumo de aprovação, para não duplicar a regra de
 * "quem venceu" em dois lugares.
 */
export const annotateProposals = (
  quotation: ProposalsSource,
  options: AnnotateProposalsOptions = {}
): SupplierComparisonData[] => {
  const { includeRejected = false } = options;

  const proposals = includeRejected
    ? quotation.proposals
    : quotation.proposals.filter(p => p.status !== 'rejected' || p.id === quotation.selectedProposalId);

  if (proposals.length === 0) return [];

  const totals = proposals.map(p => p.totalAmount);
  const lowestTotal = Math.min(...totals);
  const highestTotal = Math.max(...totals);

  const deliveryDays = proposals.map(p => {
    const match = p.deliveryTime?.match(/(\d+)/);
    return match ? parseInt(match[1]) : Infinity;
  });
  const bestDelivery = Math.min(...deliveryDays);

  return proposals.map((proposal) => {
    const deliveryMatch = proposal.deliveryTime?.match(/(\d+)/);
    const deliveryDaysNum = deliveryMatch ? parseInt(deliveryMatch[1]) : Infinity;

    const isLowestTotal = proposal.totalAmount === lowestTotal;
    const isBestDelivery = deliveryDaysNum === bestDelivery;
    const savingsVsHighest = highestTotal - proposal.totalAmount;
    const savingsPercentage = highestTotal > 0
      ? ((highestTotal - proposal.totalAmount) / highestTotal) * 100
      : 0;

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
};
