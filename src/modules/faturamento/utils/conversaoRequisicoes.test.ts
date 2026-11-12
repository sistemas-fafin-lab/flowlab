import { describe, expect, it } from 'vitest';
import { periodosComparativos } from './comparativos';
import { montarConversaoRequisicoes, type LinhaConversaoRequisicao } from './conversaoRequisicoes';

const PERIODOS = periodosComparativos('2026-10')!;

let proximoId = 1;
function req(campos: Partial<LinhaConversaoRequisicao> = {}): LinhaConversaoRequisicao {
  return {
    idRequisicao: proximoId++,
    mes: '2026-10',
    fontePagadoraId: 10,
    nome: 'BRADESCO',
    codEvento: null,
    temProcedimento: true,
    temLote: true,
    statusLote: 2,
    temRpsAtivo: false,
    ...campos,
  };
}

describe('montarConversaoRequisicoes', () => {
  it('conta como apta só a requisição de convênio cobrável, com evento cobrável e com procedimento', () => {
    const { totais } = montarConversaoRequisicoes(PERIODOS, [
      req(),
      req({ fontePagadoraId: 1102, nome: 'PARTICULAR' }),
      req({ fontePagadoraId: 100, nome: 'CORTESIA' }),
      req({ codEvento: 8 }),
      req({ codEvento: 1040 }),
      req({ temProcedimento: false }),
      req({ codEvento: 26 }),
    ]);

    expect(totais[0]).toEqual({ mes: '2026-10', aptas: 2, faturadas: 2, semLote: 0, percentual: 100 });
  });

  it('não conta como faturada a apta em lote cancelado ou em prejuízo', () => {
    const { totais } = montarConversaoRequisicoes(PERIODOS, [
      req(),
      req({ statusLote: 5 }),
      req({ statusLote: 8 }),
      req({ temLote: false, statusLote: null }),
    ]);

    expect(totais[0]).toEqual({ mes: '2026-10', aptas: 4, faturadas: 1, semLote: 3, percentual: 25 });
  });

  it('conta como faturada a apta sem lote já cobrada por RPS ativo, como a sub-aba "Sem lote"', () => {
    const { totais } = montarConversaoRequisicoes(PERIODOS, [
      req({ temLote: false, statusLote: null, temRpsAtivo: true }),
      req({ temLote: false, statusLote: null }),
    ]);

    expect(totais[0]).toMatchObject({ aptas: 2, faturadas: 1, semLote: 1 });
  });

  it('dá % nulo (e não 0) ao convênio sem aptas no mês, e ignora requisição fora dos 3 meses', () => {
    const { totais, convenios } = montarConversaoRequisicoes(PERIODOS, [
      req({ mes: '2026-09', fontePagadoraId: 20, nome: 'PMDF' }),
      req({ mes: '2026-09', fontePagadoraId: 20, nome: 'PMDF', temLote: false, statusLote: null }),
      req({ mes: '2026-07', fontePagadoraId: 20, nome: 'PMDF' }),
    ]);

    expect(totais.map((t) => t.aptas)).toEqual([0, 2, 0]);
    expect(totais[0].percentual).toBeNull();
    expect(convenios).toEqual([
      {
        fontePagadoraId: 20,
        nome: 'PMDF',
        meses: [
          { mes: '2026-10', aptas: 0, faturadas: 0, semLote: 0, percentual: null },
          { mes: '2026-09', aptas: 2, faturadas: 1, semLote: 1, percentual: 50 },
          { mes: '2026-08', aptas: 0, faturadas: 0, semLote: 0, percentual: null },
        ],
      },
    ]);
  });

  it('ordena os convênios pelas aptas do mês de referência', () => {
    const { convenios } = montarConversaoRequisicoes(PERIODOS, [
      req({ fontePagadoraId: 10, nome: 'BRADESCO' }),
      ...[1, 2, 3].map(() => req({ fontePagadoraId: 30, nome: 'AMHP-DF' })),
      req({ fontePagadoraId: 30, nome: 'AMHP-DF', temLote: false, statusLote: null }),
      ...[1, 2, 3, 4, 5].map(() => req({ mes: '2026-08', fontePagadoraId: 10, nome: 'BRADESCO' })),
      req({ fontePagadoraId: 1102, nome: 'PARTICULAR' }),
    ]);

    expect(convenios.map((c) => c.nome)).toEqual(['AMHP-DF', 'BRADESCO']);
    expect(convenios[0].meses[0]).toEqual({ mes: '2026-10', aptas: 4, faturadas: 3, semLote: 1, percentual: 75 });
  });

  it('arredonda o % de conversão em 1 casa', () => {
    const { totais } = montarConversaoRequisicoes(PERIODOS, [
      req(),
      req(),
      req({ temLote: false, statusLote: null }),
    ]);

    expect(totais[0].percentual).toBe(66.7);
  });

  it('não arredonda para 100% enquanto houver apta sem lote', () => {
    const linhas = Array.from({ length: 3174 }, (_, i) => req(i === 0 ? { temLote: false, statusLote: null } : {}));
    const { totais } = montarConversaoRequisicoes(PERIODOS, linhas);

    expect(totais[0]).toMatchObject({ semLote: 1, percentual: 99.9 });
  });
});
