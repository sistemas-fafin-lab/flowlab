import { describe, expect, it } from 'vitest';
import {
  competencia,
  competenciaDaData,
  ehCompetencia,
  formatarCompetencia,
  mesesEntre,
  paraCampoMes,
  somarMeses,
  ultimoDiaDoMes,
  vencimentoNaCompetencia,
} from './competencia';

describe('competência', () => {
  it('valida o formato YYYY-MM-01', () => {
    expect(ehCompetencia('2026-10-01')).toBe(true);
    expect(ehCompetencia('2026-10-02')).toBe(false);
    expect(ehCompetencia('2026-13-01')).toBe(false);
    expect(ehCompetencia('2026-10')).toBe(false);
    expect(ehCompetencia(null)).toBe(false);
  });

  it('transborda o mês para o ano vizinho', () => {
    expect(competencia(2026, 13)).toBe('2027-01-01');
    expect(competencia(2026, 0)).toBe('2025-12-01');
    expect(competencia(2026, -11)).toBe('2025-01-01');
  });

  it('soma meses atravessando a virada do ano', () => {
    expect(somarMeses('2026-11-01', 3)).toBe('2027-02-01');
    expect(somarMeses('2026-01-01', -1)).toBe('2025-12-01');
    expect(somarMeses('2026-06-01', 12)).toBe('2027-06-01');
  });

  it('conta meses entre competências', () => {
    expect(mesesEntre('2026-10-01', '2027-01-01')).toBe(3);
    expect(mesesEntre('2027-01-01', '2026-10-01')).toBe(-3);
    expect(mesesEntre('2026-10-01', '2026-10-01')).toBe(0);
  });

  it('extrai a competência de uma data ou de um mês', () => {
    expect(competenciaDaData('2026-10-17')).toBe('2026-10-01');
    expect(competenciaDaData('2026-10')).toBe('2026-10-01');
    expect(competenciaDaData('17/10/2026')).toBeNull();
    expect(competenciaDaData('2026-13-01')).toBeNull();
  });
});

describe('vencimento (RN03)', () => {
  it('sabe o último dia de cada mês, inclusive ano bissexto', () => {
    expect(ultimoDiaDoMes(2026, 2)).toBe(28);
    expect(ultimoDiaDoMes(2028, 2)).toBe(29);
    expect(ultimoDiaDoMes(2026, 4)).toBe(30);
    expect(ultimoDiaDoMes(2026, 12)).toBe(31);
  });

  it('dia 31 cai no último dia em fevereiro e nos meses de 30 dias', () => {
    expect(vencimentoNaCompetencia('2026-02-01', 31)).toBe('2026-02-28');
    expect(vencimentoNaCompetencia('2028-02-01', 31)).toBe('2028-02-29');
    expect(vencimentoNaCompetencia('2026-04-01', 31)).toBe('2026-04-30');
    expect(vencimentoNaCompetencia('2026-10-01', 31)).toBe('2026-10-31');
  });

  it('dia comum fica como está', () => {
    expect(vencimentoNaCompetencia('2026-10-01', 5)).toBe('2026-10-05');
  });
});

describe('formatação', () => {
  it('mostra mês abreviado e ano', () => {
    expect(formatarCompetencia('2026-10-01')).toBe('out/2026');
    expect(formatarCompetencia('2027-01-01')).toBe('jan/2027');
    expect(formatarCompetencia(null)).toBe('—');
  });

  it('converte para o valor de <input type="month">', () => {
    expect(paraCampoMes('2026-10-01')).toBe('2026-10');
    expect(paraCampoMes(null)).toBe('');
  });
});
