import { describe, expect, it } from 'vitest';
import { cardsGlosaSaldo, mesesDoPeriodo } from './cardsGlosaSaldo';
import { montarFunilGlosa, type ClasseGlosaFunil, type LoteRef, type TituloFunil } from './funilGlosa';
import { periodosComparativos } from './comparativos';

const L1: LoteRef = { id: 'lote-1', codigo: '1001' };
const L2: LoteRef = { id: 'lote-2', codigo: '1002' };

function titulo(parcial: Partial<TituloFunil> & Pick<TituloFunil, 'idNota' | 'dataEmissao'>): TituloFunil {
  return { valorTotal: 0, valorRecebido: 0, valorGlosaAcatada: 0, lotes: [], ...parcial };
}
const glosa = (lote: LoteRef | null, classe: ClasseGlosaFunil, valor: number, competencia = '2026-10') => ({
  lote, classe, valor, competencia,
});

const OUTUBRO = { desde: '2026-10-01', ate: '2026-10-31' };

describe('cardsGlosaSaldo', () => {
  it('Saldo pendente = Faturado − Recebido − Acatado dos títulos emitidos no período', () => {
    const titulos = [
      titulo({ idNota: 'n1', dataEmissao: '2026-10-05', valorTotal: 1000, valorRecebido: 400, valorGlosaAcatada: 150.1 }),
      titulo({ idNota: 'n2', dataEmissao: '2026-10-31', valorTotal: 200.2, valorRecebido: 0.1 }),
      // Fora do período: não entra.
      titulo({ idNota: 'n3', dataEmissao: '2026-11-01', valorTotal: 5000 }),
    ];

    expect(cardsGlosaSaldo({ ...OUTUBRO, titulos, glosas: [] })).toMatchObject({
      faturado: 1200.2,
      recebido: 400.1,
      acatado: 150.1,
      saldoPendente: 650,
    });
  });

  it('Recuperada e glosa total seguem o lote, no dia da emissão mais antiga dele', () => {
    const titulos = [
      titulo({ idNota: 'n1', dataEmissao: '2026-10-20', lotes: [L1] }),
      titulo({ idNota: 'n2', dataEmissao: '2026-10-25', lotes: [L2] }),
    ];
    // O lote 2 tem um título de setembro: a glosa dele é de setembro, não entra em outubro.
    const primeiraEmissaoDoLote = new Map([['lote-2', '2026-09-28']]);
    const out = cardsGlosaSaldo({
      ...OUTUBRO,
      titulos,
      glosas: [
        glosa(L1, 'recuperada', 300),
        glosa(L1, 'acatada', 100),
        glosa(L1, 'em-disputa', 50.5),
        glosa(L2, 'recuperada', 999),
      ],
      primeiraEmissaoDoLote,
    });

    expect(out).toMatchObject({ recuperada: 300, glosaTotal: 450.5 });
  });

  it('glosa sem título (Fora de lote) entra pelo mês do lote no apLIS', () => {
    const out = cardsGlosaSaldo({
      desde: '2026-10-15',
      ate: '2026-11-10',
      titulos: [],
      glosas: [glosa(null, 'recuperada', 80, '2026-10'), glosa(null, 'recuperada', 20, '2026-09')],
    });

    expect(out.recuperada).toBe(80);
  });

  it('num mês inteiro, a Recuperada bate com a do funil', () => {
    const titulos = [
      titulo({ idNota: 'n1', dataEmissao: '2026-10-05', valorTotal: 1000, valorRecebido: 700, lotes: [L1] }),
      titulo({ idNota: 'n2', dataEmissao: '2026-09-10', valorTotal: 500, valorRecebido: 100, lotes: [L2] }),
    ];
    const glosas = [
      glosa(L1, 'recuperada', 200),
      glosa(L2, 'recuperada', 40),
      glosa(null, 'recuperada', 15, '2026-10'),
      glosa(L1, 'acatada', 30),
    ];
    const funil = montarFunilGlosa(periodosComparativos('2026-10')!, titulos, glosas);
    const outubro = funil.find((f) => f.mes === '2026-10')!;

    const out = cardsGlosaSaldo({ ...OUTUBRO, titulos, glosas });
    expect(out.recuperada).toBe(outubro.recuperada);
    expect(out.recuperada).toBe(215);
  });
});

describe('mesesDoPeriodo', () => {
  it('lista os meses que o período toca, inclusive na virada do ano', () => {
    expect(mesesDoPeriodo('2026-11-20', '2027-01-05')).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  it('período invertido não tem mês', () => {
    expect(mesesDoPeriodo('2026-11-01', '2026-10-01')).toEqual([]);
  });
});
