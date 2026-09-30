import { describe, expect, it } from 'vitest';
import { corteAplisPadrao, PISO_CORTE_APLIS } from './atualizarAplis';

describe('corteAplisPadrao', () => {
  it('é o 1º dia do mês anterior', () => {
    expect(corteAplisPadrao(new Date(2026, 10, 15))).toBe('2026-10-01');
  });

  it('na virada de ano, volta para dezembro do ano anterior', () => {
    expect(corteAplisPadrao(new Date(2027, 0, 5))).toBe('2026-12-01');
  });

  it('no último dia do mês não pula para dois meses antes', () => {
    expect(corteAplisPadrao(new Date(2027, 2, 31))).toBe('2027-02-01');
  });

  it('nunca cai antes do piso de 01/09/2026 (em 30/09, agosto vira setembro)', () => {
    expect(PISO_CORTE_APLIS).toBe('2026-09-01');
    expect(corteAplisPadrao(new Date(2026, 8, 30))).toBe('2026-09-01');
  });

  it('no mês seguinte ao piso, o mês anterior é o próprio piso', () => {
    expect(corteAplisPadrao(new Date(2026, 9, 1))).toBe('2026-09-01');
  });
});
