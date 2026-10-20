// Comprovante em PDF de um pedido de pagamento (jsPDF), baixado direto pelo navegador.

import jsPDF from 'jspdf';
import type { PaymentRequest } from '../../types';
import {
  formatCurrency,
  formatDateDisplay,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
} from '../../utils/paymentUtils';
import { formatarDataISO } from './domain/filtrosPagamentos';

/** Gera e baixa o comprovante; devolve o nome do arquivo. */
export function gerarPdfPedido(request: PaymentRequest): string {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  const footerHeight = 25;
  const maxContentY = pageHeight - footerHeight - 10;

  // Colors - Navy Blue theme
  const primaryColor: [number, number, number] = [30, 58, 138]; // blue-900
  const secondaryColor: [number, number, number] = [59, 130, 246]; // blue-500
  const lightBg: [number, number, number] = [241, 245, 249]; // slate-100
  const textDark: [number, number, number] = [30, 41, 59]; // slate-800
  const textLight: [number, number, number] = [100, 116, 139]; // slate-500

  // Helper function to check if we need a new page
  const checkNewPage = (neededHeight: number, currentY: number): number => {
    if (currentY + neededHeight > maxContentY) {
      doc.addPage();
      return 20; // Reset Y position for new page
    }
    return currentY;
  };

  // Helper function to add section header
  const addSectionHeader = (title: string, y: number): number => {
    const newY = checkNewPage(15, y);
    doc.setFillColor(...lightBg);
    doc.roundedRect(margin, newY, contentWidth, 8, 2, 2, 'F');
    doc.setTextColor(...primaryColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 5, newY + 5.5);
    return newY + 12;
  };

  // Helper function to add field with dynamic height
  const addField = (label: string, value: string, x: number, y: number, maxWidth: number = 75): number => {
    doc.setTextColor(...textLight);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x, y);

    doc.setTextColor(...textDark);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const lines = doc.splitTextToSize(value || '-', maxWidth);
    doc.text(lines, x, y + 4);
    return lines.length * 4 + 6;
  };

  // ========== HEADER ==========
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setFillColor(...secondaryColor);
  doc.rect(0, 40, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('FLOW LAB', margin + 5, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Gestão de Pagamentos', margin + 5, 28);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(request.codigo, pageWidth - margin - 5, 18, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Emitido: ${formatDateDisplay(new Date())}`, pageWidth - margin - 5, 28, { align: 'right' });

  // ========== TITLE ==========
  let yPos = 52;
  doc.setTextColor(...primaryColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROVANTE DE SOLICITAÇÃO DE PAGAMENTO', pageWidth / 2, yPos, { align: 'center' });

  // Status badge
  yPos += 10;
  const statusText = PAYMENT_STATUS_LABELS[request.status];
  doc.setFontSize(8);
  const statusWidth = doc.getTextWidth(statusText.toUpperCase()) + 12;
  const statusX = (pageWidth - statusWidth) / 2;

  let statusBgColor: [number, number, number];
  let statusTextColor: [number, number, number] = [255, 255, 255];
  switch (request.status) {
    case 'approved': statusBgColor = [34, 197, 94]; break;
    case 'paid': statusBgColor = [59, 130, 246]; break;
    case 'rejected': statusBgColor = [239, 68, 68]; break;
    case 'cancelled': statusBgColor = [107, 114, 128]; break;
    case 'awaiting_authorization': statusBgColor = [124, 58, 237]; break;
    default: statusBgColor = [251, 191, 36]; statusTextColor = [30, 41, 59];
  }

  doc.setFillColor(...statusBgColor);
  doc.roundedRect(statusX, yPos - 5, statusWidth, 8, 2, 2, 'F');
  doc.setTextColor(...statusTextColor);
  doc.setFont('helvetica', 'bold');
  doc.text(statusText.toUpperCase(), pageWidth / 2, yPos, { align: 'center' });

  // ========== DADOS DO PAGAMENTO ==========
  yPos += 12;
  yPos = addSectionHeader('DADOS DO PAGAMENTO', yPos);

  // Row 1
  const col1X = margin + 5;
  const col2X = pageWidth / 2 + 5;
  const colWidth = (contentWidth / 2) - 10;

  addField('Tipo de Solicitação', PAYMENT_TYPE_LABELS[request.tipoSolicitacao] || request.tipoSolicitacao, col1X, yPos, colWidth);
  addField('Nº Documento', request.documentoNumero || 'Não informado', col2X, yPos, colWidth);
  yPos += 14;

  // Row 2
  yPos = checkNewPage(20, yPos);
  addField('Fornecedor/Beneficiário', request.fornecedor, col1X, yPos, colWidth);
  addField('CPF/CNPJ', request.cpfCnpj || 'Não informado', col2X, yPos, colWidth);
  yPos += 14;

  // Row 3 - Valor destacado
  yPos = checkNewPage(25, yPos);
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(margin, yPos - 3, colWidth + 10, 16, 2, 2, 'F');
  doc.setTextColor(...textLight);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Valor Total', col1X, yPos);
  doc.setTextColor(22, 163, 74);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(request.valorTotal), col1X, yPos + 8);

  addField('Forma de Pagamento', PAYMENT_METHOD_LABELS[request.formaPagamento] || request.formaPagamento, col2X, yPos, colWidth);
  yPos += 18;

  // Row 4
  yPos = checkNewPage(20, yPos);
  addField('Data de Pagamento', formatarDataISO(request.dataPagamento), col1X, yPos, colWidth);
  addField('Departamento', request.department || 'Não informado', col2X, yPos, colWidth);
  yPos += 16;

  // ========== DADOS PARA PAGAMENTO ==========
  yPos = addSectionHeader('DADOS PARA PAGAMENTO', yPos);

  const paymentDataLines = doc.splitTextToSize(request.dadosPagamento || 'Não informado', contentWidth - 10);
  const paymentBoxHeight = Math.max(paymentDataLines.length * 4 + 8, 16);

  yPos = checkNewPage(paymentBoxHeight + 5, yPos);
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(...secondaryColor);
  doc.roundedRect(margin, yPos - 2, contentWidth, paymentBoxHeight, 2, 2, 'FD');
  doc.setTextColor(...textDark);
  doc.setFontSize(9);
  doc.setFont('courier', 'normal');
  doc.text(paymentDataLines, margin + 5, yPos + 4);
  yPos += paymentBoxHeight + 8;

  // ========== DESCRIÇÃO DETALHADA ==========
  yPos = addSectionHeader('DESCRIÇÃO DETALHADA', yPos);

  const descLines = doc.splitTextToSize(request.descricaoDetalhada || 'Não informado', contentWidth - 10);
  const descHeight = descLines.length * 4 + 4;

  yPos = checkNewPage(descHeight + 5, yPos);
  doc.setTextColor(...textDark);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(descLines, margin + 5, yPos);
  yPos += descHeight + 10;

  // ========== RESPONSÁVEIS ==========
  yPos = addSectionHeader('RESPONSÁVEIS', yPos);
  yPos = checkNewPage(30, yPos);

  const sigWidth = (contentWidth - 20) / 2;

  // Solicitante
  doc.setTextColor(...textDark);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(request.solicitadoPor || '-', margin + 5 + sigWidth / 2, yPos + 5, { align: 'center' });
  doc.setDrawColor(180, 180, 180);
  doc.line(margin + 5, yPos + 12, margin + 5 + sigWidth, yPos + 12);
  doc.setTextColor(...textLight);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Solicitado por', margin + 5 + sigWidth / 2, yPos + 17, { align: 'center' });

  // Autorizador
  const sig2X = margin + 15 + sigWidth;
  doc.setTextColor(...textDark);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(request.autorizadoPor || '-', sig2X + sigWidth / 2, yPos + 5, { align: 'center' });
  doc.setDrawColor(180, 180, 180);
  doc.line(sig2X, yPos + 12, sig2X + sigWidth, yPos + 12);
  doc.setTextColor(...textLight);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Autorizado por', sig2X + sigWidth / 2, yPos + 17, { align: 'center' });

  // ========== FOOTER (em todas as páginas) ==========
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - footerHeight;

    doc.setFillColor(...primaryColor);
    doc.rect(0, footerY, pageWidth, footerHeight, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Este documento é um comprovante oficial de solicitação de pagamento.', pageWidth / 2, footerY + 8, { align: 'center' });
    doc.text(`Criado em: ${formatDateDisplay(request.createdAt)} | Sistema Flow LAB | Página ${i} de ${totalPages}`, pageWidth / 2, footerY + 14, { align: 'center' });
  }

  // Save PDF
  const fileName = `comprovante-${request.codigo.replace(/[/\s]/g, '-')}.pdf`;
  doc.save(fileName);

  return fileName;
}
