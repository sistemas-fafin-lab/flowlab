// Partes comuns aos PDFs do Orçamento (cliente e interno): cabeçalho, cores e rodapé no
// padrão de src/modules/quotations/utils/generateQuotationPDF.ts.

import type jsPDF from 'jspdf';
import type { ItemCarrinho } from '../types';
import type { ResultadoOrcamento } from './orcamento';

/** O que os dois PDFs do Orçamento recebem. */
export interface DadosPdfOrcamento {
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

export const MARGEM = 15;
export const ALTURA_RODAPE = 25;

export const corPrimaria: [number, number, number] = [30, 58, 138];
const corSecundaria: [number, number, number] = [59, 130, 246];
export const fundoClaro: [number, number, number] = [241, 245, 249];
export const textoEscuro: [number, number, number] = [30, 41, 59];

export const numBR = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dataBR = (data: Date) => data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Faixa do topo com o logo (PNG em data URL, quadrado), os dados do laboratório e o título. */
export function desenharCabecalho(doc: jsPDF, logo: string | null, emitidoEm: Date, titulo: string) {
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
  doc.text(titulo, largura / 2, 54, { align: 'center' });
}

/** Rodapé de todas as páginas, desenhado depois da tabela (que pode quebrar página). */
export function desenharRodapes(doc: jsPDF, documento: string) {
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
    doc.text(`${LABORATORIO.nome} • ${documento}`, MARGEM, y);
    doc.text(`Página ${pagina} de ${total}`, largura - MARGEM, y, { align: 'right' });
  }
}
