// PDF interno do Orçamento (custo × venda × margem), só para quem tem
// canViewGeradorOrcamentoCustos. Puro (recebe os dados, devolve o documento), para testar
// sem DOM. Portado de buildInternalPdf (Tabela-Particular/lib/alvaro-orcamento/pdf.ts);
// cabeçalho, cores e rodapé em ./pdfComum. O cenário "Não Atendido" (markup 0,7x/0,8x)
// da Tabela-Particular não é portado (spec, "Regras puras no navegador").

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

const corMargemPositiva: [number, number, number] = [0, 150, 50];
const corMargemNegativa: [number, number, number] = [200, 30, 30];

const comSinal = (n: number) => (n >= 0 ? '+' : '') + numBR(n);

/** "INTERNO" translúcido e inclinado no meio de cada página, para não confundir com o do cliente. */
function desenharMarcaDagua(doc: jsPDF) {
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  for (let pagina = 1; pagina <= doc.getNumberOfPages(); pagina++) {
    doc.setPage(pagina);
    doc.saveGraphicsState();
    doc.setGState(doc.GState({ opacity: 0.14 }));
    doc.setFontSize(90);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 0, 0);
    doc.text('INTERNO', largura / 2, altura / 2, { align: 'center', angle: 45 });
    doc.restoreGraphicsState();
  }
}

/**
 * Orçamento interno: custo, venda e margem por exame, desconto automático e marca d'água.
 * Os itens precisam trazer `custo` (lista de preços de quem pode ver custos).
 */
export function montarPdfOrcamentoInterno(
  { carrinho, orcamento, emitidoEm }: DadosPdfOrcamento,
  logo: string | null,
): jsPDF {
  // Sem custo (chave ausente, ou null de exame sem custo cadastrado), o PDF sairia com
  // margem igual à venda: melhor não gerar do que enganar.
  const semCusto = carrinho.find(({ item }) => item.custo == null);
  if (semCusto) {
    throw new Error(`PDF interno sem custo do exame "${semCusto.item.nome}".`);
  }

  const linhas = carrinho.map(({ item, quantidade }) => {
    const venda = item.preco * quantidade;
    const custo = item.custo * quantidade;
    return { item, quantidade, venda, custo, margem: venda - custo };
  });
  const totalVenda = linhas.reduce((soma, l) => soma + l.venda, 0);
  const totalCusto = linhas.reduce((soma, l) => soma + l.custo, 0);
  const totalMargem = totalVenda - totalCusto;

  const rodape: string[][] = [['Total', '', '', numBR(totalVenda), numBR(totalCusto), comSinal(totalMargem)]];
  if (orcamento.percentualAplicado > 0) {
    const exames = orcamento.qtdElegiveis === 1 ? 'exame elegível' : 'exames elegíveis';
    rodape.push([
      `Desconto Automático (${orcamento.percentualAplicado}% sobre ${orcamento.qtdElegiveis} ${exames})`,
      '',
      '',
      `- ${numBR(orcamento.valorTotal - orcamento.valorComDesconto)}`,
      '',
      '',
    ]);
  }
  rodape.push(['Valor Total', '', '', numBR(orcamento.valorTotal), '', '']);
  if (orcamento.percentualAplicado > 0) {
    rodape.push(['Valor com Desconto', '', '', numBR(orcamento.valorComDesconto), '', '']);
  }

  const doc = new jsPDF();
  desenharCabecalho(doc, logo, emitidoEm, 'ORÇAMENTO INTERNO');

  const corDaMargem = (margem: number) => (margem >= 0 ? corMargemPositiva : corMargemNegativa);

  autoTable(doc, {
    startY: 62,
    margin: { left: MARGEM, right: MARGEM, bottom: ALTURA_RODAPE },
    head: [['Descrição', 'Qtd', 'Preço Un. (R$)', 'Total (R$)', 'Custo (R$)', 'Margem (R$)']],
    body: linhas.map((l) => [
      l.item.nome,
      String(l.quantidade),
      numBR(l.item.preco),
      numBR(l.venda),
      numBR(l.custo),
      comSinal(l.margem),
    ]),
    foot: rodape,
    showFoot: 'lastPage',
    styles: { fontSize: 8, cellPadding: 2.5, textColor: textoEscuro },
    headStyles: { fillColor: corPrimaria, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: fundoClaro, textColor: corPrimaria, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      1: { cellWidth: 12 },
      2: { cellWidth: 24 },
      3: { cellWidth: 24 },
      4: { cellWidth: 24 },
      5: { cellWidth: 24 },
    },
    // columnStyles só vale para o corpo; o alinhamento precisa valer também no cabeçalho e nos totais.
    didParseCell: ({ cell, column, row, section }) => {
      if (column.index === 1) cell.styles.halign = 'center';
      if (column.index >= 2) cell.styles.halign = 'right';
      if (column.index !== 5) return;
      if (section === 'body') cell.styles.textColor = corDaMargem(linhas[row.index].margem);
      if (section === 'foot' && row.index === 0) cell.styles.textColor = corDaMargem(totalMargem);
    },
  });

  desenharValidade(doc, emitidoEm);
  desenharRodapes(doc, 'Orçamento interno');
  desenharMarcaDagua(doc);
  return doc;
}
