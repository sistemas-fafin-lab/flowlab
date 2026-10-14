import { describe, expect, it } from 'vitest';
import {
  diaDoPrazo, diaSP, diferencaDias, ehDiaUtil, formatarDiaMes, inicioDaSemana, pluralDias, proximoDiaUtil, somarDias,
} from './datas';

describe('diaSP', () => {
  it('usa o dia de Brasília, não o de UTC: 21h de 13/10 em SP ainda é 13/10', () => {
    // 2026-10-14T00:00Z = 13/10 às 21h em Brasília (UTC−3)
    expect(diaSP('2026-10-14T00:00:00Z')).toBe('2026-10-13');
  });

  it('passa um dia puro direto, sem converter fuso', () => {
    expect(diaSP('2026-10-13')).toBe('2026-10-13');
  });

  it('meia-noite e um minuto em Brasília já é o dia seguinte', () => {
    expect(diaSP('2026-10-14T03:01:00Z')).toBe('2026-10-14');
  });
});

describe('diaDoPrazo', () => {
  it('lê o dia escolhido no Board, sem converter para Brasília', () => {
    // O ITTaskDrawer grava 20/10 como meia-noite UTC; em SP isso é 19/10 às 21h.
    expect(diaDoPrazo('2026-10-20T00:00:00.000Z')).toBe('2026-10-20');
    expect(diaDoPrazo('2026-10-20T00:00:00+00:00')).toBe('2026-10-20');
    expect(diaDoPrazo('2026-10-20')).toBe('2026-10-20');
  });
});

describe('aritmética de dias', () => {
  it('diferença e soma atravessam o fim do mês e do ano', () => {
    expect(diferencaDias('2026-12-30', '2027-01-02')).toBe(3);
    expect(somarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(diferencaDias('2026-10-13', '2026-10-10')).toBe(-3);
  });

  it('sexta-feira tem a segunda como próximo dia útil', () => {
    expect(proximoDiaUtil('2026-10-16')).toBe('2026-10-19'); // sex → seg
    expect(proximoDiaUtil('2026-10-13')).toBe('2026-10-14'); // ter → qua
  });

  it('fim de semana não é dia útil', () => {
    expect(ehDiaUtil('2026-10-17')).toBe(false); // sábado
    expect(ehDiaUtil('2026-10-18')).toBe(false); // domingo
    expect(ehDiaUtil('2026-10-19')).toBe(true);
  });

  it('a semana começa na segunda, inclusive quando hoje é domingo', () => {
    expect(inicioDaSemana('2026-10-13')).toBe('2026-10-12');
    expect(inicioDaSemana('2026-10-18')).toBe('2026-10-12');
    expect(inicioDaSemana('2026-10-12')).toBe('2026-10-12');
  });
});

describe('formatação', () => {
  it('dd/mm e plural de dias', () => {
    expect(formatarDiaMes('2026-10-07')).toBe('07/10');
    expect(pluralDias(1)).toBe('1 dia');
    expect(pluralDias(3)).toBe('3 dias');
  });
});
