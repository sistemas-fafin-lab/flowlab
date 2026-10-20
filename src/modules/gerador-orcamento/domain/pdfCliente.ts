// PDF do Orçamento para o cliente. Puro (recebe os dados, devolve o documento), para
// testar sem DOM. Portado de buildClientPdf (Tabela-Particular/lib/alvaro-orcamento/pdf.ts)
// com o mesmo conteúdo; cabeçalho, cores e rodapé no padrão de
// src/modules/quotations/utils/generateQuotationPDF.ts.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ItemCarrinho } from '../types';
import type { ResultadoOrcamento } from './orcamento';

export interface DadosPdfOrcamentoCliente {
  carrinho: readonly ItemCarrinho[];
  /** O mesmo resultado que a tela mostra no resumo. */
  orcamento: ResultadoOrcamento;
  emitidoEm: Date;
}

// Identidade do laboratório no cabeçalho, como no PDF da Tabela-Particular.
const LABORATORIO = {
  nome: 'Laboratório Lab',
  endereco: 'SHLS 716 BLOCO E, CENTRO MÉDICO BRASILIA, ASA SUL',
  email: 'lab@laboratoriolab.com.br',
};

const MARGEM = 15;
const ALTURA_RODAPE = 25;

const corPrimaria: [number, number, number] = [30, 58, 138];
const corSecundaria: [number, number, number] = [59, 130, 246];
const fundoClaro: [number, number, number] = [241, 245, 249];
const textoEscuro: [number, number, number] = [30, 41, 59];

const numBR = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dataBR = (data: Date) => data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Faixa do topo com o logo (PNG em data URL, quadrado) e os dados do laboratório. */
function desenharCabecalho(doc: jsPDF, logo: string | null, emitidoEm: Date) {
  const largura = doc.internal.pageSize.getWidth();

  doc.setFillColor(...corPrimaria);
  doc.rect(0, 0, largura, 40, 'F');
  doc.setFillColor(...corSecundaria);
  doc.rect(0, 40, largura, 2, 'F');

  // Sem logo (falhou ao carregar), o texto ocupa o lugar dele.
  const xTexto = logo ? MARGEM + 30 : MARGEM + 5;
  if (logo) doc.addImage(logo, 'PNG', MARGEM, 8, 24, 24, undefined, 'FAST');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(LABORATORIO.nome, xTexto, 18);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(LABORATORIO.endereco, xTexto, 26);
  doc.text(LABORATORIO.email, xTexto, 31);

  doc.text(`Emitido: ${dataBR(emitidoEm)}`, largura - MARGEM - 5, 18, { align: 'right' });

  doc.setTextColor(...corPrimaria);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO', largura / 2, 54, { align: 'center' });
}

/** Rodapé de todas as páginas, desenhado depois da tabela (que pode quebrar página). */
function desenharRodapes(doc: jsPDF) {
  const largura = doc.internal.pageSize.getWidth();
  const y = doc.internal.pageSize.getHeight() - 15;
  const total = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina++) {
    doc.setPage(pagina);
    doc.setDrawColor(200, 200, 200);
    doc.line(MARGEM, y - 5, largura - MARGEM, y - 5);
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`${LABORATORIO.nome} • Orçamento`, MARGEM, y);
    doc.text(`Página ${pagina} de ${total}`, largura - MARGEM, y, { align: 'right' });
  }
}

/** Orçamento do cliente: exames, quantidades, preços, Valor Total e Valor com Desconto. */
export function montarPdfOrcamentoCliente(
  { carrinho, orcamento, emitidoEm }: DadosPdfOrcamentoCliente,
  logo: string | null,
): jsPDF {
  const doc = new jsPDF();
  desenharCabecalho(doc, logo, emitidoEm);

  autoTable(doc, {
    startY: 62,
    margin: { left: MARGEM, right: MARGEM, bottom: ALTURA_RODAPE },
    head: [['Descrição', 'Qtd', 'Preço Un. (R$)', 'Total (R$)']],
    body: carrinho.map(({ item, quantidade }) => [
      item.nome,
      String(quantidade),
      numBR(item.preco),
      numBR(item.preco * quantidade),
    ]),
    // Sempre os dois valores, iguais quando não há desconto; sem percentual (como a tela).
    foot: [
      ['Valor Total', '', '', numBR(orcamento.valorTotal)],
      ['Valor com Desconto', '', '', numBR(orcamento.valorComDesconto)],
    ],
    showFoot: 'lastPage',
    styles: { fontSize: 9, cellPadding: 3, textColor: textoEscuro },
    headStyles: { fillColor: corPrimaria, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: fundoClaro, textColor: corPrimaria, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      1: { cellWidth: 16 },
      2: { cellWidth: 32 },
      3: { cellWidth: 32 },
    },
    // columnStyles só vale para o corpo; o alinhamento precisa valer também no cabeçalho e nos totais.
    didParseCell: ({ cell, column }) => {
      if (column.index === 1) cell.styles.halign = 'center';
      if (column.index >= 2) cell.styles.halign = 'right';
    },
  });

  desenharRodapes(doc);
  return doc;
}
