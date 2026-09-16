// api/_lib/rh/holeritesPdf.ts
// I/O real sobre o PDF consolidado (issue 05): extração de texto por página
// (pdf-parse) e fatiamento em PDFs individuais por bloco de páginas (pdf-lib).
// Mantido separado de holeritesParsing.ts/holeritesProcessamento.ts (lógica
// pura, testável sem um PDF de verdade).

import { PDFDocument } from 'pdf-lib';
import { PDFParse } from 'pdf-parse';

/**
 * Extrai o texto de cada página do PDF consolidado, na ordem original.
 * `pages[i].num` é 1-based (mesma convenção de `numero` em PaginaExtraida).
 */
export async function extrairTextoPorPagina(bytes: Buffer): Promise<string[]> {
  const parser = new PDFParse({ data: bytes });
  try {
    const resultado = await parser.getText();
    return resultado.pages
      .slice()
      .sort((a, b) => a.num - b.num)
      .map((pagina) => pagina.text);
  } finally {
    await parser.destroy();
  }
}

/**
 * Fatia o PDF original em um novo PDF contendo só as páginas [paginaInicio,
 * paginaFim] (1-based, inclusive) — um bloco de colaborador vira um arquivo.
 */
export async function fatiarPdf(bytes: Buffer, paginaInicio: number, paginaFim: number): Promise<Buffer> {
  const origem = await PDFDocument.load(bytes);
  const destino = await PDFDocument.create();

  const indices: number[] = [];
  for (let i = paginaInicio; i <= paginaFim; i++) indices.push(i - 1);

  const paginas = await destino.copyPages(origem, indices);
  for (const pagina of paginas) destino.addPage(pagina);

  const saida = await destino.save();
  return Buffer.from(saida);
}
