import React, { useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, Download, CheckCircle, FileText, Building2, Package, Calendar, CreditCard } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quotation, PaymentMethodLabels } from '../types';

interface PurchaseOrderModalProps {
  isOpen: boolean;
  quotation: Quotation;
  purchaseOrderCode: string;
  onClose: () => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
};

export const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({
  isOpen,
  quotation,
  purchaseOrderCode,
  onClose,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const winnerProposal = quotation.proposals.find(p => p.id === quotation.selectedProposalId);
  const issueDate = quotation.convertedAt || new Date().toISOString();

  const generatePDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 15;

    // ── Header ──
    doc.setFillColor(37, 99, 235); // blue-600
    doc.rect(0, 0, pageW, 38, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('ORDEM DE COMPRA', margin, 16);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nº ${purchaseOrderCode}`, margin, 24);
    doc.text(`Emissão: ${formatDate(issueDate)}`, margin, 31);

    // ── Quotation info ──
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DA COTAÇÃO', margin, 48);
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, 50, pageW - margin, 50);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const infoY = 56;
    const col2 = pageW / 2 + 5;

    doc.setFont('helvetica', 'bold');
    doc.text('Cotação:', margin, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${quotation.code} — ${quotation.title}`, margin + 22, infoY);

    doc.setFont('helvetica', 'bold');
    doc.text('Departamento:', margin, infoY + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(quotation.department || '—', margin + 30, infoY + 7);

    doc.setFont('helvetica', 'bold');
    doc.text('Justificativa:', margin, infoY + 14);
    doc.setFont('helvetica', 'normal');
    const justLines = doc.splitTextToSize(quotation.justification || '—', pageW / 2 - margin - 5);
    doc.text(justLines, margin + 28, infoY + 14);

    // ── Supplier info ──
    doc.setFont('helvetica', 'bold');
    doc.text('FORNECEDOR VENCEDOR', col2, 48);
    doc.line(col2, 50, pageW - margin, 50);
    doc.setFont('helvetica', 'normal');
    doc.text(quotation.selectedSupplierName || '—', col2, infoY);

    if (winnerProposal) {
      const pm = winnerProposal.paymentMethod;
      const pmLabel = pm ? PaymentMethodLabels[pm] : winnerProposal.paymentTerms || '—';
      doc.setFont('helvetica', 'bold');
      doc.text('Pagamento:', col2, infoY + 7);
      doc.setFont('helvetica', 'normal');
      const paymentText = pm === 'boleto' && winnerProposal.boletoDueDays
        ? `${pmLabel} — ${winnerProposal.boletoDueDays} dias`
        : pmLabel;
      doc.text(paymentText, col2 + 22, infoY + 7);

      doc.setFont('helvetica', 'bold');
      doc.text('Prazo entrega:', col2, infoY + 14);
      doc.setFont('helvetica', 'normal');
      doc.text(winnerProposal.deliveryTime || '—', col2 + 28, infoY + 14);

      if (winnerProposal.validUntil) {
        doc.setFont('helvetica', 'bold');
        doc.text('Válido até:', col2, infoY + 21);
        doc.setFont('helvetica', 'normal');
        doc.text(formatDate(winnerProposal.validUntil), col2 + 22, infoY + 21);
      }
    }

    // ── Items table ──
    const tableStartY = infoY + 30;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('ITENS DA ORDEM', margin, tableStartY);
    doc.line(margin, tableStartY + 2, pageW - margin, tableStartY + 2);

    const proposalItems = winnerProposal?.items || [];
    const tableRows = quotation.items.map(item => {
      const pi = proposalItems.find(p => p.quotationItemId === item.id);
      const unitPrice = pi?.unitPrice ?? 0;
      const total = unitPrice * item.quantity;
      return [
        item.productName,
        item.productCode || '—',
        `${item.quantity} ${item.unit}`,
        formatCurrency(unitPrice),
        formatCurrency(total),
      ];
    });

    autoTable(doc, {
      startY: tableStartY + 5,
      head: [['Item', 'Código', 'Qtd.', 'Preço Un.', 'Total']],
      body: tableRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 255] },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 28 },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' },
      },
    });

    // ── Additional costs & total ──
    const afterTableY = (doc as any).lastAutoTable.finalY + 6;
    let summaryY = afterTableY;

    if (winnerProposal?.additionalCosts?.length) {
      winnerProposal.additionalCosts.forEach(cost => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.text(cost.label, pageW - margin - 60, summaryY, { align: 'left' });
        doc.text(formatCurrency(cost.value), pageW - margin, summaryY, { align: 'right' });
        summaryY += 6;
      });
    }

    doc.setFillColor(37, 99, 235);
    doc.roundedRect(pageW - margin - 65, summaryY - 1, 65, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL', pageW - margin - 60, summaryY + 6.5, { align: 'left' });
    doc.text(formatCurrency(quotation.finalTotalAmount || 0), pageW - margin - 2, summaryY + 6.5, { align: 'right' });
    doc.setTextColor(30, 30, 30);

    // ── Notes ──
    if (winnerProposal?.notes) {
      const notesY = summaryY + 18;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('Observações:', margin, notesY);
      doc.setFont('helvetica', 'normal');
      const notesLines = doc.splitTextToSize(winnerProposal.notes, pageW - margin * 2);
      doc.text(notesLines, margin, notesY + 5);
    }

    // ── Signature area ──
    const sigY = doc.internal.pageSize.getHeight() - 50;
    doc.setDrawColor(150, 150, 150);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(margin, sigY, margin + 70, sigY);
    doc.line(pageW / 2 + 5, sigY, pageW / 2 + 75, sigY);
    doc.setLineDashPattern([], 0);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Solicitante / Autorizado por', margin, sigY + 5);
    doc.text('Fornecedor / Confirmação', pageW / 2 + 5, sigY + 5);
    doc.text(`Data: ___/___/______`, margin, sigY + 12);
    doc.text(`Data: ___/___/______`, pageW / 2 + 5, sigY + 12);

    // ── Footer ──
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Documento gerado automaticamente em ${new Date().toLocaleString('pt-BR')} · ${purchaseOrderCode}`,
      pageW / 2, footerY, { align: 'center' }
    );

    doc.save(`${purchaseOrderCode}.pdf`);
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[70]">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-emerald-600 to-emerald-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Pedido Gerado com Sucesso!</h2>
              <p className="text-emerald-100 text-xs mt-0.5">{purchaseOrderCode}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div ref={contentRef} className="p-6 space-y-5">
          {/* Quotation info */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Cotação</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {quotation.code} — {quotation.title}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Fornecedor Vencedor</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {quotation.selectedSupplierName || '—'}
                </p>
              </div>
            </div>
            {winnerProposal?.paymentMethod && (
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Forma de Pagamento</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {PaymentMethodLabels[winnerProposal.paymentMethod]}
                    {winnerProposal.paymentMethod === 'boleto' && winnerProposal.boletoDueDays
                      ? ` — ${winnerProposal.boletoDueDays} dias`
                      : ''}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Prazo de Entrega</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {winnerProposal?.deliveryTime || '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Items preview */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Itens da Ordem
            </p>
            <div className="space-y-1.5">
              {quotation.items.map(item => {
                const pi = winnerProposal?.items.find(p => p.quotationItemId === item.id);
                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{item.productName}</span>
                      <span className="text-xs text-slate-400 flex-shrink-0">{item.quantity} {item.unit}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex-shrink-0">
                      {pi ? formatCurrency(pi.unitPrice * item.quantity) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3">
            <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Valor Total da Ordem</span>
            <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {formatCurrency(quotation.finalTotalAmount || 0)}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={generatePDF}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Baixar PDF da Ordem de Compra
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-slate-600 dark:text-slate-400 font-medium text-sm rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PurchaseOrderModal;
