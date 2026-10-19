import { describe, expect, it } from 'vitest';
import { competenciaAposRefechamento } from './refechamento';

describe('competenciaAposRefechamento', () => {
  it('acompanha a nova emissão quando era o mês da emissão antiga', () => {
    expect(competenciaAposRefechamento('2026-09', '2026-09-10', '2026-10-05')).toBe('2026-10');
  });

  it('preserva uma competência diferente do mês da emissão antiga', () => {
    expect(competenciaAposRefechamento('2026-08', '2026-09-10', '2026-10-05')).toBe('2026-08');
  });

  it('na virada de ano, acompanha para janeiro', () => {
    expect(competenciaAposRefechamento('2026-12', '2026-12-20', '2027-01-04')).toBe('2027-01');
  });
});
