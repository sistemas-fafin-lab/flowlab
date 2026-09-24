import { describe, expect, it } from 'vitest';
import { emissaoPadrao } from './emissaoTitulo';
import { hojeIso } from './formato';

describe('emissaoPadrao', () => {
  it('usa a data de criação do lote', () => {
    expect(emissaoPadrao([{ dtaCriacao: '2026-08-12' }])).toBe('2026-08-12');
  });

  it('com vários lotes, usa o mais antigo (CASSI 6526 + 6537)', () => {
    expect(emissaoPadrao([{ dtaCriacao: '2026-08-13' }, { dtaCriacao: '2026-08-12' }])).toBe('2026-08-12');
  });

  it('ignora lote sem data', () => {
    expect(emissaoPadrao([{ dtaCriacao: null }, { dtaCriacao: '2026-08-19' }])).toBe('2026-08-19');
  });

  it('sem lote com data, cai em hoje', () => {
    expect(emissaoPadrao([])).toBe(hojeIso());
    expect(emissaoPadrao([{ dtaCriacao: null }])).toBe(hojeIso());
  });
});
