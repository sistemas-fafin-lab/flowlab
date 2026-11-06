import { describe, expect, it } from 'vitest';
import { periodosComparativos } from './comparativos';
import { FORA_DE_LOTE, montarFunilGlosa, type ClasseGlosaFunil, type LoteRef, type TituloFunil } from './funilGlosa';

const L1: LoteRef = { id: 'lote-1', codigo: '1001' };
const L2: LoteRef = { id: 'lote-2', codigo: '1002' };

function titulo(parcial: Partial<TituloFunil> & Pick<TituloFunil, 'idNota' | 'dataEmissao'>): TituloFunil {
  return { valorTotal: 0, valorRecebido: 0, lotes: [], ...parcial };
}
const glosa = (lote: LoteRef | null, classe: ClasseGlosaFunil, valor: number, competencia = '2026-10') => ({
  lote, classe, valor, competencia,
});

const PERIODOS = periodosComparativos('2026-10')!;
const mesDe = (funil: ReturnType<typeof montarFunilGlosa>, mes: string) => funil.find((f) => f.mes === mes)!;

describe('montarFunilGlosa', () => {
  it('fecha: Faturado = Recebido + Acatada + Em disputa + Saldo', () => {
    const titulos = [
      titulo({ idNota: 'n1', dataEmissao: '2026-10-05', valorTotal: 1000, valorRecebido: 400, lotes: [L1] }),
      titulo({ idNota: 'n2', dataEmissao: '2026-10-20', valorTotal: 500.5, valorRecebido: 100.1, lotes: [L2] }),
    ];
    const out = mesDe(montarFunilGlosa(PERIODOS, titulos, [
      glosa(L1, 'acatada', 150),
      glosa(L1, 'em-disputa', 100),
      glosa(L2, 'em-disputa', 50.25),
    ]), '2026-10');

    expect(out).toMatchObject({ faturado: 1500.5, recebido: 500.1, acatada: 150, emDisputa: 150.25, saldo: 700.15 });
    expect(out.recebido + out.acatada + out.emDisputa + out.saldo).toBeCloseTo(out.faturado, 2);
  });

  it('não soma a Recuperada duas vezes: ela é detalhe do Recebido', () => {
    const titulos = [titulo({ idNota: 'n1', dataEmissao: '2026-10-05', valorTotal: 1000, valorRecebido: 600, lotes: [L1] })];
    const out = mesDe(montarFunilGlosa(PERIODOS, titulos, [glosa(L1, 'acatada', 100), glosa(L1, 'recuperada', 200)]), '2026-10');

    expect(out.recebido).toBe(600);
    expect(out.recuperada).toBe(200);
    expect(out.glosaTotal).toBe(300);
    expect(out.saldo).toBe(300); // 1000 − 600 − 100; a recuperada NÃO é subtraída de novo
    expect(out.recebido + out.acatada + out.emDisputa + out.saldo).toBe(out.faturado);
  });

  it('título emitido em outro mês não entra no mês, nem a glosa do lote dele', () => {
    const titulos = [
      titulo({ idNota: 'n1', dataEmissao: '2026-09-30', valorTotal: 700, lotes: [L1] }),
      titulo({ idNota: 'n2', dataEmissao: '2026-11-01', valorTotal: 900, lotes: [L2] }),
    ];
    const funil = montarFunilGlosa(PERIODOS, titulos, [glosa(L1, 'acatada', 70)]);

    expect(mesDe(funil, '2026-10')).toMatchObject({ faturado: 0, acatada: 0 });
    expect(mesDe(funil, '2026-09')).toMatchObject({ faturado: 700, acatada: 70, saldo: 630 });
  });

  it('atribui glosa, acatada e saldo ao lote; lote sem título e título sem lote vão para "Fora de lote"', () => {
    const titulos = [
      titulo({ idNota: 'n1', dataEmissao: '2026-10-05', valorTotal: 1000, lotes: [L1] }),
      titulo({ idNota: 'n2', dataEmissao: '2026-10-06', valorTotal: 300, lotes: [] }),
    ];
    const out = mesDe(montarFunilGlosa(PERIODOS, titulos, [
      glosa(L1, 'acatada', 80),
      glosa(null, 'em-disputa', 20), // lote do apLIS sem título aqui; vale a competência do lote
      glosa(null, 'acatada', 30),
    ]), '2026-10');

    const lote1 = out.lotes.find((l) => l.codigo === '1001')!;
    const fora = out.lotes.find((l) => l.codigo === FORA_DE_LOTE)!;
    expect(lote1).toMatchObject({ acatada: 80, emDisputa: 0, glosaTotal: 80, saldo: 920 });
    expect(fora).toMatchObject({ acatada: 30, emDisputa: 20, glosaTotal: 50, saldo: 250 });
    expect(out.lotes.reduce((s, l) => s + l.glosaTotal, 0)).toBe(out.glosaTotal);
    expect(out.lotes.reduce((s, l) => s + l.saldo, 0)).toBe(out.saldo);
  });

  it('glosa fora de lote usa a competência do lote no apLIS; fora dos 3 meses, não entra', () => {
    const funil = montarFunilGlosa(PERIODOS, [], [
      glosa(null, 'acatada', 10, '2026-09'),
      glosa(null, 'acatada', 99, '2026-05'),
    ]);
    expect(mesDe(funil, '2026-09').acatada).toBe(10);
    expect(funil.reduce((s, f) => s + f.acatada, 0)).toBe(10);
  });

  it('divide o (total − recebido) do título entre os lotes dele sem perder centavos', () => {
    const dois = [titulo({ idNota: 'n1', dataEmissao: '2026-10-05', valorTotal: 100, lotes: [L1, L2] })];
    expect(mesDe(montarFunilGlosa(PERIODOS, dois, []), '2026-10').lotes.map((l) => l.saldo)).toEqual([50, 50]);

    const tres = [titulo({ idNota: 'n1', dataEmissao: '2026-10-05', valorTotal: 100, lotes: [L1, L2, { id: 'lote-3', codigo: '1003' }] })];
    const out3 = mesDe(montarFunilGlosa(PERIODOS, tres, []), '2026-10');
    expect(out3.lotes.reduce((s, l) => s + l.saldo, 0)).toBe(100);
  });

  it('lote em dois títulos: a glosa conta uma vez, no mês da emissão mais antiga', () => {
    const titulos = [
      titulo({ idNota: 'n1', dataEmissao: '2026-09-10', valorTotal: 100, lotes: [L1] }),
      titulo({ idNota: 'n2', dataEmissao: '2026-10-10', valorTotal: 100, lotes: [L1] }),
    ];
    const funil = montarFunilGlosa(PERIODOS, titulos, [glosa(L1, 'recuperada', 30)]);
    expect(mesDe(funil, '2026-09').recuperada).toBe(30);
    expect(mesDe(funil, '2026-10').recuperada).toBe(0);
  });

  it('virada de ano: janeiro tem dezembro e novembro do ano anterior', () => {
    const titulos = [
      titulo({ idNota: 'n1', dataEmissao: '2025-12-31', valorTotal: 10, lotes: [L1] }),
      titulo({ idNota: 'n2', dataEmissao: '2026-01-01', valorTotal: 20, lotes: [L1] }),
      titulo({ idNota: 'n3', dataEmissao: '2025-11-15', valorTotal: 40, lotes: [L1] }),
    ];
    const funil = montarFunilGlosa(periodosComparativos('2026-01')!, titulos, []);
    expect(funil.map((f) => [f.mes, f.faturado])).toEqual([['2026-01', 20], ['2025-12', 10], ['2025-11', 40]]);
  });

  it('título sem data de emissão não entra em mês nenhum', () => {
    const funil = montarFunilGlosa(PERIODOS, [titulo({ idNota: 'n1', dataEmissao: null, valorTotal: 10 })], []);
    expect(funil.every((f) => f.faturado === 0)).toBe(true);
  });
});
