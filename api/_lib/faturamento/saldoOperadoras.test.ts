import { describe, expect, it } from 'vitest';
import { compararSaldos, filtrarUniverso } from './saldoOperadoras.js';
import type { SaldoAplisDoLote, TituloSaldo } from './saldoOperadoras.js';

function titulo(extra: Partial<TituloSaldo> = {}): TituloSaldo {
  return {
    idNota: 'n1',
    numeroNota: '100',
    operadoraId: 'op-bradesco',
    operadora: 'BRADESCO',
    consideradaMeta: true,
    dataEmissao: '2026-10-05',
    saldoSistema: 1000,
    lotes: [{ aplisId: 1, codigo: 'L-1' }],
    ...extra,
  };
}

const aplis = (liquido: number, recebido: number): SaldoAplisDoLote => ({ liquido, recebido });

describe('compararSaldos', () => {
  it('mostra o saldo do apLIS (líquido − recebido) ao lado do sistema, com a diferença', () => {
    const linhas = compararSaldos(
      [titulo({ saldoSistema: 900 })],
      { 1: aplis(1500, 400) },
    );
    expect(linhas).toEqual([
      expect.objectContaining({
        operadoraId: 'op-bradesco',
        nome: 'BRADESCO',
        saldoSistema: 900,
        saldoAplis: 1100,
        diferenca: -200,
        situacao: 'sistema-menor',
        titulosComparados: 1,
        titulosForaDaComparacao: 0,
      }),
    ]);
  });

  it('soma os títulos da operadora e conta o lote compartilhado uma vez só no apLIS', () => {
    const linhas = compararSaldos(
      [
        titulo({ idNota: 'a', saldoSistema: 500, lotes: [{ aplisId: 1, codigo: null }] }),
        titulo({ idNota: 'b', saldoSistema: 300, lotes: [{ aplisId: 1, codigo: null }, { aplisId: 2, codigo: null }] }),
      ],
      { 1: aplis(800, 0), 2: aplis(200, 0) },
    );
    expect(linhas[0].saldoSistema).toBe(800);
    expect(linhas[0].saldoAplis).toBe(1000);
  });

  it('diferença abaixo de R$ 1,00 é igual', () => {
    const [linha] = compararSaldos([titulo({ saldoSistema: 100.5 })], { 1: aplis(101, 0) });
    expect(linha.situacao).toBe('igual');
  });

  it('sistema acima do apLIS é sistema-maior', () => {
    const [linha] = compararSaldos([titulo({ saldoSistema: 500 })], { 1: aplis(100, 0) });
    expect(linha.situacao).toBe('sistema-maior');
    expect(linha.diferenca).toBe(400);
  });

  it('título com lote sem aplis_id ou ausente no apLIS fica fora dos dois lados e é contado à parte', () => {
    const [linha] = compararSaldos(
      [
        titulo({ idNota: 'ok', saldoSistema: 100, lotes: [{ aplisId: 1, codigo: null }] }),
        titulo({ idNota: 'manual', saldoSistema: 700, lotes: [{ aplisId: null, codigo: 'X' }] }),
        titulo({ idNota: 'sumiu', saldoSistema: 50, lotes: [{ aplisId: 9, codigo: null }] }),
        titulo({ idNota: 'sem-lote', saldoSistema: 20, lotes: [] }),
      ],
      { 1: aplis(100, 0) },
    );
    expect(linha.saldoSistema).toBe(100);
    expect(linha.saldoAplis).toBe(100);
    expect(linha.titulosComparados).toBe(1);
    expect(linha.titulosForaDaComparacao).toBe(3);
  });

  it('operadora sem nenhum título comparável aparece com saldoAplis nulo', () => {
    const [linha] = compararSaldos([titulo({ lotes: [] })], {});
    expect(linha.saldoAplis).toBeNull();
    expect(linha.diferenca).toBeNull();
    expect(linha.situacao).toBe('sem-comparacao');
  });

  it('soma em centavos, sem erro de ponto flutuante', () => {
    const [linha] = compararSaldos(
      [titulo({ idNota: 'a', saldoSistema: 0.1, lotes: [{ aplisId: 1, codigo: null }] }),
       titulo({ idNota: 'b', saldoSistema: 0.2, lotes: [{ aplisId: 2, codigo: null }] })],
      { 1: aplis(0.1, 0), 2: aplis(0.2, 0) },
    );
    expect(linha.saldoSistema).toBe(0.3);
    expect(linha.saldoAplis).toBe(0.3);
    expect(linha.diferenca).toBe(0);
  });

  it('ordena pela maior diferença absoluta primeiro', () => {
    const linhas = compararSaldos(
      [
        titulo({ idNota: 'a', operadoraId: 'o1', operadora: 'PEQUENA', saldoSistema: 90, lotes: [{ aplisId: 1, codigo: null }] }),
        titulo({ idNota: 'b', operadoraId: 'o2', operadora: 'GRANDE', saldoSistema: 0, lotes: [{ aplisId: 2, codigo: null }] }),
      ],
      { 1: aplis(100, 0), 2: aplis(5000, 0) },
    );
    expect(linhas.map((l) => l.nome)).toEqual(['GRANDE', 'PEQUENA']);
  });
});

