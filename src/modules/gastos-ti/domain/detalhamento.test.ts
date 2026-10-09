import { describe, expect, it } from 'vitest';
import { custoUnitario, economiasDeRenegociacao, faixaSequencial, maioresDesvios, mapaDeCalor } from './detalhamento';
import { ocorrenciasNoPeriodo } from './finops';
import type { Despesa, Lancamento, Reajuste } from '../types';

const HOJE = '2026-10-15';

const despesa = (campos: Partial<Despesa>): Despesa => ({
  id: 'x',
  descricao: 'Despesa',
  categoriaId: 'cat',
  natureza: 'opex',
  quantidade: null,
  unidade: null,
  fornecedorId: null,
  fornecedorNome: 'Fornecedor',
  setor: null,
  responsavelId: null,
  responsavelNome: null,
  tipoValor: 'fixo',
  valorBase: 1000,
  recorrencia: 'mensal',
  competenciaInicio: '2026-01-01',
  competenciaFim: null,
  diaVencimento: 10,
  formaPagamento: 'boleto',
  meioPagamentoDetalhe: null,
  moedaOriginal: null,
  valorOriginal: null,
  numeroContrato: null,
  renovacaoAutomatica: false,
  avisoRenovacaoDias: 30,
  autorizadoPor: 'Diretoria',
  autorizadoEm: null,
  observacoes: null,
  anexos: [],
  reajustes: [],
  createdAt: '',
  updatedAt: '',
  ...campos,
});

const lancamento = (campos: Partial<Lancamento>): Lancamento => ({
  id: `l-${campos.despesaId}-${campos.competencia}`,
  despesaId: 'x',
  competencia: '2026-09-01',
  status: 'pago',
  valorPrevisto: 1000,
  vencimento: '2026-09-10',
  formaPagamento: 'boleto',
  valorPago: 1000,
  pagoEm: '2026-09-09',
  notaFiscal: null,
  motivoDispensa: null,
  observacao: null,
  anexos: [],
  createdAt: '',
  updatedAt: '',
  ...campos,
});

const reajuste = (campos: Partial<Reajuste>): Reajuste => ({
  id: `r-${campos.vigenteDesde}`,
  vigenteDesde: '2026-06-01',
  valor: 1000,
  motivo: 'reajuste_contratual',
  quantidade: null,
  observacao: null,
  createdAt: '',
  ...campos,
});

const nomes: Record<string, string> = { ia: 'Inteligência Artificial', cloud: 'Cloud' };
const nomeCategoria = (id: string) => nomes[id] ?? id;

describe('mapaDeCalor', () => {
  const despesas = [
    despesa({ id: 'gpt', categoriaId: 'ia', valorBase: 1000 }),
    despesa({ id: 'aws', categoriaId: 'cloud', valorBase: 500 }),
  ];
  const lancamentos = [
    lancamento({ despesaId: 'gpt', competencia: '2026-08-01', valorPrevisto: 1000, valorPago: 1000 }),
    lancamento({ despesaId: 'gpt', competencia: '2026-09-01', valorPrevisto: 1000, valorPago: 1200 }),
    lancamento({ despesaId: 'aws', competencia: '2026-09-01', valorPrevisto: 500, valorPago: 500 }),
    // Fora da janela: não entra.
    lancamento({ despesaId: 'aws', competencia: '2026-07-01', valorPrevisto: 500, valorPago: 9999 }),
  ];
  const meses = ['2026-08-01', '2026-09-01', '2026-10-01'];

  it('soma o pago por categoria × mês, da categoria que mais gastou para a que menos', () => {
    const mapa = mapaDeCalor(ocorrenciasNoPeriodo(despesas, lancamentos, meses, HOJE), meses, nomeCategoria);
    expect(mapa.meses).toEqual(meses);
    expect(mapa.linhas.map((l) => [l.nome, l.valores, l.total])).toEqual([
      ['Inteligência Artificial', [1000, 1200, 0], 2200],
      ['Cloud', [0, 500, 0], 500],
    ]);
    expect(mapa.maximo).toBe(1200);
  });

  it('sem pagamento, nenhuma linha e máximo zero', () => {
    const mapa = mapaDeCalor(ocorrenciasNoPeriodo(despesas, [], meses, HOJE), meses, nomeCategoria);
    expect(mapa.linhas).toEqual([]);
    expect(mapa.maximo).toBe(0);
  });
});

describe('faixaSequencial', () => {
  it('zero fica neutro; o resto vai do mais claro (0) ao mais escuro (6)', () => {
    expect(faixaSequencial(0, 100)).toBeNull();
    expect(faixaSequencial(50, 0)).toBeNull();
    expect(faixaSequencial(1, 100)).toBe(0);
    expect(faixaSequencial(50, 100)).toBe(3);
    expect(faixaSequencial(99.9, 100)).toBe(6);
    expect(faixaSequencial(100, 100)).toBe(6);
  });
});

