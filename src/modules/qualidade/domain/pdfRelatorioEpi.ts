// PDF do Relatório mensal de EPI de uma área (CONTEXT.md, seção Estoque e Qualidade;
// .scratch/epi-relatorio-mensal/spec.md, "Layout do PDF por área"). Puro: recebe as linhas
// e o cabeçalho e devolve o documento, para testar sem DOM. Segue o padrão dos PDFs do
// Gerador de Orçamento (jspdf + autotable).

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { LinhaRelatorioEpi } from './epiRelatorioMensal.js';

export interface DadosPdfRelatorioEpi {
  area: string;
  /** YYYY-MM */
  mes: string;
  linhas: LinhaRelatorioEpi[];
}

const MARGEM = 12;
const ALTURA_RODAPE = 22;
const corPrimaria: [number, number, number] = [30, 58, 138];
const textoEscuro: [number, number, number] = [30, 41, 59];

/** YYYY-MM-DD → DD/MM/YYYY, sem `new Date` (sem deslocamento de fuso). */
const dataBR = (data: string) => {
  const [ano, mes, dia] = data.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
};

const NOMES_DOS_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** YYYY-MM → "Outubro/2026" */
export const mesPorExtenso = (mes: string) => {
  const [ano, m] = mes.split('-');
  return `${NOMES_DOS_MESES[Number(m) - 1]}/${ano}`;
};

/** "EPIs — <Área> — <Mês por extenso>/<Ano>" */
export const tituloRelatorioEpi = (area: string, mes: string) => `EPIs — ${area} — ${mesPorExtenso(mes)}`;

/** Nome do arquivo baixado: sem acentos nem caracteres que o sistema de arquivos recuse. */
export function nomeArquivoRelatorioEpi(area: string, mes: string): string {
  const slug = area
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `epis-${slug || 'area'}-${mes}.pdf`;
}

/** Relatório mensal de EPI de uma área: A4 horizontal, uma assinatura por linha. */
export function montarPdfRelatorioEpi({ area, mes, linhas }: DadosPdfRelatorioEpi): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();

  doc.setTextColor(...corPrimaria);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(tituloRelatorioEpi(area, mes), largura / 2, MARGEM + 6, { align: 'center' });

  autoTable(doc, {
    startY: MARGEM + 14,
    margin: { left: MARGEM, right: MARGEM, bottom: ALTURA_RODAPE },
    head: [['Data', 'Produto', 'Identificação', 'Qtd.', 'Solicitante', 'Assinatura']],
    body: linhas.map((l) => [dataBR(l.data), l.produto, l.identificacao, String(l.quantidade), l.solicitante, '']),
    styles: { fontSize: 9, cellPadding: 2.5, textColor: textoEscuro, valign: 'middle', lineColor: [203, 213, 225], lineWidth: 0.2 },
    // Altura mínima da linha para caber uma assinatura à mão.
    bodyStyles: { minCellHeight: 11 },
    headStyles: { fillColor: corPrimaria, textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 22 },
      2: { cellWidth: 42 },
      3: { cellWidth: 14 },
      4: { cellWidth: 48 },
      5: { cellWidth: 80 },
    },
    didParseCell: ({ cell, column }) => {
      if (column.index === 3) cell.styles.halign = 'center';
    },
  });

  // Rodapé de todas as páginas, depois da tabela (que pode quebrar página).
  const total = doc.getNumberOfPages();
  const y = altura - 10;
  for (let pagina = 1; pagina <= total; pagina++) {
    doc.setPage(pagina);
    doc.setTextColor(...textoEscuro);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Responsável da área: ________________________________    Data: __/__/____', MARGEM, y);
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text(`Página ${pagina} de ${total}`, largura - MARGEM, y, { align: 'right' });
  }

  return doc;
}
