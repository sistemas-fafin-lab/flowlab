// Exportação de planos de contingência em PDF (jsPDF) e Word (docx), um por vez ou
// todos num ZIP. O conteúdo e os nomes de arquivo vêm de domain/exportacaoContingencia.ts;
// aqui só se desenha. As bibliotecas são carregadas sob demanda, no clique.

import type { jsPDF as JsPdf } from 'jspdf';
import { carregarLogoPdf } from '../gerador-orcamento/logoPdf';
import { ROTULO_STATUS_CONTINGENCIA } from './components/riscos/rotulos.js';
import {
  camposDoPlano,
  nomeArquivoPlano,
  nomeArquivoZip,
  nomesUnicos,
  type FormatoExportacao,
} from './domain/exportacaoContingencia.js';
import type { PlanoContingenciaDTO } from './types';

const TITULO = 'Plano de contingência';

const dataBR = (data: Date) => data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

function subtituloDoPlano(plano: PlanoContingenciaDTO): string {
  return [plano.codigo, plano.setorNome ?? '—', ROTULO_STATUS_CONTINGENCIA[plano.status]].join('  •  ');
}

// ─── PDF ────────────────────────────────────────────────────────────────────

const MARGEM = 15;
const ALTURA_CABECALHO = 34;
const ALTURA_RODAPE = 20;
const ALTURA_LINHA = 4.8;
const corPrimaria: [number, number, number] = [30, 58, 138];
const corSecundaria: [number, number, number] = [59, 130, 246];
const corRotulo: [number, number, number] = [100, 116, 139];
const textoEscuro: [number, number, number] = [30, 41, 59];

// Faixa azul só na 1ª página, com o logo branco (o mesmo dos PDFs do Orçamento).
function desenharCabecalhoPdf(doc: JsPdf, plano: PlanoContingenciaDTO, logo: string | null) {
  const largura = doc.internal.pageSize.getWidth();
  doc.setFillColor(...corPrimaria);
  doc.rect(0, 0, largura, ALTURA_CABECALHO, 'F');
  doc.setFillColor(...corSecundaria);
  doc.rect(0, ALTURA_CABECALHO, largura, 1.5, 'F');

  const xTexto = logo ? MARGEM + 26 : MARGEM;
  if (logo) doc.addImage(logo, 'PNG', MARGEM, 6, 21, 21, undefined, 'FAST');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(TITULO, xTexto, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(subtituloDoPlano(plano), xTexto, 24);
}

function desenharRodapesPdf(doc: JsPdf, plano: PlanoContingenciaDTO, emitidoEm: Date) {
  const largura = doc.internal.pageSize.getWidth();
  const y = doc.internal.pageSize.getHeight() - 10;
  const total = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina++) {
    doc.setPage(pagina);
    doc.setDrawColor(200, 200, 200);
    doc.line(MARGEM, y - 5, largura - MARGEM, y - 5);
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`${TITULO} ${plano.codigo} • Exportado em ${dataBR(emitidoEm)}`, MARGEM, y);
    doc.text(`Página ${pagina} de ${total}`, largura - MARGEM, y, { align: 'right' });
  }
}

