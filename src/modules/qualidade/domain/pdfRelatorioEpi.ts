// PDF do Relatório mensal de EPI de uma área (CONTEXT.md, seção Estoque e Qualidade;
// .scratch/epi-relatorio-mensal/spec.md, "Layout do PDF por área"). Puro: recebe as linhas
// e o cabeçalho e devolve o documento, para testar sem DOM. Segue o padrão dos PDFs do
// Gerador de Orçamento (jspdf + autotable).

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ConsolidadoEpi, LinhaRelatorioEpi } from './epiRelatorioMensal.js';

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
const ESTILO_TABELA = {
  fontSize: 9,
  cellPadding: 2.5,
  textColor: textoEscuro,
  valign: 'middle' as const,
  lineColor: [203, 213, 225] as [number, number, number],
  lineWidth: 0.2,
};
const ESTILO_CABECALHO = { fillColor: corPrimaria, textColor: 255, fontStyle: 'bold' as const };

/** YYYY-MM-DD → DD/MM/YYYY, sem `new Date` (sem deslocamento de fuso). */
export const dataBR = (data: string) => {
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

/** "EPIs — <Área ou Consolidado> — <Mês por extenso>/<Ano>" */
export const tituloRelatorioEpi = (assunto: string, mes: string) => `EPIs — ${assunto} — ${mesPorExtenso(mes)}`;

/** Folha A4 horizontal com o título centralizado no alto. */
function novaFolhaComTitulo(titulo: string): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setTextColor(...corPrimaria);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, doc.internal.pageSize.getWidth() / 2, MARGEM + 6, { align: 'center' });
  return doc;
}

