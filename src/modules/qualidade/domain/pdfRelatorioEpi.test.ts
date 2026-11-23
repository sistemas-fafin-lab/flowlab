import { describe, expect, it } from 'vitest';
import { textoDoPdf } from '../../gerador-orcamento/domain/textoDoPdf.testHelper.js';
import type { ConsolidadoEpi, LinhaRelatorioEpi } from './epiRelatorioMensal.js';
import { montarPdfConsolidadoEpi, montarPdfRelatorioEpi, nomeArquivoConsolidadoEpi } from './pdfRelatorioEpi.js';

const linha = (sobre: Partial<LinhaRelatorioEpi>): LinhaRelatorioEpi => ({
  solicitacaoId: 'sm-1',
  itemId: 'i1',
  data: '2026-10-05',
  produto: 'Luva nitrílica',
  identificacao: 'CA 12345',
  quantidade: 2,
  solicitante: 'Ana Souza',
  ...sobre,
});

const linhas = [
  linha({}),
  linha({ itemId: 'i2', data: '2026-10-12', produto: 'Máscara PFF2', identificacao: 'ANVISA 80495510226', quantidade: 10, solicitante: 'Bruno Lima' }),
  linha({ itemId: 'i3', data: '2026-10-20', produto: 'Óculos de proteção', identificacao: '', quantidade: 1, solicitante: 'Carla Dias' }),
];

const pdf = (l = linhas) => montarPdfRelatorioEpi({ area: 'Recepção', mes: '2026-10', linhas: l });

describe('montarPdfRelatorioEpi', () => {
  it('é A4 na horizontal', () => {
    const doc = pdf();
    expect(Math.round(doc.internal.pageSize.getWidth())).toBe(297);
    expect(Math.round(doc.internal.pageSize.getHeight())).toBe(210);
  });

  it('tem o cabeçalho com a área e o mês/ano', () => {
    // O "—" vai como 0x97 (travessão na WinAnsiEncoding da fonte padrão); textoDoPdf lê em latin1.
    expect(textoDoPdf(pdf())).toContain('EPIs \x97 Recepção \x97 Outubro/2026');
  });

  it('escreve o mês por extenso no cabeçalho', () => {
    const titulo = (mes: string) => textoDoPdf(montarPdfRelatorioEpi({ area: 'Copa', mes, linhas: [] }));
    expect(titulo('2026-01')).toContain('Copa \x97 Janeiro/2026');
    expect(titulo('2026-03')).toContain('Copa \x97 Março/2026');
    expect(titulo('2025-12')).toContain('Copa \x97 Dezembro/2025');
  });

  it('tem as colunas Data, Produto, Identificação, Qtd. e Solicitante, sem coluna de assinatura', () => {
    const texto = textoDoPdf(pdf());
    expect(texto).toContain('Data Produto Identificação Qtd. Solicitante');
    expect(texto).not.toContain('Solicitante Assinatura');
  });

  it('depois da tabela, tem um espaço de assinatura para cada colaborador, uma vez só', () => {
    const repetido = [...linhas, linha({ itemId: 'i4', solicitante: 'Ana Souza' })];
    const texto = textoDoPdf(pdf(repetido));

    expect(texto).toContain('Assinaturas dos colaboradores');
    expect(texto.match(/Ana Souza/g)).toHaveLength(2 + 1); // duas linhas da tabela + uma assinatura
    expect(texto.match(/Bruno Lima/g)).toHaveLength(1 + 1);
  });

  it('tem uma linha por item, com a data, a identificação formatada, a quantidade e o solicitante', () => {
    const texto = textoDoPdf(pdf());

    expect(texto).toContain('05/10/2026 Luva nitrílica CA 12345 2 Ana Souza');
    expect(texto).toContain('12/10/2026 Máscara PFF2 ANVISA 80495510226 10 Bruno Lima');
    // Sem identificação, a coluna fica vazia.
    expect(texto).toContain('20/10/2026 Óculos de proteção 1 Carla Dias');
  });

  it('tem o rodapé do responsável da área e o número da página', () => {
    const texto = textoDoPdf(pdf());

    expect(texto).toContain('Responsável da área: ______');
    expect(texto).toContain('Data: __/__/____');
    expect(texto).toContain('Página 1 de 1');
  });

  it('com muitas linhas, quebra página e o responsável da área assina só na última', () => {
    const muitas = Array.from({ length: 40 }, (_, i) => linha({ itemId: `i${i}`, solicitante: `Colaborador ${i}` }));
    const doc = pdf(muitas);
    const texto = textoDoPdf(doc);

    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(texto.match(/Responsável da área/g)).toHaveLength(1);
    // O rodapé do responsável vem depois de tudo, na última página.
    expect(texto.lastIndexOf('Responsável da área')).toBeGreaterThan(texto.lastIndexOf('Colaborador '));
    expect(texto).toContain(`Página ${doc.getNumberOfPages()} de ${doc.getNumberOfPages()}`);
    for (let i = 0; i < 40; i++) expect(texto).toContain(`Colaborador ${i} `);
  });
});

