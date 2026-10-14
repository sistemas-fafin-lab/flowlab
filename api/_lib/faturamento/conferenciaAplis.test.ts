import { describe, expect, it } from 'vitest';
import { classificarDivergencia, conferirTitulo } from './conferenciaAplis.js';
import type { RecebidoLoteAplis, TituloConferencia } from './conferenciaAplis.js';

describe('classificarDivergencia', () => {
  it.each([
    ['só no apLIS', 0, 2034.81, 'so-no-aplis'],
    ['apLIS maior', 500, 800, 'aplis-maior'],
    ['sistema maior', 800, 500, 'sistema-maior'],
    ['recebido aqui, lote ainda Faturado lá', 1200, 0, 'sistema-maior'],
  ] as const)('%s', (_caso, sistema, aplis, tipo) => {
    expect(classificarDivergencia(sistema, aplis)).toBe(tipo);
  });

  it.each([
    ['iguais', 100, 100],
    ['nada recebido nos dois', 0, 0],
    ['apLIS R$ 0,99 maior', 100, 100.99],
    ['sistema R$ 0,99 maior', 100.99, 100],
    ['só no apLIS mas abaixo de R$ 1', 0, 0.5],
  ])('%s → sem divergência', (_caso, sistema, aplis) => {
    expect(classificarDivergencia(sistema, aplis)).toBeNull();
  });

  it('diferença de exatamente R$ 1,00 já conta, sem erro de ponto flutuante', () => {
    // 0.1 + 0.2 - 0.3 ≠ 0 em float: a régua é em centavos.
    expect(classificarDivergencia(100.1, 101.1)).toBe('aplis-maior');
    expect(classificarDivergencia(101.1, 100.1)).toBe('sistema-maior');
  });
});

function titulo(overrides: Partial<TituloConferencia> = {}): TituloConferencia {
  return {
    idNota: 'nota-1',
    numeroNota: '9127',
    operadora: 'AMHP-DF',
    status: 'aberta',
    dataEmissao: '2026-09-03',
    valorTotal: 2034.81,
    recebidoSistema: 0,
    glosadoSistema: 0,
    idsLote: [6329],
    ...overrides,
  };
}

function recebido(overrides: Partial<RecebidoLoteAplis> = {}): RecebidoLoteAplis {
  return {
    status: 4,
    statusLabel: 'Recebido',
    recebido: 2034.81,
    primeiroRecebimento: '2026-09-22',
    ultimoRecebimento: '2026-09-22',
    ...overrides,
  };
}

describe('conferirTitulo', () => {
  it('título 9127 / lote 6329: recebido só no apLIS', () => {
    expect(conferirTitulo(titulo(), { 6329: recebido() })).toEqual({
      idNota: 'nota-1',
      numeroNota: '9127',
      operadora: 'AMHP-DF',
      status: 'aberta',
      dataEmissao: '2026-09-03',
      valorTotal: 2034.81,
      recebidoSistema: 0,
      glosadoSistema: 0,
      recebidoAplis: 2034.81,
      primeiroRecebimentoAplis: '2026-09-22',
      ultimoRecebimentoAplis: '2026-09-22',
      lotes: [{ aplisId: 6329, statusAplis: 'Recebido', recebidoAplis: 2034.81 }],
      tipo: 'so-no-aplis',
    });
  });

  it('título conferido devolve null', () => {
    expect(conferirTitulo(titulo({ recebidoSistema: 2034.81, status: 'recebida' }), { 6329: recebido() })).toBeNull();
  });

  it('título com 2 lotes soma os recebidos e abre a faixa de datas', () => {
    const divergencia = conferirTitulo(
      titulo({ idsLote: [5001, 5002], recebidoSistema: 300, status: 'parcialmente_recebida' }),
      {
        5001: recebido({ recebido: 300, primeiroRecebimento: '2026-09-10', ultimoRecebimento: '2026-09-12' }),
        5002: recebido({
          status: 7, statusLabel: 'Recebido - parcial', recebido: 200.5,
          primeiroRecebimento: '2026-09-05', ultimoRecebimento: '2026-09-30',
        }),
      },
    );
    expect(divergencia).toMatchObject({
      tipo: 'aplis-maior',
      recebidoAplis: 500.5,
      primeiroRecebimentoAplis: '2026-09-05',
      ultimoRecebimentoAplis: '2026-09-30',
      lotes: [
        { aplisId: 5001, statusAplis: 'Recebido', recebidoAplis: 300 },
        { aplisId: 5002, statusAplis: 'Recebido - parcial', recebidoAplis: 200.5 },
      ],
    });
  });

  it('lote sem recebimento no apLIS fica sem datas', () => {
    const divergencia = conferirTitulo(
      titulo({ recebidoSistema: 1000, status: 'recebida' }),
      { 6329: recebido({ status: 3, statusLabel: 'Faturado', recebido: 0, primeiroRecebimento: null, ultimoRecebimento: null }) },
    );
    expect(divergencia).toMatchObject({
      tipo: 'sistema-maior',
      recebidoAplis: 0,
      primeiroRecebimentoAplis: null,
      ultimoRecebimentoAplis: null,
    });
  });

  it('lote que não existe no MySQL vira lote-ausente, sem valor do apLIS', () => {
    const divergencia = conferirTitulo(titulo({ idsLote: [4905, 6329] }), { 6329: recebido() });
    expect(divergencia).toMatchObject({
      tipo: 'lote-ausente',
      recebidoAplis: null,
      primeiroRecebimentoAplis: null,
      ultimoRecebimentoAplis: null,
      lotes: [
        { aplisId: 4905, statusAplis: null, recebidoAplis: null },
        { aplisId: 6329, statusAplis: 'Recebido', recebidoAplis: 2034.81 },
      ],
    });
  });

  it('título sem lote do apLIS não tem o que conferir', () => {
    expect(conferirTitulo(titulo({ idsLote: [] }), {})).toBeNull();
  });
});
