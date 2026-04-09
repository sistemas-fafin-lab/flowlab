import jsPDF from 'jspdf';
import { Quotation } from '../types';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

/**
 * Generates a PDF document for a quotation request that can be sent to suppliers.
 * Includes: header, quotation details, list of items with quantities/specs, space for supplier pricing, and terms.
 */
export function generateQuotationPDF(quotation: Quotation) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const footerHeight = 25;
  const maxContentY = pageHeight - footerHeight - 10;

  // Colors
  const primaryColor: [number, number, number] = [30, 58, 138];
  const secondaryColor: [number, number, number] = [59, 130, 246];
  const lightBg: [number, number, number] = [241, 245, 249];
  const textDark: [number, number, number] = [30, 41, 59];
  const textLight: [number, number, number] = [100, 116, 139];

  const checkNewPage = (neededHeight: number, currentY: number): number => {
    if (currentY + neededHeight > maxContentY) {
      addFooter(doc, pageWidth, pageHeight, margin, quotation.code);
      doc.addPage();
      return 20;
    }
    return currentY;
  };

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
  doc.text('Sistema de Gestão de Cotações', margin + 5, 28);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(quotation.code, pageWidth - margin - 5, 18, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Emitido: ${formatDate(new Date())}`, pageWidth - margin - 5, 28, { align: 'right' });

  // ========== TITLE ==========
  let yPos = 52;
  doc.setTextColor(...primaryColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SOLICITAÇÃO DE COTAÇÃO', pageWidth / 2, yPos, { align: 'center' });

  // ========== QUOTATION DETAILS ==========
  yPos += 12;
  yPos = addSectionHeader('DADOS DA COTAÇÃO', yPos);

  const col1X = margin + 5;
  const col2X = pageWidth / 2 + 5;
  const colWidth = contentWidth / 2 - 10;

  addField('Título', quotation.title, col1X, yPos, colWidth);
  addField('Código', quotation.code, col2X, yPos, colWidth);
  yPos += 14;

  yPos = checkNewPage(20, yPos);
  addField('Departamento', quotation.department, col1X, yPos, colWidth);
  addField('Prioridade', PRIORITY_LABELS[quotation.priority] || quotation.priority, col2X, yPos, colWidth);
  yPos += 14;

  yPos = checkNewPage(20, yPos);
  addField('Criada em', formatDate(quotation.createdAt), col1X, yPos, colWidth);
  addField('Solicitante', quotation.createdByName, col2X, yPos, colWidth);
  yPos += 14;

  if (quotation.responseDeadline || quotation.deliveryDeadline) {
    yPos = checkNewPage(20, yPos);
    if (quotation.responseDeadline) {
      addField('Prazo de Resposta', formatDate(quotation.responseDeadline), col1X, yPos, colWidth);
    }
    if (quotation.deliveryDeadline) {
      addField('Prazo de Entrega', formatDate(quotation.deliveryDeadline), col2X, yPos, colWidth);
    }
    yPos += 14;
  }

  if (quotation.description) {
    yPos = checkNewPage(20, yPos);
    addField('Descrição', quotation.description, col1X, yPos, contentWidth - 10);
    const descLines = doc.splitTextToSize(quotation.description, contentWidth - 10);
    yPos += Math.max(14, descLines.length * 4 + 8);
  }

  if (quotation.justification) {
    yPos = checkNewPage(20, yPos);
    addField('Justificativa', quotation.justification, col1X, yPos, contentWidth - 10);
    const justLines = doc.splitTextToSize(quotation.justification, contentWidth - 10);
    yPos += Math.max(14, justLines.length * 4 + 8);
  }

  // ========== ITEMS TABLE ==========
  yPos += 4;
  yPos = addSectionHeader('ITENS PARA COTAÇÃO', yPos);

  // Table header
  const tableStartX = margin;
  const colWidths = [10, 65, 25, 20, 30, 30];
  const colHeaders = ['#', 'PRODUTO/SERVIÇO', 'QTD', 'UN', 'EST. UNIT.', 'PREÇO UNIT.'];

  yPos = checkNewPage(12, yPos);
  doc.setFillColor(...primaryColor);
  doc.rect(tableStartX, yPos, contentWidth, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');

  let colX = tableStartX + 2;
  colHeaders.forEach((header, i) => {
    doc.text(header, colX, yPos + 5.5);
    colX += colWidths[i];
  });
  yPos += 10;

  // Table rows
  quotation.items.forEach((item, index) => {
    const rowHeight = 14;
    yPos = checkNewPage(rowHeight, yPos);

    // Alternate row background
    if (index % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(tableStartX, yPos - 2, contentWidth, rowHeight, 'F');
    }

    doc.setTextColor(...textDark);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    colX = tableStartX + 2;
    // #
    doc.text(`${index + 1}`, colX, yPos + 3);
    colX += colWidths[0];

    // Product name (with wrapping)
    doc.setFont('helvetica', 'bold');
    const nameLines = doc.splitTextToSize(item.productName, colWidths[1] - 4);
    doc.text(nameLines[0], colX, yPos + 3);
    if (item.productCode) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...textLight);
      doc.text(item.productCode, colX, yPos + 7);
      doc.setTextColor(...textDark);
      doc.setFontSize(8);
    }
    colX += colWidths[1];

    // Quantity
    doc.setFont('helvetica', 'bold');
    doc.text(`${item.quantity}`, colX, yPos + 3);
    colX += colWidths[2];

    // Unit
    doc.setFont('helvetica', 'normal');
    doc.text(item.unit, colX, yPos + 3);
    colX += colWidths[3];

    // Estimated price
    doc.setFont('helvetica', 'normal');
    doc.text(
      item.estimatedUnitPrice ? formatCurrency(item.estimatedUnitPrice) : '-',
      colX,
      yPos + 3
    );
    colX += colWidths[4];

    // Price field (blank for supplier to fill)
    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([2, 1], 0);
    doc.rect(colX - 1, yPos - 1, colWidths[5] - 2, 10);
    doc.setLineDashPattern([], 0);
    doc.setTextColor(...textLight);
    doc.setFontSize(6);
    doc.text('R$ ___________', colX, yPos + 4);

    yPos += rowHeight;
  });

  // Total line
  yPos += 4;
  yPos = checkNewPage(16, yPos);
  doc.setFillColor(...lightBg);
  doc.roundedRect(margin, yPos, contentWidth, 12, 2, 2, 'F');
  doc.setTextColor(...primaryColor);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR ESTIMADO TOTAL:', margin + 5, yPos + 7.5);
  doc.text(formatCurrency(quotation.estimatedTotalAmount), margin + contentWidth - 5, yPos + 7.5, { align: 'right' });

  yPos += 18;
  yPos = checkNewPage(16, yPos);
  doc.setDrawColor(180, 180, 180);
  doc.setLineDashPattern([2, 1], 0);
  doc.roundedRect(margin, yPos, contentWidth, 12, 2, 2, 'S');
  doc.setLineDashPattern([], 0);
  doc.setTextColor(...textDark);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR TOTAL DA PROPOSTA:', margin + 5, yPos + 7.5);
  doc.setTextColor(...textLight);
  doc.setFontSize(8);
  doc.text('R$ ___________________________', margin + contentWidth - 5, yPos + 7.5, { align: 'right' });

  // ========== SUPPLIER RESPONSE AREA ==========
  yPos += 20;
  yPos = addSectionHeader('DADOS DO FORNECEDOR', yPos);

  yPos = checkNewPage(40, yPos);
  const fieldSpacing = 12;
  const supplierFields = [
    'Razão Social: _______________________________________________',
    'CNPJ/CPF: __________________________________________________',
    'Contato: ____________________________________________________',
    'Condições de pagamento: _____________________________________',
    'Prazo de entrega: ___________________________________________',
    'Validade da proposta: _______________________________________',
  ];

  doc.setTextColor(...textDark);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  supplierFields.forEach((field) => {
    yPos = checkNewPage(fieldSpacing, yPos);
    doc.text(field, col1X, yPos);
    yPos += fieldSpacing;
  });

  // ========== TERMS ==========
  yPos += 4;
  yPos = addSectionHeader('OBSERVAÇÕES', yPos);

  yPos = checkNewPage(30, yPos);
  doc.setTextColor(...textLight);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  const terms = [
    '1. Os preços devem ser apresentados em Reais (R$), incluindo todos os impostos e frete.',
    '2. A proposta deve ser devolvida preenchida no prazo indicado acima.',
    '3. Itens não cotados devem ser indicados com "N/A" no campo de preço.',
    '4. A empresa reserva-se o direito de aceitar ou rejeitar qualquer proposta.',
    `5. Dúvidas ou esclarecimentos, entrar em contato com ${quotation.createdByName}.`,
  ];

  terms.forEach((term) => {
    yPos = checkNewPage(6, yPos);
    doc.text(term, col1X, yPos);
    yPos += 5;
  });

  // ========== SIGNATURE ==========
  yPos += 10;
  yPos = checkNewPage(25, yPos);
  doc.setDrawColor(...textLight);
  doc.line(margin + 10, yPos, margin + contentWidth / 2 - 10, yPos);
  doc.line(margin + contentWidth / 2 + 10, yPos, margin + contentWidth - 10, yPos);

  doc.setTextColor(...textDark);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Assinatura do Fornecedor', margin + contentWidth / 4, yPos + 5, { align: 'center' });
  doc.text('Data', margin + (contentWidth * 3) / 4, yPos + 5, { align: 'center' });

  // Footer on last page
  addFooter(doc, pageWidth, pageHeight, margin, quotation.code);

  // Save
  doc.save(`Cotacao_${quotation.code}_${formatDate(new Date()).replace(/\//g, '-')}.pdf`);
}

function addFooter(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  code: string
) {
  const footerY = pageHeight - 15;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Flow Lab • Solicitação de Cotação ${code}`, margin, footerY);
  doc.text(
    `Página ${doc.getCurrentPageInfo().pageNumber}`,
    pageWidth - margin,
    footerY,
    { align: 'right' }
  );
}
