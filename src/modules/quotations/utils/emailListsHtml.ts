import { QuotationItem } from '../types';
import { formatCurrency } from '../../../utils/paymentUtils';
import { escapeHtml } from './escapeHtml';
import { annotateProposals, AnnotateProposalsOptions } from './annotateProposals';

/**
 * Listas em HTML (`<li>`, sem o `<ul>`) usadas nas variáveis dos templates de
 * email de cotações. Hoje usadas pelo email de submissão; ficam aqui (e não
 * privadas a uma notificação) para que os emails da etapa do gestor, de
 * rejeição e o resumo diário montem exatamente a mesma lista.
 */

export const buildItemsListHtml = (items: Pick<QuotationItem, 'productName' | 'quantity' | 'unit'>[]): string =>
  items
    .map((item) => `<li>${escapeHtml(String(item.quantity))} ${escapeHtml(item.unit)} &mdash; ${escapeHtml(item.productName)}</li>`)
    .join('');

/**
 * Lista todas as propostas recebidas, destacando a vencedora atual — reaproveita
 * annotateProposals (mesma regra usada no modal de aprovação) em vez de duplicar
 * "quem venceu".
 */
export const buildProposalsListHtml = (quotation: Parameters<typeof annotateProposals>[0], options?: AnnotateProposalsOptions): string =>
  annotateProposals(quotation, { includeRejected: true, ...options })
    .map((proposal) => {
      const isWinner = proposal.proposalId === quotation.selectedProposalId;
      const label = `${escapeHtml(proposal.supplierName)} &mdash; ${formatCurrency(proposal.totalAmount)}`;
      return isWinner
        ? `<li style="margin-bottom:4px;"><strong>${label}</strong> `
          + '<span style="display:inline-block;padding:1px 8px;font-size:10px;font-weight:700;color:#047857;'
          + 'background-color:#d1fae5;border-radius:9999px;letter-spacing:0.3px;">VENCEDORA</span></li>'
        : `<li style="margin-bottom:4px;">${label}</li>`;
    })
    .join('');
