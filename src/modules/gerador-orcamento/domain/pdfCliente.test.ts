import { describe, expect, it } from 'vitest';
import type jsPDF from 'jspdf';
import type { ItemCarrinho, ItemGeradorOrcamento } from '../types';
import { orcamentoDoCarrinho } from './orcamento';
import { montarPdfOrcamentoCliente } from './pdfCliente';
import { pdfBruto, textoDoPdf } from './textoDoPdf.testHelper';

// Portado de Tabela-Particular/lib/alvaro-orcamento/pdf.test.ts (buildClientPdf).

const exame = (nome: string, preco: number, elegivelDescontoParticular: boolean): ItemGeradorOrcamento => ({
  tuss: '40301630',
  nome,
  preco,
  elegivelDescontoParticular,
  conveniosAceitos: ['Amil'],
});

// 1 elegível de R$1.000 → 15% sobre ele; o não elegível (2 × R$50) fica sem desconto.
// Valor Total 1.100,00; Valor com Desconto 950,00.
const carrinho: ItemCarrinho[] = [
  { item: exame('Exame Elegível', 1000, true), quantidade: 1 },
  { item: exame('Exame Não Elegível', 50, false), quantidade: 2 },
];

const emitidoEm = new Date(2026, 9, 20);

// PNG 1×1 transparente.
const LOGO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const pdf = (linhas: ItemCarrinho[] = carrinho, logo: string | null = null) =>
  montarPdfOrcamentoCliente({ carrinho: linhas, orcamento: orcamentoDoCarrinho(linhas), emitidoEm }, logo);

const montar = (linhas: ItemCarrinho[] = carrinho) => textoDoPdf(pdf(linhas));

const temImagem = (doc: jsPDF) => pdfBruto(doc).includes('/Subtype /Image');

describe('montarPdfOrcamentoCliente', () => {
  it('lista cada exame com quantidade, preço unitário e total da linha', () => {
    const texto = montar();

    expect(texto).toContain('Exame Elegível');
    expect(texto).toContain('1.000,00');
    expect(texto).toMatch(/Exame Não Elegível 2 50,00 100,00/);
  });

  it('traz o Valor Total e o Valor com Desconto do mesmo cálculo da tela', () => {
    const texto = montar();

    expect(texto).toContain('Valor Total 1.100,00');
    expect(texto).toContain('Valor com Desconto 950,00');
  });

  it('sem desconto, mostra os dois valores iguais', () => {
    const texto = montar([{ item: exame('Exame Não Elegível', 50, false), quantidade: 2 }]);

    expect(texto).toContain('Valor Total 100,00');
    expect(texto).toContain('Valor com Desconto 100,00');
  });

  it('nunca mostra custo, margem, percentual de desconto nem outra informação interna', () => {
    // O item pode chegar com custo (usuário com permissão de custos): o PDF do cliente ignora.
    const comCusto = { ...exame('Exame Elegível', 1000, true), custo: 432.1 } as ItemGeradorOrcamento;
    const texto = montar([{ item: comCusto, quantidade: 1 }]);

    expect(texto).not.toMatch(/custo|diferen|margem|interno|autom|eleg[ií]ve(l|is) a desconto/i);
    expect(texto).not.toContain('432,10');
    expect(texto).not.toContain('%');
  });

  it('tem o cabeçalho do laboratório com o título e a data de emissão', () => {
    const texto = montar();

    expect(texto).toContain('Laboratório Lab');
    expect(texto).toContain('SHLS 716 BLOCO E, CENTRO MÉDICO BRASILIA, ASA SUL');
    expect(texto).toContain('lab@laboratoriolab.com.br');
    expect(texto).toContain('ORÇAMENTO');
    expect(texto).toContain('Emitido: 20/10/2026');
  });

  it('desenha o logo quando ele carregou e segue sem ele quando falhou', () => {
    expect(temImagem(pdf(carrinho, LOGO))).toBe(true);
    expect(temImagem(pdf(carrinho, null))).toBe(false);
  });
});
