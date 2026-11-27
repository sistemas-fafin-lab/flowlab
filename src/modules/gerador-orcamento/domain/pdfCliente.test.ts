import { describe, expect, it } from 'vitest';
import type jsPDF from 'jspdf';
import type { ItemCarrinho, ItemColaboradorDisponivel, ItemGeradorOrcamento } from '../types';
import { orcamentoDoCarrinho } from './orcamento';
import { montarPdfOrcamentoCliente, montarPdfOrcamentoColaborador } from './pdfCliente';
import { pdfBruto, textoDoPdf } from './textoDoPdf.testHelper';

// Portado de Tabela-Particular/lib/alvaro-orcamento/pdf.test.ts (buildClientPdf).

const exame = (nome: string, preco: number, elegivelDescontoParticular: boolean): ItemGeradorOrcamento => ({
  tuss: '40301630',
  nome,
  preco,
  elegivelDescontoParticular,
  conveniosAceitos: ['Amil'],
  coberturaConvenios: [],
});

// 1 elegível de R$1.000 → 15% sobre ele; o não elegível (2 × R$50) fica sem desconto.
// Valor Total 1.100,00; Valor com Desconto 950,00.
const carrinho: ItemCarrinho[] = [
  { item: exame('Exame Elegível', 1000, true), quantidade: 1 },
  { item: exame('Exame Não Elegível', 50, false), quantidade: 2 },
];

const emitidoEm = new Date(2026, 9, 20);
const paciente = 'Maria da Silva';

// PNG 1×1 transparente.
const LOGO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const pdf = (linhas: ItemCarrinho[] = carrinho, logo: string | null = null, nome = paciente) =>
  montarPdfOrcamentoCliente({ carrinho: linhas, orcamento: orcamentoDoCarrinho(linhas), emitidoEm, paciente: nome }, logo);

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

  it('sem desconto, mostra só o Valor Total', () => {
    const texto = montar([{ item: exame('Exame Não Elegível', 50, false), quantidade: 2 }]);

    expect(texto).toContain('Valor Total 100,00');
    expect(texto).not.toContain('Valor com Desconto');
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

  it('traz o nome do paciente abaixo do título e antes da tabela de exames', () => {
    const texto = montar();

    expect(texto).toContain('Paciente: Maria da Silva');
    expect(texto.indexOf('Paciente: Maria da Silva')).toBeGreaterThan(texto.indexOf('ORÇAMENTO'));
    expect(texto.indexOf('Paciente: Maria da Silva')).toBeLessThan(texto.indexOf('Descrição'));
  });

  it('nome comprido em caixa alta quebra de linha e a tabela segue abaixo dele', () => {
    const longo = 'MARIA APARECIDA DE FATIMA DOS SANTOS OLIVEIRA PEREIRA DA SILVA SOUZA RODRIGUES ALVES';
    const texto = textoDoPdf(pdf(carrinho, null, longo));

    expect(texto).toContain('Paciente: MARIA APARECIDA');
    expect(texto).toContain('ALVES');
    expect(texto.indexOf('ALVES')).toBeLessThan(texto.indexOf('Descrição'));
  });

  it('avisa a validade de 10 dias com a data final, abaixo dos totais', () => {
    const texto = montar();

    expect(texto).toContain('Orçamento válido por 10 dias, até 30/10/2026');
    expect(texto.indexOf('Orçamento válido')).toBeGreaterThan(texto.indexOf('Valor com Desconto 950,00'));
  });

  it('a data final da validade vira o mês e o ano', () => {
    const linhas = carrinho;
    const doc = montarPdfOrcamentoCliente(
      { carrinho: linhas, orcamento: orcamentoDoCarrinho(linhas), emitidoEm: new Date(2026, 11, 25), paciente },
      null,
    );

    expect(textoDoPdf(doc)).toContain('Orçamento válido por 10 dias, até 04/01/2027');
  });

  it('com a tabela em várias páginas, o aviso de validade sai uma vez, na última', () => {
    const muitos = Array.from({ length: 60 }, (_, i) => ({ item: exame(`Exame ${i + 1}`, 50, false), quantidade: 1 }));
    const doc = pdf(muitos);
    const ocorrencias = textoDoPdf(doc).match(/Orçamento válido por 10 dias/g) ?? [];

    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(ocorrencias).toHaveLength(1);
  });

  it('desenha o logo quando ele carregou e segue sem ele quando falhou', () => {
    expect(temImagem(pdf(carrinho, LOGO))).toBe(true);
    expect(temImagem(pdf(carrinho, null))).toBe(false);
  });
});

const exameColaborador = (nome: string, valor: number, custo?: number): ItemColaboradorDisponivel => ({
  tuss: '40301630',
  nome,
  precoParticular: 100,
  ...(custo === undefined ? {} : { custo }),
  precoColaborador: { disponivel: true, valor },
});

// 2 × R$19,66 + 1 × R$45,10 = R$84,42.
const carrinhoColaborador: ItemCarrinho<ItemColaboradorDisponivel>[] = [
  { item: exameColaborador('Hemograma Completo', 19.66, 9.73), quantidade: 2 },
  { item: exameColaborador('Glicose', 45.1, 22.3), quantidade: 1 },
];

const pdfColaborador = (linhas = carrinhoColaborador, colaborador = 'João Pereira') =>
  textoDoPdf(montarPdfOrcamentoColaborador({ carrinho: linhas, emitidoEm, colaborador }, null));

describe('montarPdfOrcamentoColaborador', () => {
  it('tem o título "Orçamento – Tabela Colaborador" no cabeçalho do laboratório', () => {
    const texto = pdfColaborador();

    expect(texto).toContain('Laboratório Lab');
    expect(texto).toContain('Orçamento – Tabela Colaborador');
    expect(texto).toContain('Emitido: 20/10/2026');
  });

  it('traz o nome do colaborador abaixo do título e antes da tabela', () => {
    const texto = pdfColaborador();

    expect(texto).toContain('Colaborador: João Pereira');
    expect(texto).not.toContain('Paciente');
    expect(texto.indexOf('Colaborador: João Pereira')).toBeGreaterThan(texto.indexOf('Orçamento – Tabela Colaborador'));
    expect(texto.indexOf('Colaborador: João Pereira')).toBeLessThan(texto.indexOf('Descrição'));
  });

  it('lista cada exame com quantidade, valor colaborador e total da linha, e o Valor Total', () => {
    const texto = pdfColaborador();

    expect(texto).toMatch(/Hemograma Completo 2 19,66 39,32/);
    expect(texto).toMatch(/Glicose 1 45,10 45,10/);
    expect(texto).toContain('Valor Total 84,42');
  });

  it('não tem "Valor com Desconto", custo, margem nem preço particular', () => {
    const texto = pdfColaborador();

    expect(texto).not.toContain('Valor com Desconto');
    expect(texto).not.toMatch(/custo|margem|desconto|particular|%/i);
    expect(texto).not.toContain('9,73');
    expect(texto).not.toContain('22,30');
    expect(texto).not.toContain('100,00');
  });

  it('avisa a validade abaixo do total', () => {
    const texto = pdfColaborador();

    expect(texto).toContain('Orçamento válido por 10 dias, até 30/10/2026');
    expect(texto.indexOf('Orçamento válido')).toBeGreaterThan(texto.indexOf('Valor Total 84,42'));
  });
});