describe('filtrarUniverso', () => {
  const semFiltro = { desde: '2026-10-01', ate: '2026-10-31', somentePeriodo: false, operadoraIds: [], lotes: [], notas: [] };

  it('carteira total ignora o período; só emitidas no período respeita', () => {
    const titulos = [titulo({ idNota: 'dentro' }), titulo({ idNota: 'fora', dataEmissao: '2026-08-10' })];
    expect(filtrarUniverso(titulos, semFiltro).map((t) => t.idNota)).toEqual(['dentro', 'fora']);
    expect(filtrarUniverso(titulos, { ...semFiltro, somentePeriodo: true }).map((t) => t.idNota)).toEqual(['dentro']);
  });

  it('período é inclusivo nas duas pontas', () => {
    const titulos = [titulo({ idNota: 'a', dataEmissao: '2026-10-01' }), titulo({ idNota: 'b', dataEmissao: '2026-10-31' })];
    expect(filtrarUniverso(titulos, { ...semFiltro, somentePeriodo: true })).toHaveLength(2);
  });

  it('filtra por operadora', () => {
    const titulos = [titulo({ idNota: 'a' }), titulo({ idNota: 'b', operadoraId: 'op-pmdf' })];
    expect(filtrarUniverso(titulos, { ...semFiltro, operadoraIds: ['op-pmdf'] }).map((t) => t.idNota)).toEqual(['b']);
  });

  it('filtra por nota e por lote em busca parcial, sem diferenciar maiúsculas', () => {
    const titulos = [
      titulo({ idNota: 'a', numeroNota: 'NF-9127', lotes: [{ aplisId: 6329, codigo: 'ABC-1' }] }),
      titulo({ idNota: 'b', numeroNota: '55', lotes: [{ aplisId: 7000, codigo: 'XYZ' }] }),
    ];
    expect(filtrarUniverso(titulos, { ...semFiltro, notas: ['9127'] }).map((t) => t.idNota)).toEqual(['a']);
    expect(filtrarUniverso(titulos, { ...semFiltro, lotes: ['abc'] }).map((t) => t.idNota)).toEqual(['a']);
    expect(filtrarUniverso(titulos, { ...semFiltro, lotes: ['7000'] }).map((t) => t.idNota)).toEqual(['b']);
  });

  it('deixa de fora operadora fora da meta (mesma regra da RPC)', () => {
    const titulos = [titulo({ idNota: 'a' }), titulo({ idNota: 'b', consideradaMeta: false })];
    expect(filtrarUniverso(titulos, semFiltro).map((t) => t.idNota)).toEqual(['a']);
  });
});
