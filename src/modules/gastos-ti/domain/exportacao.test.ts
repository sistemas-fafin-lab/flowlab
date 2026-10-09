import { describe, expect, it } from 'vitest';
import { CABECALHOS_MES, linhasExportacaoDespesas, linhasExportacaoMes } from './exportacao';
import { analisarPlanilha, mapearCabecalhos } from './importacao';
import { montarLinhas } from './listaDespesas';
import { montarOcorrenciasDoMes } from './situacao';
import type { Despesa, Lancamento } from '../types';

const despesa = (campos: Partial<Despesa>): Despesa => ({
  id: 'd1',
  descricao: 'Microsoft 365',
  categoriaId: 'cat-saas',
  natureza: 'opex',
  quantidade: 40,
  unidade: 'licenças',
  fornecedorId: 'f-ms',
  fornecedorNome: 'Microsoft',
  setor: 'TI',
  responsavelId: null,
  responsavelNome: null,
  tipoValor: 'fixo',
  valorBase: 2480.5,
  recorrencia: 'mensal',
  competenciaInicio: '2026-10-01',
  competenciaFim: '2027-09-01',
  diaVencimento: 10,
  formaPagamento: 'cartao_corporativo',
  meioPagamentoDetalhe: 'cartão final 1234',
  moedaOriginal: null,
  valorOriginal: null,
  numeroContrato: 'CT-1',
  renovacaoAutomatica: true,
  avisoRenovacaoDias: 45,
  autorizadoPor: 'Diretoria',
  autorizadoEm: '2026-09-20',
  observacoes: 'Plano anual pago mensalmente',
  anexos: [],
  reajustes: [],
  createdAt: '',
  updatedAt: '',
  ...campos,
});

const nomeCategoria = (id: string) => ({ 'cat-saas': 'SaaS e Assinaturas', 'cat-cloud': 'Cloud e Hospedagem' })[id] ?? '';

describe('linhasExportacaoDespesas', () => {
  const despesas = [despesa({}), despesa({ id: 'd2', descricao: 'AWS', categoriaId: 'cat-cloud', fornecedorId: null, fornecedorNome: 'Amazon', tipoValor: 'variavel', recorrencia: 'unica', competenciaFim: null, moedaOriginal: 'USD', valorOriginal: 600, quantidade: null, unidade: null, renovacaoAutomatica: false, autorizadoEm: null })];
  const aoa = linhasExportacaoDespesas(montarLinhas(despesas, '2026-10-15'), nomeCategoria, (id) => (id === 'f-ms' ? '04712500000107' : null));

  it('usa os cabeçalhos do modelo e valores como número', () => {
    expect(aoa[0]).toHaveLength(24);
    expect(aoa[1][4]).toBe(2480.5);
    expect(typeof aoa[1][9]).toBe('number');
  });

  it('volta pelo importador sem erro e com os mesmos dados', () => {
    const { mapa } = mapearCabecalhos(aoa[0].map(String));
    const linhas = aoa.slice(1).map((l) => Object.fromEntries(aoa[0].map((c, i) => [String(c), l[i]])));
    const reimportado = analisarPlanilha(
      linhas,
      mapa,
      {
        hoje: '2026-10-15',
        categorias: [
          { id: 'cat-saas', nome: 'SaaS e Assinaturas', ativo: true, naturezaPadrao: 'opex' },
          { id: 'cat-cloud', nome: 'Cloud e Hospedagem', ativo: true, naturezaPadrao: 'opex' },
        ],
        fornecedores: [{ id: 'f-ms', nome: 'Microsoft', cnpj: '04712500000107' }],
        despesasExistentes: despesas,
        setores: ['TI'],
      },
      { criarCategorias: false },
    );
    expect(reimportado.map((r) => r.erros)).toEqual([[], []]);
    // as duas já existem no sistema: entram com aviso e desmarcadas, sem duplicar
    expect(reimportado.every((r) => r.jaExiste)).toBe(true);
    const [m365, aws] = reimportado.map((r) => r.despesa);
    expect(m365).toMatchObject({
      descricao: 'Microsoft 365',
      categoriaId: 'cat-saas',
      fornecedorId: 'f-ms',
      valorBase: 2480.5,
      competenciaInicio: '2026-10-01',
      competenciaFim: '2027-09-01',
      formaPagamento: 'cartao_corporativo',
      renovacaoAutomatica: true,
      avisoRenovacaoDias: 45,
      autorizadoEm: '2026-09-20',
      quantidade: 40,
      setor: 'TI',
    });
    expect(aws).toMatchObject({ recorrencia: 'unica', tipoValor: 'variavel', moedaOriginal: 'USD', valorOriginal: 600, fornecedorId: null });
  });
});

describe('linhasExportacaoMes', () => {
  it('uma linha por cobrança com previsto calculado, ajustado, pago e situação', () => {
    const pago: Lancamento = {
      id: 'l',
      despesaId: 'd1',
      competencia: '2026-10-01',
      status: 'pago',
      valorPrevisto: 2600,
      vencimento: '2026-10-12',
      formaPagamento: 'pix',
      valorPago: 2598.4,
      pagoEm: '2026-10-11',
      notaFiscal: 'NF 9',
      motivoDispensa: null,
      observacao: null,
      anexos: [],
      createdAt: '',
      updatedAt: '',
    };
    const ocorrencias = montarOcorrenciasDoMes([despesa({})], [pago], '2026-10-01', '2026-10-15');
    const aoa = linhasExportacaoMes(ocorrencias, nomeCategoria);
    expect(aoa[0]).toEqual(CABECALHOS_MES);
    expect(aoa[1]).toEqual(['out/2026', 'Microsoft 365', 'SaaS e Assinaturas', 'Microsoft', '12/10/2026', 2480.5, 2600, 2598.4, '11/10/2026', 'Paga', 'PIX', 'NF 9', '', '']);
  });
});
