import { describe, expect, it } from 'vitest';
import {
  CHAVE_OUTROS,
  FILTROS_FINOPS_VAZIOS,
  aPagar,
  agruparGasto,
  competenciasEntre,
  custoAnualizado,
  custoRecorrenteMensal,
  filtrarDespesasFinops,
  intervaloDeCarga,
  janelaEvolucao,
  medidaDoPeriodo,
  ocorrenciasNoPeriodo,
  periodoAnterior,
  periodoDoPreset,
  proporcoes,
  serieMensal,
  topComOutros,
  totaisDoPeriodo,
  variacaoPercentual,
} from './finops';
import type { Despesa, Lancamento } from '../types';

const HOJE = '2026-10-15';

const despesa = (campos: Partial<Despesa>): Despesa => ({
  id: 'x',
  descricao: 'Despesa',
  categoriaId: 'cat-saas',
  natureza: 'opex',
  quantidade: null,
  unidade: null,
  fornecedorId: null,
  fornecedorNome: 'Fornecedor',
  setor: 'TI',
  responsavelId: null,
  responsavelNome: null,
  tipoValor: 'fixo',
  valorBase: 100,
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

const pago = (despesaId: string, competencia: string, valorPago: number, campos: Partial<Lancamento> = {}): Lancamento => ({
  id: `${despesaId}-${competencia}`,
  despesaId,
  competencia,
  status: 'pago',
  valorPrevisto: valorPago,
  vencimento: `${competencia.slice(0, 8)}10`,
  formaPagamento: 'boleto',
  valorPago,
  pagoEm: `${competencia.slice(0, 8)}09`,
  notaFiscal: null,
  motivoDispensa: null,
  observacao: null,
  anexos: [],
  createdAt: '',
  updatedAt: '',
  ...campos,
});

describe('período', () => {
  it('presets', () => {
    expect(periodoDoPreset('mes', HOJE)).toEqual({ desde: '2026-10-01', ate: '2026-10-01' });
    expect(periodoDoPreset('trimestre', HOJE)).toEqual({ desde: '2026-10-01', ate: '2026-12-01' });
    expect(periodoDoPreset('trimestre', '2026-05-20')).toEqual({ desde: '2026-04-01', ate: '2026-06-01' });
    expect(periodoDoPreset('ano', HOJE)).toEqual({ desde: '2026-01-01', ate: '2026-12-01' });
    expect(periodoDoPreset('12meses', HOJE)).toEqual({ desde: '2025-11-01', ate: '2026-10-01' });
  });

  it('personalizado inválido cai nos 12 meses', () => {
    expect(periodoDoPreset('personalizado', HOJE, { desde: '2026-05-01', ate: '2026-03-01' })).toEqual({ desde: '2025-11-01', ate: '2026-10-01' });
    expect(periodoDoPreset('personalizado', HOJE, { desde: '2026-03-01', ate: '2026-05-01' })).toEqual({ desde: '2026-03-01', ate: '2026-05-01' });
  });

  it('período anterior tem o mesmo tamanho e termina antes', () => {
    expect(periodoAnterior({ desde: '2026-10-01', ate: '2026-12-01' })).toEqual({ desde: '2026-07-01', ate: '2026-09-01' });
    expect(periodoAnterior({ desde: '2026-01-01', ate: '2026-01-01' })).toEqual({ desde: '2025-12-01', ate: '2025-12-01' });
  });

  it('competências entre duas pontas, atravessando o ano', () => {
    expect(competenciasEntre('2026-11-01', '2027-02-01')).toEqual(['2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01']);
    expect(competenciasEntre('2026-11-01', '2026-10-01')).toEqual([]);
  });

  it('evolução: 12 meses até o fim do período, +3 de projeção quando termina no mês atual', () => {
    const doze = janelaEvolucao({ desde: '2025-11-01', ate: '2026-10-01' }, HOJE);
    expect(doze).toHaveLength(15);
    expect(doze[0]).toBe('2025-11-01');
    expect(doze[14]).toBe('2027-01-01');
    const ano = janelaEvolucao({ desde: '2026-01-01', ate: '2026-12-01' }, HOJE);
    expect(ano).toEqual(competenciasEntre('2026-01-01', '2026-12-01'));
    const mes = janelaEvolucao({ desde: '2026-10-01', ate: '2026-10-01' }, HOJE);
    expect(mes).toHaveLength(15);
  });

  it('a carga cobre o período anterior, a evolução e a janela de "a pagar", mais a margem das visões (11 antes, 3 depois)', () => {
    expect(intervaloDeCarga({ desde: '2026-01-01', ate: '2026-12-01' }, HOJE)).toEqual({ desde: '2024-02-01', ate: '2027-04-01' });
    expect(intervaloDeCarga({ desde: '2026-10-01', ate: '2026-10-01' }, HOJE)).toEqual({ desde: '2024-12-01', ate: '2027-04-01' });
  });
});

describe('filtros', () => {
  const despesas = [
    despesa({ id: 'a', categoriaId: 'cat-ia', fornecedorNome: 'Anthropic', natureza: 'opex', formaPagamento: 'cartao_corporativo' }),
    despesa({ id: 'b', categoriaId: 'cat-hw', fornecedorNome: 'Dell', natureza: 'capex', setor: 'Financeiro' }),
  ];

  it('sem filtro devolve tudo; cada filtro restringe', () => {
    expect(filtrarDespesasFinops(despesas, FILTROS_FINOPS_VAZIOS)).toHaveLength(2);
    expect(filtrarDespesasFinops(despesas, { ...FILTROS_FINOPS_VAZIOS, categoriaId: 'cat-ia' }).map((d) => d.id)).toEqual(['a']);
    expect(filtrarDespesasFinops(despesas, { ...FILTROS_FINOPS_VAZIOS, fornecedor: 'dell' }).map((d) => d.id)).toEqual(['b']);
    expect(filtrarDespesasFinops(despesas, { ...FILTROS_FINOPS_VAZIOS, natureza: 'capex' }).map((d) => d.id)).toEqual(['b']);
    expect(filtrarDespesasFinops(despesas, { ...FILTROS_FINOPS_VAZIOS, setor: 'Financeiro' }).map((d) => d.id)).toEqual(['b']);
    expect(filtrarDespesasFinops(despesas, { ...FILTROS_FINOPS_VAZIOS, formaPagamento: 'cartao_corporativo' }).map((d) => d.id)).toEqual(['a']);
  });
});

describe('totais e variação', () => {
  it('previsto sem dispensadas; realizado pelo valor pago', () => {
    const despesas = [despesa({ id: 'a', valorBase: 100 }), despesa({ id: 'b', valorBase: 50 }), despesa({ id: 'c', valorBase: 30 })];
    const lancamentos = [
      pago('a', '2026-09-01', 110, { valorPrevisto: 100 }),
      { ...pago('b', '2026-09-01', 0), status: 'dispensado' as const, valorPrevisto: 50, valorPago: null, pagoEm: null, motivoDispensa: 'carência' },
    ];
    const ocorrencias = ocorrenciasNoPeriodo(despesas, lancamentos, ['2026-09-01'], HOJE);
    // previsto: a (100) + c (30); b dispensada não entra. Realizado: o pago de a.
    expect(totaisDoPeriodo(ocorrencias)).toEqual({ previsto: 130, realizado: 110 });
  });

  it('variação percentual; base zero não tem variação', () => {
    expect(variacaoPercentual(120, 100)).toBe(20);
    expect(variacaoPercentual(80, 100)).toBe(-20);
    expect(variacaoPercentual(50, 0)).toBeNull();
  });
});

describe('custo recorrente e anualizado', () => {
  it('soma os equivalentes mensais das ativas; variável pela média dos 3 últimos pagos', () => {
    const despesas = [
      despesa({ id: 'mensal', valorBase: 1000 }),
      despesa({ id: 'anual', valorBase: 1200, recorrencia: 'anual', competenciaInicio: '2026-03-01' }),
      despesa({ id: 'aws', valorBase: 3000, tipoValor: 'variavel' }),
      despesa({ id: 'encerrada', valorBase: 999, competenciaFim: '2026-08-01' }),
      despesa({ id: 'futura', valorBase: 999, competenciaInicio: '2026-12-01' }),
      despesa({ id: 'unica', valorBase: 5000, recorrencia: 'unica', competenciaInicio: '2026-05-01' }),
    ];
    const lancamentos = [
      pago('aws', '2026-06-01', 9999), // fica fora: só os 3 mais recentes
      pago('aws', '2026-07-01', 3300),
      pago('aws', '2026-08-01', 3600),
      pago('aws', '2026-09-01', 3900),
      pago('aws', '2026-11-01', 9999), // depois do mês atual: não conta
    ];
    // 1000 + 1200/12 + média(3300, 3600, 3900) = 1000 + 100 + 3600
    expect(custoRecorrenteMensal(despesas, lancamentos, HOJE)).toBe(4700);
    expect(custoAnualizado(despesas, 4700, 2026)).toBe(4700 * 12 + 5000);
    expect(custoAnualizado(despesas, 4700, 2027)).toBe(4700 * 12);
  });

  it('variável sem pagamento usa o valor estimado (com reajuste)', () => {
    const d = despesa({ id: 'aws', tipoValor: 'variavel', valorBase: 3000, reajustes: [{ id: 'r', vigenteDesde: '2026-09-01', valor: 3500, motivo: 'outro', quantidade: null, observacao: null, createdAt: '' }] });
    expect(custoRecorrenteMensal([d], [], HOJE)).toBe(3500);
  });
});

describe('a pagar', () => {
  it('a vencer nos próximos 30 dias e vencidas sem baixa', () => {
    const despesas = [
      despesa({ id: 'venceu', diaVencimento: 5 }),
      despesa({ id: 'vence-dia-20', diaVencimento: 20 }),
      despesa({ id: 'paga', diaVencimento: 25 }),
    ];
    const ocorrencias = ocorrenciasNoPeriodo(despesas, [pago('paga', '2026-10-01', 100)], ['2026-10-01', '2026-11-01'], HOJE);
    // Hoje 15/10, limite 14/11. Out: 05/10 vencida; 20/10 a vencer (entra); a de 25/10 está paga.
    // Nov: 05/11 entra; 20/11 e 25/11 passam do limite.
    expect(aPagar(ocorrencias, HOJE, 30)).toEqual({ total: 200, quantidade: 2, vencidasTotal: 100, vencidasQuantidade: 1 });
  });
});

describe('série mensal', () => {
  it('realizado até o mês atual, previsto depois; da 9ª categoria em diante em Outros', () => {
    const despesas = [despesa({ id: 'a', categoriaId: 'cat-ia', valorBase: 100 }), despesa({ id: 'b', categoriaId: 'cat-nona', valorBase: 40 })];
    const meses = ['2026-09-01', '2026-10-01', '2026-11-01'];
    const ocorrencias = ocorrenciasNoPeriodo(despesas, [pago('a', '2026-09-01', 110), pago('b', '2026-10-01', 45)], meses, HOJE);
    const serie = serieMensal(ocorrencias, meses, HOJE, (id) => (id === 'cat-nona' ? CHAVE_OUTROS : id));
    expect(serie).toEqual([
      { competencia: '2026-09-01', projecao: false, total: 110, valores: { 'cat-ia': 110 } },
      { competencia: '2026-10-01', projecao: false, total: 45, valores: { [CHAVE_OUTROS]: 45 } },
      { competencia: '2026-11-01', projecao: true, total: 140, valores: { 'cat-ia': 100, [CHAVE_OUTROS]: 40 } },
    ]);
  });
});

describe('quebras', () => {
  const despesas = [
    despesa({ id: 'a', fornecedorNome: 'Microsoft', valorBase: 500 }),
    despesa({ id: 'b', fornecedorNome: 'Amazon', valorBase: 300 }),
    despesa({ id: 'c', fornecedorNome: 'Anthropic', valorBase: 200, recorrencia: 'unica', competenciaInicio: '2026-09-01', natureza: 'capex' }),
  ];
  const ocorrencias = ocorrenciasNoPeriodo(
    despesas,
    [pago('a', '2026-09-01', 500), pago('b', '2026-09-01', 300), pago('c', '2026-09-01', 200)],
    ['2026-09-01'],
    HOJE,
  );

  it('agrupa do maior para o menor com % e % acumulado', () => {
    const grupos = agruparGasto(ocorrencias, (o) => ({ chave: o.despesa.fornecedorNome, nome: o.despesa.fornecedorNome }), 'realizado');
    expect(grupos.map((g) => [g.nome, g.valor, g.percentual, g.acumulado])).toEqual([
      ['Microsoft', 500, 50, 50],
      ['Amazon', 300, 30, 80],
      ['Anthropic', 200, 20, 100],
    ]);
  });

  it('top N com o resto em Outros', () => {
    const grupos = agruparGasto(ocorrencias, (o) => ({ chave: o.despesa.fornecedorNome, nome: o.despesa.fornecedorNome }), 'realizado');
    expect(topComOutros(grupos, 1).map((g) => [g.chave, g.nome, g.valor, g.percentual])).toEqual([
      ['Microsoft', 'Microsoft', 500, 50],
      [CHAVE_OUTROS, 'Outros (2)', 500, 50],
    ]);
    expect(topComOutros(grupos, 5)).toHaveLength(3);
  });

  it('medida: realizado quando há pagamento, senão previsto', () => {
    expect(medidaDoPeriodo({ previsto: 100, realizado: 10 })).toBe('realizado');
    expect(medidaDoPeriodo({ previsto: 100, realizado: 0 })).toBe('previsto');
  });

  it('proporções recorrente × pontual e OPEX × CAPEX', () => {
    expect(proporcoes(ocorrencias, 'realizado')).toEqual({ recorrente: 800, pontual: 200, opex: 800, capex: 200 });
  });
});
