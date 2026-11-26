import { describe, expect, it } from 'vitest';
import { nomeCurtoMes, nomeMes, semanasDoMes, somarMeses } from './mesCalendario';

describe('semanasDoMes', () => {
  it('monta as semanas de segunda a sexta, com buracos fora do mês', () => {
    // Novembro/2026: dia 1 é domingo, dia 30 é segunda.
    const semanas = semanasDoMes('2026-11');
    expect(semanas[0]).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
    expect(semanas[semanas.length - 1]).toEqual(['2026-11-30', null, null, null, null]);
    expect(semanas).toHaveLength(5);
  });

  it('pula a semana cujo único dia do mês cai no fim de semana', () => {
    // Agosto/2026: dia 1 é sábado; a primeira semana começa na segunda, dia 3.
    expect(semanasDoMes('2026-08')[0][0]).toBe('2026-08-03');
  });

  it('deixa nulos os dias úteis do mês anterior na primeira semana', () => {
    // Outubro/2026: dia 1 é quinta.
    expect(semanasDoMes('2026-10')[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02']);
  });
});

describe('somarMeses e nomes', () => {
  it('atravessa a virada de ano', () => {
    expect(somarMeses('2026-12', 1)).toBe('2027-01');
    expect(somarMeses('2026-01', -1)).toBe('2025-12');
  });

  it('nomeia o mês com a inicial maiúscula e o nome curto em minúsculas', () => {
    expect(nomeMes('2026-11')).toBe('Novembro de 2026');
    expect(nomeCurtoMes('2026-12')).toBe('dezembro');
  });
});