/** "Página X de Y" no canto de todas as páginas; `extra` pode desenhar mais algo no rodapé de cada uma. */
function numerarPaginas(doc: jsPDF, extra?: (y: number, pagina: number, total: number) => void) {
  const largura = doc.internal.pageSize.getWidth();
  const y = doc.internal.pageSize.getHeight() - 10;
  const total = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina++) {
    doc.setPage(pagina);
    extra?.(y, pagina, total);
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Página ${pagina} de ${total}`, largura - MARGEM, y, { align: 'right' });
  }
}

const fimDaUltimaTabela = (doc: jsPDF) =>
  (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? MARGEM;

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

/** Colaboradores que assinam o relatório: cada solicitante uma vez, em ordem alfabética. */
export const colaboradoresQueAssinam = (linhas: LinhaRelatorioEpi[]) =>
  [...new Set(linhas.map((l) => l.solicitante.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

const COLUNAS_ASSINATURA = 3;
const ALTURA_LINHA_ASSINATURA = 18;
/** Linhas extras (fileiras de três) sem nome, para outros membros da equipe que receberam os EPIs. */
const FILEIRAS_EM_BRANCO = 2;

/**
 * Quantas linhas de assinatura em branco vão depois das nominais: completam a última fileira e
 * acrescentam mais `FILEIRAS_EM_BRANCO` fileiras inteiras.
 */
export const linhasEmBrancoDeAssinatura = (nominais: number) =>
  ((COLUNAS_ASSINATURA - (nominais % COLUNAS_ASSINATURA)) % COLUNAS_ASSINATURA) + FILEIRAS_EM_BRANCO * COLUNAS_ASSINATURA;

/**
 * Espaço de assinatura dos colaboradores abaixo da tabela: uma linha por colaborador, com o nome
 * embaixo, em três colunas, seguida de linhas em branco (com "Nome:" para preencher à mão) para os
 * demais membros da equipe. Quebra página quando não cabe.
 */
function blocoAssinaturasColaboradores(doc: jsPDF, colaboradores: string[]) {
  const vagas: (string | null)[] = [
    ...colaboradores,
    ...Array<null>(linhasEmBrancoDeAssinatura(colaboradores.length)).fill(null),
  ];
  const largura = doc.internal.pageSize.getWidth();
  const limite = doc.internal.pageSize.getHeight() - ALTURA_RODAPE;
  const larguraColuna = (largura - 2 * MARGEM) / COLUNAS_ASSINATURA;
  const larguraTraco = larguraColuna - 10;

  let y = fimDaUltimaTabela(doc) + 10;
  // Título e a primeira linha de assinaturas não ficam sozinhos no fim da página.
  if (y + 8 + ALTURA_LINHA_ASSINATURA > limite) {
    doc.addPage();
    y = MARGEM + 6;
  }
  doc.setTextColor(...corPrimaria);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Assinaturas dos colaboradores', MARGEM, y);
  y += 8;

  doc.setTextColor(...textoEscuro);
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(...textoEscuro);
  doc.setLineWidth(0.2);
  for (let i = 0; i < vagas.length; i += COLUNAS_ASSINATURA) {
    if (y + ALTURA_LINHA_ASSINATURA > limite) {
      doc.addPage();
      y = MARGEM + 6;
    }
    const traco = y + 10;
    vagas.slice(i, i + COLUNAS_ASSINATURA).forEach((nome, coluna) => {
      const x = MARGEM + coluna * larguraColuna;
      doc.line(x, traco, x + larguraTraco, traco);
      doc.setFontSize(9);
      doc.text(nome ?? 'Nome:', x, traco + 4.5, { maxWidth: larguraTraco });
    });
    y += ALTURA_LINHA_ASSINATURA;
  }
}

/**
 * Relatório mensal de EPI de uma área: A4 horizontal, a tabela dos EPIs entregues, depois um
 * espaço de assinatura para cada colaborador e, só na última página, a do responsável da área.
 */
export function montarPdfRelatorioEpi({ area, mes, linhas }: DadosPdfRelatorioEpi): jsPDF {
  const doc = novaFolhaComTitulo(tituloRelatorioEpi(area, mes));

  autoTable(doc, {
    startY: MARGEM + 14,
    margin: { left: MARGEM, right: MARGEM, bottom: ALTURA_RODAPE },
    head: [['Data', 'Produto', 'Identificação', 'Qtd.', 'Solicitante']],
    body: linhas.map((l) => [dataBR(l.data), l.produto, l.identificacao, String(l.quantidade), l.solicitante]),
    styles: ESTILO_TABELA,
    headStyles: ESTILO_CABECALHO,
    columnStyles: {
      0: { cellWidth: 22 },
      2: { cellWidth: 50 },
      3: { cellWidth: 14 },
      4: { cellWidth: 70 },
    },
    didParseCell: ({ cell, column }) => {
      if (column.index === 3) cell.styles.halign = 'center';
    },
  });

  blocoAssinaturasColaboradores(doc, colaboradoresQueAssinam(linhas));

  // O responsável assina uma vez só, no rodapé da última página.
  numerarPaginas(doc, (y, pagina, total) => {
    if (pagina !== total) return;
    doc.setTextColor(...textoEscuro);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Responsável da área: ________________________________    Data: __/__/____', MARGEM, y);
  });

  return doc;
}

// ─── Consolidado do mês ──────────────────────────────────────────────────────

export interface DadosPdfConsolidadoEpi {
  /** YYYY-MM */
  mes: string;
  consolidado: ConsolidadoEpi;
}

export type FormatoConsolidadoEpi = 'pdf' | 'xlsx';

/** Nome do arquivo baixado do consolidado do mês, em PDF ou Excel. */
export const nomeArquivoConsolidadoEpi = (mes: string, extensao: FormatoConsolidadoEpi) =>
  `epis-consolidado-${mes}.${extensao}`;

/** Quadro de totais (título + tabela de duas colunas) abaixo do que já está na página. */
function quadroDeTotais(doc: jsPDF, titulo: string, coluna: string, linhas: [string, number][], total: number) {
  const altura = doc.internal.pageSize.getHeight();
  let y = fimDaUltimaTabela(doc) + 10;
  // Título e cabeçalho do quadro não ficam sozinhos no fim da página.
  if (y + 20 > altura - ALTURA_RODAPE) {
    doc.addPage();
    y = MARGEM + 6;
  }
  doc.setTextColor(...corPrimaria);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, MARGEM, y);

  autoTable(doc, {
    startY: y + 3,
    margin: { left: MARGEM, right: MARGEM, bottom: ALTURA_RODAPE },
    tableWidth: 140,
    head: [[coluna, 'Qtd.']],
    body: linhas.map(([nome, qtd]) => [nome, String(qtd)]),
    foot: [['Total', String(total)]],
    styles: ESTILO_TABELA,
    headStyles: ESTILO_CABECALHO,
    footStyles: { fillColor: [241, 245, 249], textColor: textoEscuro, fontStyle: 'bold' },
    columnStyles: { 1: { cellWidth: 24, halign: 'center' } },
  });
}

/**
 * Consolidado do mês: A4 horizontal, a tabela de todas as áreas (sem assinatura) e os quadros de
 * totais por produto e por área.
 */
export function montarPdfConsolidadoEpi({ mes, consolidado }: DadosPdfConsolidadoEpi): jsPDF {
  const doc = novaFolhaComTitulo(tituloRelatorioEpi('Consolidado', mes));

  autoTable(doc, {
    startY: MARGEM + 14,
    margin: { left: MARGEM, right: MARGEM, bottom: ALTURA_RODAPE },
    head: [['Área', 'Data', 'Produto', 'Identificação', 'Qtd.', 'Solicitante']],
    body: consolidado.linhas.map((l) => [l.area, dataBR(l.data), l.produto, l.identificacao, String(l.quantidade), l.solicitante]),
    styles: ESTILO_TABELA,
    headStyles: ESTILO_CABECALHO,
    columnStyles: {
      0: { cellWidth: 48 },
      1: { cellWidth: 22 },
      3: { cellWidth: 42 },
      4: { cellWidth: 14 },
      5: { cellWidth: 55 },
    },
    didParseCell: ({ cell, column }) => {
      if (column.index === 4) cell.styles.halign = 'center';
    },
  });

  const { totaisPorProduto, totaisPorArea, totalGeral } = consolidado;
  const porProduto = totaisPorProduto.map((t): [string, number] => [t.produto, t.quantidade]);
  const porArea = totaisPorArea.map((t): [string, number] => [t.area, t.quantidade]);
  quadroDeTotais(doc, 'Totais por produto', 'Produto', porProduto, totalGeral);
  quadroDeTotais(doc, 'Totais por área', 'Área', porArea, totalGeral);

  numerarPaginas(doc);
  return doc;
}