async function gerarPdf(plano: PlanoContingenciaDTO, logo: string | null, emitidoEm: Date): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth() - MARGEM * 2;
  const limite = doc.internal.pageSize.getHeight() - ALTURA_RODAPE;

  desenharCabecalhoPdf(doc, plano, logo);
  let y = ALTURA_CABECALHO + 12;

  const garantirEspaco = (altura: number) => {
    if (y + altura <= limite) return;
    doc.addPage();
    y = MARGEM + 5;
  };

  for (const campo of camposDoPlano(plano)) {
    // Rótulo nunca fica sozinho no fim da página: vai junto com a 1ª linha do valor.
    garantirEspaco(5 + ALTURA_LINHA);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...corRotulo);
    doc.text(campo.rotulo.toUpperCase(), MARGEM, y);
    y += 5;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textoEscuro);
    campo.paragrafos.forEach((paragrafo, i) => {
      if (i > 0) y += 1.5;
      for (const linha of doc.splitTextToSize(paragrafo, largura) as string[]) {
        garantirEspaco(ALTURA_LINHA);
        doc.text(linha, MARGEM, y);
        y += ALTURA_LINHA;
      }
    });
    y += 5;
  }

  if (plano.atualizadoEm) {
    garantirEspaco(ALTURA_LINHA);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Última atualização em ${dataBR(new Date(plano.atualizadoEm))}`, MARGEM, y);
  }

  desenharRodapesPdf(doc, plano, emitidoEm);
  return doc.output('blob');
}

// ─── Word ───────────────────────────────────────────────────────────────────

const HEX_PRIMARIA = '1E3A8A';
const HEX_SECUNDARIA = '3B82F6';
const HEX_ROTULO = '64748B';
const HEX_TEXTO = '1E293B';
const HEX_RODAPE = '969696';

// Sem logo: o PNG é branco e some na página branca do Word.
async function gerarDocx(plano: PlanoContingenciaDTO, emitidoEm: Date): Promise<Blob> {
  const { AlignmentType, BorderStyle, Document, Footer, Packer, PageNumber, Paragraph, TextRun } = await import('docx');

  const corpo = [
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: TITULO, bold: true, size: 36, color: HEX_PRIMARIA })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: HEX_SECUNDARIA, space: 6 } },
      children: [new TextRun({ text: subtituloDoPlano(plano), size: 20, color: HEX_ROTULO })],
    }),
  ];

  for (const campo of camposDoPlano(plano)) {
    corpo.push(
      new Paragraph({
        keepNext: true,
        spacing: { before: 200, after: 60 },
        children: [new TextRun({ text: campo.rotulo.toUpperCase(), bold: true, size: 16, color: HEX_ROTULO })],
      }),
      ...campo.paragrafos.map(
        (texto) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: texto, size: 21, color: HEX_TEXTO })] }),
      ),
    );
  }

  if (plano.atualizadoEm) {
    corpo.push(
      new Paragraph({
        spacing: { before: 240 },
        children: [new TextRun({ text: `Última atualização em ${dataBR(new Date(plano.atualizadoEm))}`, size: 16, color: HEX_RODAPE })],
      }),
    );
  }

  const rodape = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            size: 14,
            color: HEX_RODAPE,
            children: [`${TITULO} ${plano.codigo} • Exportado em ${dataBR(emitidoEm)} • Página `, PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES],
          }),
        ],
      }),
    ],
  });

  const documento = new Document({
    creator: 'FlowLab',
    title: `${TITULO} ${plano.codigo}`,
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [{ footers: { default: rodape }, children: corpo }],
  });
  return Packer.toBlob(documento);
}

// ─── Download ───────────────────────────────────────────────────────────────

function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revogar na hora pode cancelar o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function gerarArquivo(plano: PlanoContingenciaDTO, formato: FormatoExportacao, logo: string | null, emitidoEm: Date) {
  return formato === 'pdf' ? gerarPdf(plano, logo, emitidoEm) : gerarDocx(plano, emitidoEm);
}

/** Baixa um plano no formato escolhido. */
export async function baixarPlanoContingencia(plano: PlanoContingenciaDTO, formato: FormatoExportacao): Promise<void> {
  const emitidoEm = new Date();
  const logo = formato === 'pdf' ? await carregarLogoPdf() : null;
  baixarBlob(await gerarArquivo(plano, formato, logo, emitidoEm), nomeArquivoPlano(plano, formato));
}

/** Baixa os planos recebidos num ZIP, todos no mesmo formato. */
export async function baixarPlanosContingenciaZip(planos: readonly PlanoContingenciaDTO[], formato: FormatoExportacao): Promise<void> {
  const emitidoEm = new Date();
  const [{ default: JSZip }, logo] = await Promise.all([import('jszip'), formato === 'pdf' ? carregarLogoPdf() : null]);
  const zip = new JSZip();
  const nomes = nomesUnicos(planos.map((p) => nomeArquivoPlano(p, formato)));
  for (const [i, plano] of planos.entries()) {
    zip.file(nomes[i], await gerarArquivo(plano, formato, logo, emitidoEm));
  }
  baixarBlob(await zip.generateAsync({ type: 'blob' }), nomeArquivoZip(emitidoEm));
}
