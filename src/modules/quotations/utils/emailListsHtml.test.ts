import { describe, expect, it } from 'vitest';
import { buildItemsListHtml, buildProposalsListHtml } from './emailListsHtml';
import { formatCurrency } from '../../../utils/paymentUtils';
import { SupplierProposal } from '../types';

const makeProposal = (overrides: Partial<SupplierProposal> & Pick<SupplierProposal, 'id' | 'supplierName' | 'totalAmount'>): SupplierProposal => ({
  quotationId: 'q1',
  supplierId: overrides.id,
  status: 'submitted',
  items: [],
  deliveryTime: '7 dias',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const alfa = makeProposal({ id: 'p1', supplierName: 'Fornecedor Alfa Ltda', totalAmount: 5000 });
const beta = makeProposal({ id: 'p2', supplierName: 'Fornecedor Beta S.A.', totalAmount: 6200, status: 'rejected' });
const gama = makeProposal({ id: 'p3', supplierName: 'Fornecedor Gama ME', totalAmount: 4800, status: 'rejected' });

const winnerLi = (html: string) => html.split('</li>').find((li) => li.includes('VENCEDORA'));

describe('buildProposalsListHtml', () => {
  it('lista todas as propostas, inclusive as rejeitadas pela seleção da vencedora', () => {
    const html = buildProposalsListHtml({ proposals: [alfa, beta, gama], selectedProposalId: 'p1' });

    expect(html).toContain('Fornecedor Alfa Ltda');
    expect(html).toContain('Fornecedor Beta S.A.');
    expect(html).toContain('Fornecedor Gama ME');
    expect(html.match(/<li /g)).toHaveLength(3);
  });

  it('marca só a vencedora atual, com o valor de cada proposta', () => {
    const html = buildProposalsListHtml({ proposals: [alfa, beta], selectedProposalId: 'p1' });

    expect(html).toBe(
      '<li style="margin-bottom:4px;"><strong>Fornecedor Alfa Ltda &mdash; ' + formatCurrency(5000) + '</strong> '
      + '<span style="display:inline-block;padding:1px 8px;font-size:10px;font-weight:700;color:#047857;'
      + 'background-color:#d1fae5;border-radius:9999px;letter-spacing:0.3px;">VENCEDORA</span></li>'
      + '<li style="margin-bottom:4px;">Fornecedor Beta S.A. &mdash; ' + formatCurrency(6200) + '</li>',
    );
  });

  it('destaca uma vencedora que está entre as propostas rejeitadas da lista', () => {
    const html = buildProposalsListHtml({ proposals: [alfa, beta], selectedProposalId: 'p2' });

    expect(html.match(/VENCEDORA/g)).toHaveLength(1);
    expect(winnerLi(html)).toContain('Fornecedor Beta S.A.');
  });

  it('sem vencedora selecionada, nenhuma proposta é destacada', () => {
    const html = buildProposalsListHtml({ proposals: [alfa, beta], selectedProposalId: undefined });

    expect(html).not.toContain('VENCEDORA');
  });

  it('sem propostas, devolve string vazia', () => {
    expect(buildProposalsListHtml({ proposals: [], selectedProposalId: undefined })).toBe('');
  });

  it('escapa HTML no nome do fornecedor', () => {
    const html = buildProposalsListHtml({
      proposals: [makeProposal({ id: 'p1', supplierName: 'Fornecedor & Cia <script>', totalAmount: 5000 })],
      selectedProposalId: undefined,
    });

    expect(html).toContain('Fornecedor &amp; Cia &lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});

describe('buildItemsListHtml', () => {
  it('lista quantidade, unidade e nome de cada item', () => {
    const html = buildItemsListHtml([
      { productName: 'Luva nitrílica M', quantity: 10, unit: 'cx' },
      { productName: 'Máscara N95', quantity: 3, unit: 'un' },
    ]);

    expect(html).toBe('<li>10 cx &mdash; Luva nitrílica M</li><li>3 un &mdash; Máscara N95</li>');
  });

  it('sem itens, devolve string vazia', () => {
    expect(buildItemsListHtml([])).toBe('');
  });

  it('escapa HTML no nome e na unidade do item', () => {
    const html = buildItemsListHtml([{ productName: '<script>alert(1)</script>', quantity: 1, unit: '<b>' }]);

    expect(html).toBe('<li>1 &lt;b&gt; &mdash; &lt;script&gt;alert(1)&lt;/script&gt;</li>');
  });
});
