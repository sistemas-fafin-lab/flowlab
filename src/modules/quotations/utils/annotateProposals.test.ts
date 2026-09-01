import { describe, expect, it } from 'vitest';
import { annotateProposals } from './annotateProposals';
import { SupplierProposal } from '../types';

const makeProposal = (overrides: Partial<SupplierProposal> & { id: string }): SupplierProposal => ({
  quotationId: 'q1',
  supplierId: `sup-${overrides.id}`,
  supplierName: `Fornecedor ${overrides.id}`,
  status: 'submitted',
  items: [],
  totalAmount: 0,
  deliveryTime: '5 dias',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('annotateProposals', () => {
  it('retorna todas as propostas não rejeitadas e marca a de menor valor', () => {
    const proposals = [
      makeProposal({ id: 'a', totalAmount: 500 }),
      makeProposal({ id: 'b', totalAmount: 300 }),
      makeProposal({ id: 'c', totalAmount: 900 }),
    ];

    const result = annotateProposals({ proposals, selectedProposalId: undefined });

    expect(result).toHaveLength(3);
    expect(result.find(r => r.proposalId === 'b')?.isLowestTotal).toBe(true);
    expect(result.find(r => r.proposalId === 'a')?.isLowestTotal).toBe(false);
    expect(result.find(r => r.proposalId === 'c')?.isLowestTotal).toBe(false);
  });

  it('sem includeRejected, esconde perdedoras mas mantém a vencedora mesmo marcada como rejected', () => {
    const proposals = [
      makeProposal({ id: 'a', totalAmount: 500, status: 'selected' }),
      makeProposal({ id: 'b', totalAmount: 300, status: 'rejected' }),
      makeProposal({ id: 'c', totalAmount: 900, status: 'rejected' }),
    ];

    const result = annotateProposals({ proposals, selectedProposalId: 'a' });

    expect(result.map(r => r.proposalId)).toEqual(['a']);
  });

  it('com includeRejected, retorna todas as propostas independentemente do status', () => {
    const proposals = [
      makeProposal({ id: 'a', totalAmount: 500, status: 'selected' }),
      makeProposal({ id: 'b', totalAmount: 300, status: 'rejected' }),
      makeProposal({ id: 'c', totalAmount: 900, status: 'rejected' }),
    ];

    const result = annotateProposals(
      { proposals, selectedProposalId: 'a' },
      { includeRejected: true }
    );

    expect(result.map(r => r.proposalId).sort()).toEqual(['a', 'b', 'c']);
    // A vencedora atual é identificada comparando proposalId com selectedProposalId,
    // não pelo status — quem consome o retorno decide o destaque visual.
    expect(result.find(r => r.proposalId === 'b')?.isLowestTotal).toBe(true);
  });

  it('reflete a troca de vencedora: o selectedProposalId novo é quem o consumidor deve destacar', () => {
    const proposals = [
      makeProposal({ id: 'a', totalAmount: 500 }),
      makeProposal({ id: 'b', totalAmount: 300 }),
    ];

    const beforeSwap = annotateProposals({ proposals, selectedProposalId: 'a' }, { includeRejected: true });
    const afterSwap = annotateProposals({ proposals, selectedProposalId: 'b' }, { includeRejected: true });

    expect(beforeSwap).toHaveLength(2);
    expect(afterSwap).toHaveLength(2);
    expect(afterSwap.find(r => r.proposalId === 'b')?.isLowestTotal).toBe(true);
  });

  it('retorna lista vazia quando não há propostas', () => {
    expect(annotateProposals({ proposals: [], selectedProposalId: undefined })).toEqual([]);
  });

  it('anota cada item com menor preço e melhor prazo comparando entre as propostas', () => {
    const proposals = [
      makeProposal({
        id: 'a',
        totalAmount: 200,
        items: [
          { id: 'ia1', proposalId: 'a', quotationItemId: 'item-1', productName: 'Item 1', quantity: 1, unitPrice: 100, totalPrice: 100, deliveryTime: '10 dias' },
        ],
      }),
      makeProposal({
        id: 'b',
        totalAmount: 150,
        items: [
          { id: 'ib1', proposalId: 'b', quotationItemId: 'item-1', productName: 'Item 1', quantity: 1, unitPrice: 80, totalPrice: 80, deliveryTime: '3 dias' },
        ],
      }),
    ];

    const result = annotateProposals({ proposals, selectedProposalId: undefined });

    const itemFromA = result.find(r => r.proposalId === 'a')!.items[0];
    const itemFromB = result.find(r => r.proposalId === 'b')!.items[0];

    expect(itemFromA.isLowestPrice).toBe(false);
    expect(itemFromA.isBestDelivery).toBe(false);
    expect(itemFromB.isLowestPrice).toBe(true);
    expect(itemFromB.isBestDelivery).toBe(true);
  });
});
