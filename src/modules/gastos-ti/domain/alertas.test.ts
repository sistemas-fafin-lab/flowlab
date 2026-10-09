import { describe, expect, it } from 'vitest';
import { calcularAlertas, diasAte, ordenarAlertas, renovacoesProximas, terminoDaDespesa, type Alerta } from './alertas';
import { ocorrenciasNoPeriodo } from './finops';
import type { Despesa, Lancamento } from '../types';

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
  id: 'l',
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

const tipos = (despesas: Despesa[], lancamentos: Lancamento[], meses: string[]) =>
  calcularAlertas(ocorrenciasNoPeriodo(despesas, lancamentos, meses, HOJE), despesas, HOJE).map((a) => [a.tipo, a.severidade, a.despesaId]);

describe('datas', () => {
  it('dias até uma data, negativo se já passou', () => {
    expect(diasAte(HOJE, '2026-10-15')).toBe(0);
    expect(diasAte(HOJE, '2026-11-14')).toBe(30);
    expect(diasAte(HOJE, '2026-10-01')).toBe(-14);
  });

  it('término é o último dia da competência final; sem fim ou única não termina', () => {
    expect(terminoDaDespesa(despesa({ competenciaFim: '2026-11-01' }))).toBe('2026-11-30');
    expect(terminoDaDespesa(despesa({ competenciaFim: '2027-02-01' }))).toBe('2027-02-28');
    expect(terminoDaDespesa(despesa({}))).toBeNull();
    expect(terminoDaDespesa(despesa({ recorrencia: 'unica', competenciaFim: null }))).toBeNull();
  });
});

describe('renovacoesProximas', () => {
  it('lista as que terminam nos próximos 90 dias, da mais próxima para a mais distante', () => {
    const despesas = [
      despesa({ id: 'dez', competenciaFim: '2026-12-01', valorBase: 100 }), // 31/12: 77 dias
      despesa({ id: 'out', competenciaFim: '2026-10-01', renovacaoAutomatica: true, recorrencia: 'anual', valorBase: 1200 }), // 31/10: 16 dias
      despesa({ id: 'longe', competenciaFim: '2027-03-01' }), // 31/03/2027: mais de 90 dias
      despesa({ id: 'passou', competenciaFim: '2026-09-01' }),
      despesa({ id: 'sem-fim' }),
    ];
    const r = renovacoesProximas(despesas, HOJE);
    expect(r.map((x) => [x.despesa.id, x.dias, x.anualizado, x.automatica])).toEqual([
      ['out', 16, 1200, true],
      ['dez', 77, 1200, false],
    ]);
  });
});

describe('calcularAlertas (§8.4)', () => {
  it('cobrança vencida sem baixa é alerta alto', () => {
    expect(tipos([despesa({ id: 'v', diaVencimento: 5 })], [], ['2026-10-01'])).toEqual([['vencida', 'alta', 'v']]);
  });

  it('pago acima do previsto ORIGINAL além da tolerância (10%) é alerta médio, mesmo com a previsão ajustada', () => {
    const d = despesa({ id: 'aws' });
    expect(tipos([d], [lancamento({ despesaId: 'aws', valorPago: 1150 })], ['2026-09-01'])).toEqual([['acima_do_previsto', 'media', 'aws']]);
    // dentro da tolerância: sem alerta
    expect(tipos([d], [lancamento({ despesaId: 'aws', valorPago: 1100 })], ['2026-09-01'])).toEqual([]);
    // previsão ajustada para 1200 no mês não esconde o desvio contra os 1000 contratados
    expect(tipos([d], [lancamento({ despesaId: 'aws', valorPrevisto: 1200, valorPago: 1150 })], ['2026-09-01'])).toEqual([['acima_do_previsto', 'media', 'aws']]);
  });

  it('renovação dentro da antecedência: manual é alta, automática é média; fora da antecedência, nada', () => {
    const manual = despesa({ id: 'manual', competenciaFim: '2026-10-01', avisoRenovacaoDias: 30 }); // 16 dias
    const automatica = despesa({ id: 'auto', competenciaFim: '2026-10-01', renovacaoAutomatica: true, avisoRenovacaoDias: 30 });
    const longe = despesa({ id: 'longe', competenciaFim: '2026-12-01', avisoRenovacaoDias: 30 }); // 77 dias > 30
    const avisoLongo = despesa({ id: 'aviso-90', competenciaFim: '2026-12-01', avisoRenovacaoDias: 90 });
    const r = calcularAlertas([], [manual, automatica, longe, avisoLongo], HOJE).map((a) => [a.tipo, a.severidade, a.despesaId]);
    expect(r).toEqual([
      ['renovacao_manual', 'alta', 'manual'],
      ['renovacao_manual', 'alta', 'aviso-90'],
      ['renovacao_automatica', 'media', 'auto'],
    ]);
  });

  it('lançamento fora da recorrência é alerta baixo', () => {
    const d = despesa({ id: 't', recorrencia: 'trimestral', competenciaInicio: '2026-07-01' });
    expect(tipos([d], [lancamento({ despesaId: 't', competencia: '2026-08-01', vencimento: '2026-08-10' })], ['2026-08-01'])).toEqual([
      ['fora_da_recorrencia', 'baixa', 't'],
    ]);
  });

  it('ordena por severidade e, dentro dela, pela data mais urgente', () => {
    const despesas = [
      despesa({ id: 'vencida-cedo', diaVencimento: 2 }),
      despesa({ id: 'vencida-tarde', diaVencimento: 8 }),
      despesa({ id: 'auto', competenciaFim: '2026-10-01', renovacaoAutomatica: true, diaVencimento: 25 }),
    ];
    expect(tipos(despesas, [], ['2026-10-01']).map(([tipo, , id]) => `${tipo}:${id}`)).toEqual([
      'vencida:vencida-cedo',
      'vencida:vencida-tarde',
      'renovacao_automatica:auto',
    ]);
  });

  it('sem nada pendente, nenhuma alerta', () => {
    expect(tipos([despesa({ id: 'ok', diaVencimento: 25 })], [], ['2026-10-01'])).toEqual([]);
  });
});

describe('ordenarAlertas', () => {
  const alerta = (chave: string, severidade: Alerta['severidade'], data: string): Alerta => ({
    chave,
    tipo: 'orcamento',
    severidade,
    despesaId: '',
    titulo: chave,
    detalhe: '',
    data,
  });

  it('junta listas mantendo severidade primeiro e, dentro dela, a data mais urgente', () => {
    const doMes = [alerta('vencida', 'alta', '2026-10-05'), alerta('fora', 'baixa', '2026-09-01')];
    const doOrcamento = [alerta('orc-estourado', 'alta', '2026-12-31'), alerta('orc-90', 'media', '2026-12-31')];
    expect(ordenarAlertas([...doMes, ...doOrcamento]).map((a) => a.chave)).toEqual(['vencida', 'orc-estourado', 'orc-90', 'fora']);
  });
});
