// PDF do Orçamento para o cliente e a variante "Orçamento – Tabela Colaborador". Puros
// (recebem os dados, devolvem o documento), para testar sem DOM. O do cliente é portado de
// buildClientPdf (Tabela-Particular/lib/alvaro-orcamento/pdf.ts) com o mesmo conteúdo;
// cabeçalho, cores e rodapé em ./pdfComum.

import jsPDF from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import type { ItemCarrinho, ItemColaboradorDisponivel } from '../types';
import { totalColaborador } from './carrinhoColaborador';
import {
  ALTURA_RODAPE,
  type DadosPdfOrcamento,
  MARGEM,
  corPrimaria,
  desenharCabecalho,
  desenharDestinatario,
  desenharRodapes,
  desenharValidade,
  fundoClaro,
  numBR,
  textoEscuro,
} from './pdfComum';

/** Orçamento do cliente: exames, quantidades, preços, Valor Total e, se houver desconto, Valor com Desconto. */
export function montarPdfOrcamentoCliente(
  { carrinho, orcamento, emitidoEm, paciente }: DadosPdfOrcamento,
  logo: string | null,
): jsPDF {
  const doc = new jsPDF();
  desenharCabecalho(doc, logo, emitidoEm, 'ORÇAMENTO');
  const inicioDaTabela = desenharDestinatario(doc, 'Paciente', paciente);

  desenharTabela(
    doc,
    inicioDaTabela,
    carrinho.map(({ item, quantidade }) => [item.nome, String(quantidade), numBR(item.preco), numBR(item.preco * quantidade)]),
    // Valor com Desconto só quando há desconto; sem percentual (como a tela).
    [
      ['Valor Total', '', '', numBR(orcamento.valorTotal)],
      ...(orcamento.percentualAplicado > 0 ? [['Valor com Desconto', '', '', numBR(orcamento.valorComDesconto)]] : []),
    ],
  );

  desenharValidade(doc, emitidoEm);
  desenharRodapes(doc, 'Orçamento');
  return doc;
}

/** O que o PDF da Tabela Colaborador recebe: o carrinho do modo colaborador e quem leva o orçamento. */
export interface DadosPdfOrcamentoColaborador {
  carrinho: readonly ItemCarrinho<ItemColaboradorDisponivel>[];
  emitidoEm: Date;
  /** Nome digitado na tela; sai logo abaixo do título. */
  colaborador: string;
}

const TITULO_PDF_COLABORADOR = 'Orçamento – Tabela Colaborador';

/**
 * "Orçamento – Tabela Colaborador": exames, quantidades, Valor colaborador e Valor Total.
 * Sem custo, margem, preço particular nem "Valor com Desconto" (o Valor colaborador já é
 * o preço final). Não é guardado.
 */
export function montarPdfOrcamentoColaborador(
  { carrinho, emitidoEm, colaborador }: DadosPdfOrcamentoColaborador,
  logo: string | null,
): jsPDF {
  const doc = new jsPDF();
  desenharCabecalho(doc, logo, emitidoEm, TITULO_PDF_COLABORADOR);
  const inicioDaTabela = desenharDestinatario(doc, 'Colaborador', colaborador);

  desenharTabela(
    doc,
    inicioDaTabela,
    carrinho.map((linha) => [
      linha.item.nome,
      String(linha.quantidade),
      numBR(linha.item.precoColaborador.valor),
      numBR(totalColaborador([linha])),
    ]),
    [['Valor Total', '', '', numBR(totalColaborador(carrinho))]],
  );

  desenharValidade(doc, emitidoEm);
  desenharRodapes(doc, TITULO_PDF_COLABORADOR);
  return doc;
}

/** Tabela de exames dos PDFs para quem recebe o orçamento: Descrição, Qtd, Preço Un., Total. */
function desenharTabela(doc: jsPDF, startY: number, body: RowInput[], foot: RowInput[]) {
  autoTable(doc, {
    startY,
    margin: { left: MARGEM, right: MARGEM, bottom: ALTURA_RODAPE },
    head: [['Descrição', 'Qtd', 'Preço Un. (R$)', 'Total (R$)']],
    body,
    foot,
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
}