const consolidado: ConsolidadoEpi = {
  linhas: [
    { ...linha({}), area: 'Laboratório' },
    { ...linha({ itemId: 'i2', data: '2026-10-12', produto: 'Máscara PFF2', identificacao: 'ANVISA 80495510226', quantidade: 10, solicitante: 'Bruno Lima' }), area: 'Recepção' },
  ],
  totaisPorProduto: [
    { produto: 'Luva nitrílica', quantidade: 2 },
    { produto: 'Máscara PFF2', quantidade: 10 },
  ],
  totaisPorArea: [
    { area: 'Laboratório', quantidade: 2 },
    { area: 'Recepção', quantidade: 10 },
  ],
  totalGeral: 12,
};

describe('montarPdfConsolidadoEpi', () => {
  const doc = montarPdfConsolidadoEpi({ mes: '2026-10', consolidado });
  const texto = textoDoPdf(doc);

  it('é A4 na horizontal, com o cabeçalho do consolidado e o mês por extenso', () => {
    expect(Math.round(doc.internal.pageSize.getWidth())).toBe(297);
    expect(texto).toContain('EPIs \x97 Consolidado \x97 Outubro/2026');
  });

  it('tem as colunas Área, Data, Produto, Identificação, Qtd. e Solicitante, sem assinatura', () => {
    expect(texto).toContain('Área Data Produto Identificação Qtd. Solicitante');
    expect(texto).not.toContain('Assinatura');
    expect(texto).not.toContain('Responsável da área');
  });

  it('tem uma linha por item, com a área', () => {
    expect(texto).toContain('Laboratório 05/10/2026 Luva nitrílica CA 12345 2 Ana Souza');
    expect(texto).toContain('Recepção 12/10/2026 Máscara PFF2 ANVISA 80495510226 10 Bruno Lima');
  });

  it('tem os quadros de totais por produto e por área, com o total geral', () => {
    expect(texto).toContain('Totais por produto');
    expect(texto).toContain('Produto Qtd.');
    expect(texto).toContain('Máscara PFF2 10');
    expect(texto).toContain('Totais por área');
    expect(texto).toContain('Área Qtd.');
    expect(texto).toContain('Recepção 10');
    expect(texto).toContain('Total 12');
  });

  it('tem o número da página', () => {
    expect(texto).toContain('Página 1 de 1');
  });
});

describe('nomeArquivoConsolidadoEpi', () => {
  it('leva o mês e a extensão', () => {
    expect(nomeArquivoConsolidadoEpi('2026-10', 'pdf')).toBe('epis-consolidado-2026-10.pdf');
    expect(nomeArquivoConsolidadoEpi('2026-10', 'xlsx')).toBe('epis-consolidado-2026-10.xlsx');
  });
});
