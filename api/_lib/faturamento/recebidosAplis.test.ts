import { describe, expect, it } from 'vitest';
import type { RecebidoLoteAplis } from './bdLab.js';
import { combinarRecebidos, diaEmBrasilia, porDataDoRetrato, recebidoDoRetrato, retratoVale } from './recebidosAplis.js';
import type { RetratoLote } from './recebidosAplis.js';

const doBanco = (sobre: Partial<RecebidoLoteAplis> = {}): RecebidoLoteAplis => ({
  status: 3,
  statusLabel: 'Faturado',
  recebido: 0,
  primeiroRecebimento: null,
  ultimoRecebimento: null,
  fechamento: '2026-10-01',
  ...sobre,
});

// Lote 6912 (18/11/2026): 4 requisições de R$ 79,92 recebidas em 13/11 no site;
// o banco (dump até 16/11) ainda sem recebimento.
const retrato6912: RetratoLote = {
  capturadoEm: '2026-11-18T15:30:00Z',
  requisicoes: Array.from({ length: 4 }, () => ({ liquido: 79.92, recebido: 79.92, data: '2026-11-13' })),
};

describe('diaEmBrasilia', () => {
  it('usa o dia de Brasília, não o UTC', () => {
    expect(diaEmBrasilia('2026-11-19T01:30:00Z')).toBe('2026-11-18');
  });
});

describe('retratoVale', () => {
  it('vale quando a captura é de um dia depois do banco', () => {
    expect(retratoVale(retrato6912, '2026-11-16', true)).toBe(true);
  });

  it('não vale no mesmo dia do banco: o dump da noite pode ter o que entrou depois', () => {
    expect(retratoVale({ ...retrato6912, capturadoEm: '2026-11-16T10:00:00Z' }, '2026-11-16', true)).toBe(false);
  });

  it('não vale quando o banco é mais novo', () => {
    expect(retratoVale(retrato6912, '2026-11-19', true)).toBe(false);
  });

  it('vale quando o banco não tem o lote ou está fora do ar', () => {
    expect(retratoVale(retrato6912, '2026-11-19', false)).toBe(true);
    expect(retratoVale(retrato6912, null, true)).toBe(true);
  });
});

describe('recebidoDoRetrato', () => {
  it('soma em centavos e guarda status e fechamento do banco', () => {
    expect(recebidoDoRetrato(retrato6912, doBanco())).toEqual({
      status: 3,
      statusLabel: 'Faturado',
      recebido: 319.68,
      primeiroRecebimento: '2026-11-13',
      ultimoRecebimento: '2026-11-13',
      fechamento: '2026-10-01',
    });
  });

  it('sem banco: status "—" e sem fechamento', () => {
    const r = recebidoDoRetrato(retrato6912, undefined);
    expect(r.statusLabel).toBe('—');
    expect(r.fechamento).toBeNull();
  });

  it('faixa de datas só com valor positivo', () => {
    const r = recebidoDoRetrato({
      capturadoEm: retrato6912.capturadoEm,
      requisicoes: [
        { liquido: 10, recebido: 0, data: '2026-01-01' },
        { liquido: 10, recebido: 10, data: '2026-02-01' },
        { liquido: 10, recebido: 5, data: null },
      ],
    }, doBanco());
    expect(r.recebido).toBe(15);
    expect(r.primeiroRecebimento).toBe('2026-02-01');
  });
});

describe('porDataDoRetrato', () => {
  it('agrupa por data, em ordem, sem valor zero nem data vazia', () => {
    expect(porDataDoRetrato({
      capturadoEm: retrato6912.capturadoEm,
      requisicoes: [
        { liquido: 1, recebido: 0.1, data: '2026-11-13' },
        { liquido: 1, recebido: 0.2, data: '2026-11-13' },
        { liquido: 1, recebido: 5, data: '2026-10-01' },
        { liquido: 1, recebido: 0, data: '2026-09-01' },
        { liquido: 1, recebido: 3, data: null },
      ],
    })).toEqual([
      { data: '2026-10-01', valor: 5 },
      { data: '2026-11-13', valor: 0.3 },
    ]);
  });
});

describe('combinarRecebidos', () => {
  it('o caso do lote 6912: o retrato do site vence o banco atrasado', () => {
    const r = combinarRecebidos({
      idsLote: [6912],
      banco: { porLote: { 6912: doBanco() }, dadoAte: '2026-11-16' },
      retratos: new Map([[6912, retrato6912]]),
    });
    expect(r.porLote[6912].recebido).toBe(319.68);
    expect([...r.doSite]).toEqual([6912]);
  });

  it('sem retrato fica com o banco; lote que não existe em nenhum fica fora do mapa', () => {
    const r = combinarRecebidos({
      idsLote: [1, 2],
      banco: { porLote: { 1: doBanco({ recebido: 50 }) }, dadoAte: '2026-11-16' },
      retratos: new Map(),
    });
    expect(r.porLote[1].recebido).toBe(50);
    expect(r.porLote[2]).toBeUndefined();
    expect(r.semFonte.size).toBe(0);
  });

  it('banco fora do ar: usa o retrato e marca o resto como sem fonte', () => {
    const r = combinarRecebidos({ idsLote: [6912, 7000], banco: null, retratos: new Map([[6912, retrato6912]]) });
    expect(r.porLote[6912].recebido).toBe(319.68);
    expect([...r.semFonte]).toEqual([7000]);
  });
});
