import { describe, expect, it } from 'vitest';
import { periodosComparativos } from './comparativos';
import { montarSlaFaturamento, type LinhaSlaRequisicao } from './slaFaturamento';

const periodos = periodosComparativos('2026-10')!;

/** Requisição com todos os marcos, faturada em 20/10/2026. Os testes sobrescrevem o que importa. */
function linha(parcial: Partial<LinhaSlaRequisicao> = {}): LinhaSlaRequisicao {
  return {
    idRequisicao: 1,
    fontePagadoraId: 10,
    nome: 'BRADESCO',
    admissao: '2026-10-01 08:00',
    solicitacao: '2026-10-01',
    envioFaturamento: '2026-10-03 08:00',
    recebidoFaturamento: '2026-10-04 08:00',
    fechamentoLote: '2026-10-20 08:00',
    criacaoLote: '2026-10-15 08:00',
    recebimento: null,
    ...parcial,
  };
}

const mesDe = (resultado: ReturnType<typeof montarSlaFaturamento>, mes: string) => resultado.find((m) => m.mes === mes)!;

describe('montarSlaFaturamento', () => {
  it('média de dias de cada etapa por convênio, no mês em que a requisição foi faturada', () => {
    const resultado = montarSlaFaturamento(periodos, [
      linha({ idRequisicao: 1, envioFaturamento: '2026-10-03 08:00' }), // 2 dias
      linha({ idRequisicao: 2, envioFaturamento: '2026-10-05 08:00' }), // 4 dias
    ]);

    const outubro = mesDe(resultado, '2026-10');
    expect(outubro.convenios).toHaveLength(1);
    expect(outubro.convenios[0]).toMatchObject({ fontePagadoraId: 10, nome: 'BRADESCO', qtdRequisicoes: 2 });
    expect(outubro.convenios[0].cadastroEnvio).toMatchObject({ mediaDias: 3, qtd: 2, descartados: 0 });
  });

  it('envio → recebido no faturamento e recebido → faturado (fechamento do lote)', () => {
    const [outubro] = montarSlaFaturamento(periodos, [linha()]);
    expect(outubro.convenios[0].envioRecebido).toMatchObject({ mediaDias: 1, qtd: 1 });
    expect(outubro.convenios[0].recebidoFaturado).toMatchObject({ mediaDias: 16, qtd: 1 });
  });

  it('sem evento Admissão, o cadastro é a data de solicitação, e a tela sabe quantas usaram o fallback', () => {
    const [outubro] = montarSlaFaturamento(periodos, [
      linha({ admissao: null, solicitacao: '2026-09-30', envioFaturamento: '2026-10-03 00:00' }),
    ]);
    expect(outubro.convenios[0].cadastroEnvio).toMatchObject({ mediaDias: 3, qtd: 1 });
    expect(outubro.convenios[0].fallbacks.cadastroPelaSolicitacao).toBe(1);
  });

  it('lote sem fechamento usa a criação, tanto para o mês quanto para o recebido → faturado', () => {
    const resultado = montarSlaFaturamento(periodos, [
      linha({ fechamentoLote: null, criacaoLote: '2026-09-10 08:00', recebidoFaturamento: '2026-09-04 08:00' }),
    ]);
    expect(mesDe(resultado, '2026-10').convenios).toHaveLength(0);
    const setembro = mesDe(resultado, '2026-09').convenios[0];
    expect(setembro.recebidoFaturado).toMatchObject({ mediaDias: 6, qtd: 1 });
    expect(setembro.fallbacks.faturadoPelaCriacao).toBe(1);
  });

  it('intervalo negativo (recebido antes do envio) sai da média e é contado à parte', () => {
    const [outubro] = montarSlaFaturamento(periodos, [
      linha({ idRequisicao: 1, envioFaturamento: '2026-10-03 08:00', recebidoFaturamento: '2026-10-05 08:00' }), // 2 dias
      linha({ idRequisicao: 2, envioFaturamento: '2026-10-06 08:00', recebidoFaturamento: '2026-10-04 08:00' }), // −2
    ]);
    expect(outubro.convenios[0].envioRecebido).toEqual({ mediaDias: 2, medianaDias: 2, qtd: 1, descartados: 1 });
  });

  it('convênio sem o marco numa etapa fica sem média (null), sem quebrar as outras etapas', () => {
    const [outubro] = montarSlaFaturamento(periodos, [linha({ envioFaturamento: null })]);
    const convenio = outubro.convenios[0];
    expect(convenio.cadastroEnvio).toEqual({ mediaDias: null, medianaDias: null, qtd: 0, descartados: 0 });
    expect(convenio.envioRecebido.mediaDias).toBeNull();
    expect(convenio.recebidoFaturado).toMatchObject({ mediaDias: 16, qtd: 1 });
  });

  it('média e mediana arredondadas em 1 casa; mediana de quantidade par é a média dos dois do meio', () => {
    const [outubro] = montarSlaFaturamento(periodos, [
      linha({ idRequisicao: 1, envioFaturamento: '2026-10-02 08:00' }), // 1
      linha({ idRequisicao: 2, envioFaturamento: '2026-10-03 08:00' }), // 2
      linha({ idRequisicao: 3, envioFaturamento: '2026-10-03 16:00' }), // 2,333…
      linha({ idRequisicao: 4, envioFaturamento: '2026-10-11 08:00' }), // 10
    ]);
    expect(outubro.convenios[0].cadastroEnvio).toEqual({ mediaDias: 3.8, medianaDias: 2.2, qtd: 4, descartados: 0 });
  });

  it('liquidação: faturado → recebido só das requisições já recebidas, em dias de calendário, com o % já recebido', () => {
    const [outubro] = montarSlaFaturamento(periodos, [
      linha({ idRequisicao: 1, recebimento: '2026-11-19' }), // 30 dias depois de 20/10
      linha({ idRequisicao: 2, recebimento: '2026-11-29' }), // 40
      linha({ idRequisicao: 3, recebimento: null }),
      linha({ idRequisicao: 4, recebimento: null }),
    ]);
    expect(outubro.convenios[0].liquidacao).toEqual({
      mediaDias: 35,
      medianaDias: 35,
      qtd: 2,
      descartados: 0,
      qtdRecebidas: 2,
      percentualRecebido: 50,
    });
  });

  it('liquidação: recebido no mesmo dia do fechamento conta 0 dias; antes do faturado é descartado', () => {
    const [outubro] = montarSlaFaturamento(periodos, [
      linha({ idRequisicao: 1, fechamentoLote: '2026-10-20 17:30', recebimento: '2026-10-20' }),
      linha({ idRequisicao: 2, recebimento: '2026-10-19' }),
      linha({ idRequisicao: 3, recebimento: null }),
    ]);
    expect(outubro.convenios[0].liquidacao).toEqual({
      mediaDias: 0,
      medianaDias: 0,
      qtd: 1,
      descartados: 1,
      qtdRecebidas: 2,
      percentualRecebido: 66.7,
    });
  });

  it('o total do mês junta as requisições de todos os convênios (não é média das médias)', () => {
    const [outubro] = montarSlaFaturamento(periodos, [
      linha({ idRequisicao: 1, fontePagadoraId: 10, envioFaturamento: '2026-10-02 08:00' }), // 1
      linha({ idRequisicao: 2, fontePagadoraId: 20, nome: 'PMDF', envioFaturamento: '2026-10-03 08:00' }), // 2
      linha({ idRequisicao: 3, fontePagadoraId: 20, nome: 'PMDF', envioFaturamento: '2026-10-07 08:00' }), // 6
    ]);
    expect(outubro.total.qtdRequisicoes).toBe(3);
    expect(outubro.total.cadastroEnvio).toMatchObject({ mediaDias: 3, qtd: 3 });
  });

  it('convênios ordenados pelo número de requisições (maior primeiro) e, no empate, pelo nome', () => {
    const [outubro] = montarSlaFaturamento(periodos, [
      linha({ idRequisicao: 1, fontePagadoraId: 30, nome: 'CASSI' }),
      linha({ idRequisicao: 2, fontePagadoraId: 20, nome: 'PMDF' }),
      linha({ idRequisicao: 3, fontePagadoraId: 20, nome: 'PMDF' }),
      linha({ idRequisicao: 4, fontePagadoraId: 10, nome: 'BRADESCO' }),
    ]);
    expect(outubro.convenios.map((c) => c.nome)).toEqual(['PMDF', 'BRADESCO', 'CASSI']);
  });

  it('mês sem requisição faturada aparece com total vazio e sem convênios', () => {
    const resultado = montarSlaFaturamento(periodos, [linha()]);
    expect(resultado.map((m) => m.mes)).toEqual(['2026-10', '2026-09', '2026-08']);
    const agosto = mesDe(resultado, '2026-08');
    expect(agosto.convenios).toEqual([]);
    expect(agosto.total.qtdRequisicoes).toBe(0);
    expect(agosto.total.liquidacao.percentualRecebido).toBeNull();
  });

  it('requisição faturada fora dos 3 meses não entra', () => {
    const resultado = montarSlaFaturamento(periodos, [linha({ fechamentoLote: '2026-07-31 23:00' })]);
    expect(resultado.every((m) => m.convenios.length === 0)).toBe(true);
  });
});