describe('maioresDesvios', () => {
  const despesas = [
    despesa({ id: 'acima', descricao: 'Acima', valorBase: 1000 }),
    despesa({ id: 'abaixo', descricao: 'Abaixo', valorBase: 500 }),
    despesa({ id: 'exata', descricao: 'Exata', valorBase: 200 }),
    despesa({ id: 'tri', descricao: 'Trimestral', recorrencia: 'trimestral', competenciaInicio: '2026-07-01', valorBase: 300 }),
  ];
  const lancamentos = [
    // Previsão ajustada para cima no mês: o desvio contra o ORIGINAL continua aparecendo (RN11).
    lancamento({ despesaId: 'acima', competencia: '2026-08-01', valorPrevisto: 1300, valorPago: 1300 }),
    lancamento({ despesaId: 'acima', competencia: '2026-09-01', valorPrevisto: 1000, valorPago: 1000 }),
    lancamento({ despesaId: 'abaixo', competencia: '2026-09-01', valorPrevisto: 500, valorPago: 400 }),
    lancamento({ despesaId: 'exata', competencia: '2026-09-01', valorPrevisto: 200, valorPago: 200 }),
    // Agosto não é mês de cobrança da trimestral: fora da recorrência, fica de fora.
    lancamento({ despesaId: 'tri', competencia: '2026-08-01', valorPrevisto: 300, valorPago: 999 }),
  ];
  const ocorrencias = ocorrenciasNoPeriodo(despesas, lancamentos, ['2026-08-01', '2026-09-01'], HOJE);

  it('compara o pago com o previsto original, do maior desvio absoluto para o menor', () => {
    expect(maioresDesvios(ocorrencias).map((d) => [d.despesaId, d.previstoOriginal, d.previstoAjustado, d.pago, d.desvio, d.percentual, d.cobrancas])).toEqual([
      ['acima', 2000, 2300, 2300, 300, 15, 2],
      ['abaixo', 500, 500, 400, -100, -20, 1],
    ]);
  });

  it('respeita o limite', () => {
    expect(maioresDesvios(ocorrencias, 1).map((d) => d.despesaId)).toEqual(['acima']);
  });

  it('marca despesa variável, em que o previsto é estimativa', () => {
    const variavel = despesa({ id: 'var', tipoValor: 'variavel', valorBase: 100 });
    const oc = ocorrenciasNoPeriodo([variavel], [lancamento({ despesaId: 'var', competencia: '2026-09-01', valorPrevisto: 100, valorPago: 180 })], ['2026-09-01'], HOJE);
    expect(maioresDesvios(oc)[0]).toMatchObject({ despesaId: 'var', variavel: true, desvio: 80 });
  });
});

describe('custoUnitario', () => {
  const despesas = [
    despesa({
      id: 'licencas',
      descricao: 'Licenças',
      competenciaInicio: '2025-01-01',
      quantidade: 10,
      unidade: 'licença',
      valorBase: 1000,
      reajustes: [reajuste({ vigenteDesde: '2026-06-01', valor: 1500, quantidade: 12, motivo: 'mudanca_quantidade' })],
    }),
    despesa({ id: 'anual', descricao: 'Anual', recorrencia: 'anual', competenciaInicio: '2026-03-01', quantidade: 20, valorBase: 12000 }),
    despesa({ id: 'nova', descricao: 'Nova', competenciaInicio: '2026-10-01', quantidade: 3, valorBase: 300 }),
    despesa({ id: 'sem-qtd', descricao: 'Sem quantidade', valorBase: 5000 }),
    despesa({ id: 'encerrada', descricao: 'Encerrada', quantidade: 5, competenciaFim: '2026-08-01', valorBase: 5000 }),
    despesa({ id: 'unica', descricao: 'Notebooks', recorrencia: 'unica', competenciaInicio: '2026-10-01', quantidade: 4, valorBase: 20000 }),
  ];

  it('só recorrentes ativas com quantidade, pelo custo mensal, com a variação desde janeiro', () => {
    expect(custoUnitario(despesas, HOJE).map((c) => [c.despesa.id, c.unidade, c.quantidade, c.mensal, c.unitario, c.unitarioInicio, c.variacao])).toEqual([
      ['licencas', 'licença', 12, 1500, 125, 100, 25],
      // Começou em março: a base é março, não janeiro.
      ['anual', 'unidade', 20, 1000, 50, 50, 0],
      // Começou neste mês: não há com o que comparar.
      ['nova', 'unidade', 3, 300, 100, null, null],
    ]);
  });
});

describe('economiasDeRenegociacao', () => {
  const despesas = [
    despesa({ id: 'mensal', valorBase: 1000, reajustes: [reajuste({ vigenteDesde: '2026-05-01', valor: 800, motivo: 'renegociacao' })] }),
    despesa({
      id: 'anual',
      recorrencia: 'anual',
      competenciaInicio: '2025-07-01',
      valorBase: 12000,
      reajustes: [reajuste({ vigenteDesde: '2026-07-01', valor: 10800, motivo: 'renegociacao' })],
    }),
    despesa({ id: 'contratual', valorBase: 500, reajustes: [reajuste({ vigenteDesde: '2026-04-01', valor: 400, motivo: 'reajuste_contratual' })] }),
    despesa({ id: 'subiu', valorBase: 500, reajustes: [reajuste({ vigenteDesde: '2026-06-01', valor: 600, motivo: 'renegociacao' })] }),
    despesa({
      id: 'antiga',
      competenciaInicio: '2024-01-01',
      valorBase: 1000,
      reajustes: [reajuste({ vigenteDesde: '2025-03-01', valor: 900, motivo: 'renegociacao' })],
    }),
    // A base da economia é o valor vigente logo antes (já com o reajuste contratual de fevereiro).
    despesa({
      id: 'encadeada',
      valorBase: 1000,
      reajustes: [
        reajuste({ vigenteDesde: '2026-02-01', valor: 1100, motivo: 'reajuste_contratual' }),
        reajuste({ vigenteDesde: '2026-08-01', valor: 1000, motivo: 'renegociacao' }),
      ],
    }),
  ];

  it('só renegociações que baixaram o valor, no período, anualizadas pelo ciclo', () => {
    expect(economiasDeRenegociacao(despesas, '2025-11-01', '2026-10-01').map((e) => [e.despesa.id, e.anterior, e.novo, e.anualizada])).toEqual([
      ['mensal', 1000, 800, 2400],
      ['anual', 12000, 10800, 1200],
      ['encadeada', 1100, 1000, 1200],
    ]);
  });
});
