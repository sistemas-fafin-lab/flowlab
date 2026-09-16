import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { extrairCpfDaPagina, extrairCompetenciaDaPagina, agruparPaginasPorCpf } from './holeritesParsing.js';
import { extrairTextoPorPagina, fatiarPdf } from './holeritesPdf.js';

/**
 * Monta um PDF de verdade (não um mock) com uma página por linha de `paginas` —
 * valida o pipeline inteiro (pdf-lib gera → pdf-parse lê de volta) no runtime
 * real, não só a lógica de regex/agrupamento (já coberta em
 * holeritesParsing.test.ts / holeritesProcessamento.test.ts).
 */
async function montarPdfConsolidado(paginas: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  for (const linhas of paginas) {
    const pagina = doc.addPage([400, 200]);
    pagina.drawText(linhas, { x: 20, y: 150, size: 10, font: fonte, lineHeight: 14 });
  }
  return Buffer.from(await doc.save());
}

describe('extrairTextoPorPagina (PDF real)', () => {
  it('extrai o texto de cada página, na ordem, e o pipeline completo casa CPF + competência', async () => {
    const bytes = await montarPdfConsolidado([
      'Nome: Fulano de Tal\nCPF: 529.982.247-25\nRef.: Agosto/2026',
      'Nome: Fulano de Tal\nCPF: 529.982.247-25\nRef.: Agosto/2026',
      'Nome: Beltrana Souza\nCPF: 111.444.777-35\nRef.: Agosto/2026',
    ]);

    const textos = await extrairTextoPorPagina(bytes);
    expect(textos).toHaveLength(3);

    const paginas = textos.map((texto, indice) => ({
      numero: indice + 1,
      cpf: extrairCpfDaPagina(texto),
      competencia: extrairCompetenciaDaPagina(texto),
    }));

    expect(paginas.map((p) => p.cpf)).toEqual(['52998224725', '52998224725', '11144477735']);
    expect(paginas.every((p) => p.competencia === '2026-08-01')).toBe(true);

    const { blocos, paginasSemCpf } = agruparPaginasPorCpf(paginas);
    expect(blocos).toEqual([
      { cpf: '52998224725', competencia: '2026-08-01', paginaInicio: 1, paginaFim: 2 },
      { cpf: '11144477735', competencia: '2026-08-01', paginaInicio: 3, paginaFim: 3 },
    ]);
    expect(paginasSemCpf).toEqual([]);
  });
});

describe('fatiarPdf', () => {
  it('recorta só as páginas do intervalo pedido', async () => {
    const bytes = await montarPdfConsolidado(['pagina 1', 'pagina 2', 'pagina 3', 'pagina 4']);

    const fatia = await fatiarPdf(bytes, 2, 3);
    const doc = await PDFDocument.load(fatia);
    expect(doc.getPageCount()).toBe(2);

    const textos = await extrairTextoPorPagina(fatia);
    expect(textos[0]).toContain('pagina 2');
    expect(textos[1]).toContain('pagina 3');
  });
});
