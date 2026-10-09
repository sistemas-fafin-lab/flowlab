import { describe, expect, it } from 'vitest';
import { analisarPlanilha, mapearCabecalhos } from './importacao';
import { CABECALHOS_MODELO, EXEMPLOS_MODELO, abaInstrucoes, abaListas, abaRelatorio } from './modeloImportacao';

describe('modelo de importação', () => {
  it('a aba Despesas tem os 24 cabeçalhos, todos reconhecidos pelo importador', () => {
    expect(CABECALHOS_MODELO).toHaveLength(24);
    const { mapa, faltando } = mapearCabecalhos(CABECALHOS_MODELO);
    expect(mapa.size).toBe(24);
    expect(faltando).toEqual([]);
  });

  it('os 3 exemplos do modelo importam sem erro com as categorias iniciais', () => {
    const { mapa } = mapearCabecalhos(CABECALHOS_MODELO);
    const linhas = EXEMPLOS_MODELO.map((exemplo) => Object.fromEntries(CABECALHOS_MODELO.map((c, i) => [c, exemplo[i]])));
    const resultado = analisarPlanilha(
      linhas,
      mapa,
      {
        hoje: '2026-10-15',
        categorias: [
          { id: 'saas', nome: 'SaaS e Assinaturas', ativo: true, naturezaPadrao: 'opex' },
          { id: 'cloud', nome: 'Cloud e Hospedagem', ativo: true, naturezaPadrao: 'opex' },
          { id: 'hw', nome: 'Hardware e Equipamentos', ativo: true, naturezaPadrao: 'capex' },
        ],
        fornecedores: [],
        despesasExistentes: [],
        setores: ['TI'],
      },
      { criarCategorias: false },
    );
    expect(resultado.map((r) => r.erros)).toEqual([[], [], []]);
    expect(resultado[2].despesa).toMatchObject({ competenciaInicio: '2026-10-01', competenciaFim: '2027-07-01', natureza: 'capex' });
  });

  it('cada exemplo tem uma célula por coluna', () => {
    for (const exemplo of EXEMPLOS_MODELO) expect(exemplo).toHaveLength(24);
  });

  it('a aba Instruções lista todas as colunas e traz os exemplos', () => {
    const aba = abaInstrucoes();
    const colunas = aba.filter((l) => l.length === 4 && CABECALHOS_MODELO.includes(String(l[0])));
    expect(colunas).toHaveLength(24);
    expect(aba).toContainEqual(EXEMPLOS_MODELO[0]);
  });

  it('a aba Listas alinha as listas em colunas de alturas diferentes', () => {
    const aba = abaListas(['IA', 'SaaS'], ['TI', 'Financeiro', 'RH']);
    expect(aba[0]).toEqual(['Categorias', 'Recorrência', 'Forma de pagamento', 'Tipo de valor', 'Natureza', 'Setor', 'Renovação automática']);
    expect(aba[1][0]).toBe('IA');
    expect(aba[3][0]).toBe('');
    expect(aba.map((l) => l[5]).slice(1, 4)).toEqual(['TI', 'Financeiro', 'RH']);
  });

  it('o relatório traz as linhas com erro e as desmarcadas', () => {
    const linhas = [
      { numero: 2, despesa: null, erros: ['Valor: inválido'], avisos: [], resumo: { descricao: 'A' } },
      { numero: 3, despesa: {}, erros: [], avisos: ['Parece já estar cadastrada'], resumo: { descricao: 'B' } },
      { numero: 4, despesa: {}, erros: [], avisos: [], resumo: { descricao: 'C' } },
    ] as unknown as Parameters<typeof abaRelatorio>[0];
    expect(abaRelatorio(linhas, new Set([4]))).toEqual([
      ['Linha', 'Descrição', 'Situação', 'Motivo'],
      [2, 'A', 'Erro', 'Valor: inválido'],
      [3, 'B', 'Não importada (desmarcada)', 'Parece já estar cadastrada'],
    ]);
  });
});
