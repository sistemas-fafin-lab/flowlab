// Helper dos testes de PDF (não é um teste: fica fora do glob *.test.ts).
import type jsPDF from 'jspdf';

/** Bytes do PDF como texto, para procurar marcadores do formato (imagem, transparência). */
export const pdfBruto = (doc: jsPDF) => Buffer.from(doc.output('arraybuffer')).toString('latin1');

/**
 * Texto desenhado no PDF: o jsPDF não comprime o content stream, então as strings
 * literais (`(...) Tj`) aparecem como estão. Junta todas com espaço porque o autoTable
 * quebra o texto de coluna estreita em mais de um Tj. As fontes padrão usam
 * WinAnsiEncoding: lido como windows-1252, o travessão (0x96) volta a ser "–".
 */
export function textoDoPdf(doc: jsPDF): string {
  const strings: string[] = [];
  const bruto = new TextDecoder('windows-1252').decode(doc.output('arraybuffer'));
  for (const m of bruto.matchAll(/\(((?:[^()\\]|\\.)*)\)/g)) strings.push(m[1].replace(/\\([()\\])/g, '$1'));
  return strings.join(' ').replace(/\s+/g, ' ');
}
