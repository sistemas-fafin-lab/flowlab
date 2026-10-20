import { describe, expect, it } from 'vitest';
import type { ItemCarrinho, ItemGeradorOrcamento } from '../types';
import { orcamentoDoCarrinho } from './orcamento';
import { montarPdfOrcamentoInterno } from './pdfInterno';
import { pdfBruto, textoDoPdf } from './textoDoPdf.testHelper';

// Portado de Tabela-Particular/lib/alvaro-orcamento/pdf.test.ts (buildInternalPdf).

const exame = (
  nome: string,
  preco: number,
  custo: number | null | undefined,
  elegivelDescontoParticular: boolean,
): ItemGeradorOrcamento => ({
  tuss: '40301630',
  nome,
  preco,
  ...(custo === undefined ? {} : { custo }),
  elegivelDescontoParticular,
  conveniosAceitos: [],
});

// Elegível: venda 1.000,00, custo 400,00, margem +600,00.
// Não elegível (2 × R$50, custo 2 × R$10): venda 100,00, custo 20,00, margem +80,00.
// Totais: venda 1.100,00, custo 420,00, margem +680,00. 15% sobre o elegível: - 150,00 → 950,00.
const carrinho: ItemCarrinho[] = [
  { item: exame('Exame Elegível', 1000, 400, true), quantidade: 1 },
  { item: exame('Exame Não Elegível', 50, 10, false), quantidade: 2 },
];

const emitidoEm = new Date(2026, 9, 20);

const pdf = (linhas: ItemCarrinho[] = carrinho) =>
  montarPdfOrcamentoInterno({ carrinho: linhas, orcamento: orcamentoDoCarrinho(linhas), emitidoEm }, null);

const montar = (linhas: ItemCarrinho[] = carrinho) => textoDoPdf(pdf(linhas));

describe('montarPdfOrcamentoInterno', () => {
  it('avisa a validade de 10 dias com a data final', () => {
    expect(montar()).toContain('Orçamento válido por 10 dias, até 30/10/2026');
  });

  it('mostra custo, venda e margem de cada exame', () => {
    const texto = montar();

    expect(texto).toContain('Custo (R$)');
    expect(texto).toContain('Margem (R$)');
    expect(texto).toMatch(/Exame Elegível 1 1\.000,00 1\.000,00 400,00 \+600,00/);
    expect(texto).toMatch(/Exame Não Elegível 2 50,00 100,00 20,00 \+80,00/);
  });

  it('soma venda, custo e margem do orçamento', () => {
    expect(montar()).toMatch(/Total 1\.100,00 420,00 \+680,00/);
  });

  it('mostra margem negativa quando o custo passa o preço', () => {
    const texto = montar([{ item: exame('Exame no Prejuízo', 10, 15, false), quantidade: 1 }]);

    expect(texto).toMatch(/Exame no Prejuízo 1 10,00 10,00 15,00 -5,00/);
  });

  it('traz a linha do desconto automático com percentual e exames elegíveis, e os mesmos totais da tela', () => {
    const texto = montar();

    expect(texto).toContain('Desconto Automático (15% sobre 1 exame elegível) - 150,00');
    expect(texto).toContain('Valor Total 1.100,00');
    expect(texto).toContain('Valor com Desconto 950,00');
  });

  it('conta os exames elegíveis no plural', () => {
    const elegiveis = ['A', 'B', 'C', 'D', 'E'].map((n) => ({ item: exame(`Exame ${n}`, 10, 1, true), quantidade: 1 }));

    expect(montar(elegiveis)).toContain('Desconto Automático (10% sobre 5 exames elegíveis) - 5,00');
  });

  it('sem desconto, não traz a linha do desconto e mostra os dois valores iguais', () => {
    const texto = montar([{ item: exame('Exame Não Elegível', 50, 10, false), quantidade: 2 }]);

    expect(texto).not.toContain('Desconto Automático');
    expect(texto).toContain('Valor Total 100,00');
    expect(texto).toContain('Valor com Desconto 100,00');
  });

  it('tem o cabeçalho do laboratório e a marca d\'água INTERNO', () => {
    const doc = pdf();
    const texto = textoDoPdf(doc);

    expect(texto).toContain('Laboratório Lab');
    expect(texto).toContain('ORÇAMENTO INTERNO');
    expect(texto).toContain('Emitido: 20/10/2026');
    expect(texto).toMatch(/(^| )INTERNO( |$)/);
    // A marca d'água é translúcida.
    expect(pdfBruto(doc)).toContain('/ca 0.14');
  });

  it('recusa montar com exame sem custo (dados de quem não pode ver custos)', () => {
    const semCusto = [{ item: exame('Exame Elegível', 1000, undefined, true), quantidade: 1 }];

    expect(() => pdf(semCusto)).toThrow(/custo/i);
  });

  it('recusa montar com exame de custo não cadastrado em vez de mostrar margem cheia', () => {
    const custoNulo = [{ item: exame('Exame Sem Custo', 1000, null, true), quantidade: 1 }];

    expect(() => pdf(custoNulo)).toThrow(/Exame Sem Custo/);
  });
});
