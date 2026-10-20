// PDF do Orçamento para o cliente. Puro (recebe os dados, devolve o documento), para
// testar sem DOM. Portado de buildClientPdf (Tabela-Particular/lib/alvaro-orcamento/pdf.ts)
// com o mesmo conteúdo; cabeçalho, cores e rodapé em ./pdfComum.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ALTURA_RODAPE,
  type DadosPdfOrcamento,
  MARGEM,
  corPrimaria,
  desenharCabecalho,
  desenharRodapes,
  desenharValidade,
  fundoClaro,
  numBR,
  textoEscuro,
} from './pdfComum';

/** Orçamento do cliente: exames, quantidades, preços, Valor Total e Valor com Desconto. */
export function montarPdfOrcamentoCliente(
  { carrinho, orcamento, emitidoEm }: DadosPdfOrcamento,
  logo: string | null,
): jsPDF {
  const doc = new jsPDF();
  desenharCabecalho(doc, logo, emitidoEm, 'ORÇAMENTO');

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

  desenharValidade(doc, emitidoEm);
  desenharRodapes(doc, 'Orçamento');
  return doc;
}
