import { describe, expect, it } from 'vitest';
import { formatDataHora } from './formato';

describe('formatDataHora', () => {
  it('formata timestamptz em data + hora no padrão brasileiro', () => {
    expect(formatDataHora('2026-08-18T14:32:00.000Z')).toBe('18/08/2026, 11:32');
  });

  it('retorna travessão para valor ausente', () => {
    expect(formatDataHora(null)).toBe('—');
    expect(formatDataHora(undefined)).toBe('—');
  });
});
