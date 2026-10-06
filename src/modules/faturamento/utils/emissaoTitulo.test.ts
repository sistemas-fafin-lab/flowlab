import { describe, expect, it } from 'vitest';
import { emissaoPadrao } from './emissaoTitulo';
import { hojeIso } from './formato';

describe('emissaoPadrao', () => {
  it('usa a data de fechamento do lote', () => {
    expect(emissaoPadrao([{ dtaFechamento: '2026-10-01' }])).toBe('2026-10-01');
  });

  it('com vários lotes, usa o fechamento mais recente', () => {
    expect(emissaoPadrao([{ dtaFechamento: '2026-10-01' }, { dtaFechamento: '2026-09-30' }])).toBe('2026-10-01');
  });

  it('ignora lote sem fechamento', () => {
    expect(emissaoPadrao([{ dtaFechamento: null }, { dtaFechamento: '2026-08-19' }])).toBe('2026-08-19');
  });

  it('sem lote fechado, cai em hoje', () => {
    expect(emissaoPadrao([])).toBe(hojeIso());
    expect(emissaoPadrao([{ dtaFechamento: null }])).toBe(hojeIso());
  });
});
