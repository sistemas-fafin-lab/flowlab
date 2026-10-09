import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { analisarPlanilha } from './domain/importacao';
import { ABA_DESPESAS, CABECALHOS_MODELO, EXEMPLOS_MODELO } from './domain/modeloImportacao';
import { lerPlanilhaDespesas, livroModelo } from './planilhaImportacao';

const CATEGORIAS = ['SaaS e Assinaturas', 'Cloud e Hospedagem', 'Hardware e Equipamentos'];

/** Simula o usuário: baixa o modelo, cola linhas na aba Despesas e salva o .xlsx. */
const arquivo = (linhas: (string | number | Date)[][], opcoes: { aba?: string } = {}): Uint8Array => {
  const livro = livroModelo(CATEGORIAS);
  const nome = opcoes.aba ?? ABA_DESPESAS;
  if (nome !== ABA_DESPESAS) {
    livro.SheetNames = livro.SheetNames.filter((n) => n !== ABA_DESPESAS);
    delete livro.Sheets[ABA_DESPESAS];
    XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet([CABECALHOS_MODELO, ...linhas]), nome);
  } else {
    XLSX.utils.sheet_add_aoa(livro.Sheets[ABA_DESPESAS], linhas, { origin: 'A2' });
  }
  return XLSX.write(livro, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
};

const contexto = {
  hoje: '2026-10-15',
  categorias: [
    { id: 'saas', nome: 'SaaS e Assinaturas', ativo: true, naturezaPadrao: 'opex' as const },
    { id: 'cloud', nome: 'Cloud e Hospedagem', ativo: true, naturezaPadrao: 'opex' as const },
    { id: 'hw', nome: 'Hardware e Equipamentos', ativo: true, naturezaPadrao: 'capex' as const },
  ],
  fornecedores: [],
  despesasExistentes: [],
  setores: ['TI'],
};

describe('ida e volta pelo arquivo .xlsx', () => {
  it('o modelo baixado tem as três abas e a aba Despesas só com o cabeçalho', () => {
    const livro = XLSX.read(XLSX.write(livroModelo(CATEGORIAS), { type: 'array', bookType: 'xlsx' }), { type: 'array' });
    expect(livro.SheetNames).toEqual(['Despesas', 'Instruções', 'Listas']);
    const despesas = XLSX.utils.sheet_to_json<unknown[]>(livro.Sheets.Despesas, { header: 1 });
    expect(despesas).toEqual([CABECALHOS_MODELO]);
    expect(lerPlanilhaDespesas(XLSX.write(livroModelo(CATEGORIAS), { type: 'array', bookType: 'xlsx' }))).toEqual({
      ok: false,
      erro: expect.stringMatching(/está vazia/),
    });
  });

  it('modelo preenchido com os 3 exemplos importa sem erro', () => {
    const leitura = lerPlanilhaDespesas(arquivo(EXEMPLOS_MODELO));
    expect(leitura.ok).toBe(true);
    if (leitura.ok === false) return;
    const resultado = analisarPlanilha(leitura.linhas, leitura.mapa, contexto, { criarCategorias: false });
    expect(resultado.map((r) => r.erros)).toEqual([[], [], []]);
    expect(resultado.map((r) => r.numero)).toEqual([2, 3, 4]);
  });

  it('data digitada como data no Excel (célula de data) vira competência e data certas', () => {
    const linha = [...EXEMPLOS_MODELO[0]] as (string | number | Date)[];
    linha[7] = new Date(Date.UTC(2026, 9, 1)); // Início como célula de data
    linha[13] = new Date(Date.UTC(2026, 8, 20)); // Data da autorização como célula de data
    const leitura = lerPlanilhaDespesas(arquivo([linha]));
    if (leitura.ok === false) throw new Error(leitura.erro);
    const [r] = analisarPlanilha(leitura.linhas, leitura.mapa, contexto, { criarCategorias: false });
    expect(r.erros).toEqual([]);
    expect(r.despesa).toMatchObject({ competenciaInicio: '2026-10-01', autorizadoEm: '2026-09-20' });
  });

  it('aba Despesas renomeada: acha a aba que tem o cabeçalho do modelo, mesmo não sendo a primeira', () => {
    // Sem "Despesas", a primeira aba do arquivo vira "Instruções" — não pode ser a lida.
    const leitura = lerPlanilhaDespesas(arquivo([EXEMPLOS_MODELO[1]], { aba: 'Planilha1' }));
    expect(leitura.ok).toBe(true);
    if (leitura.ok) expect(leitura.linhas).toHaveLength(1);
  });

  it('CSV com os cabeçalhos do modelo também é lido', () => {
    const csv = `${CABECALHOS_MODELO.join(';')}\n${EXEMPLOS_MODELO[2].join(';')}`;
    const livro = XLSX.read(csv, { type: 'string', FS: ';' });
    const conteudo = XLSX.write(livro, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
    const leitura = lerPlanilhaDespesas(conteudo);
    if (leitura.ok === false) throw new Error(leitura.erro);
    expect(analisarPlanilha(leitura.linhas, leitura.mapa, contexto, { criarCategorias: false })[0].erros).toEqual([]);
  });

  it('cabeçalho faltando e arquivo ilegível dão mensagem clara', () => {
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet([['Descrição', 'Valor'], ['X', 10]]), 'Despesas');
    const faltando = lerPlanilhaDespesas(XLSX.write(livro, { type: 'array', bookType: 'xlsx' }));
    expect(faltando).toEqual({ ok: false, erro: expect.stringMatching(/Colunas obrigatórias ausentes: Categoria, Fornecedor/) });
    expect(lerPlanilhaDespesas(new Uint8Array([1, 2, 3, 4]))).toMatchObject({ ok: false });
  });
});
