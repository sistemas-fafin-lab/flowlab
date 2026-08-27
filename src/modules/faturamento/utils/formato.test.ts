import { describe, expect, it } from 'vitest';
import { formatDataHora, protocoloDuplicadoLotesLabel } from './formato';

describe('formatDataHora', () => {
  it('formata timestamptz em data + hora no padrão brasileiro', () => {
    expect(formatDataHora('2026-08-18T14:32:00.000Z')).toBe('18/08/2026, 11:32');
  });

  it('retorna travessão para valor ausente', () => {
    expect(formatDataHora(null)).toBe('—');
    expect(formatDataHora(undefined)).toBe('—');
  });
});

describe('protocoloDuplicadoLotesLabel', () => {
  it('lista os outros lotes do grupo quando conhecidos', () => {
    expect(protocoloDuplicadoLotesLabel([1234, 5678], 3)).toBe('lote(s) 1234, 5678');
  });

  it('cai para a contagem quando a lista de lotes não veio', () => {
    expect(protocoloDuplicadoLotesLabel(null, 3)).toBe('3 lotes');
    expect(protocoloDuplicadoLotesLabel([], 3)).toBe('3 lotes');
  });

  it('cai para "—" quando nem a lista nem a contagem vieram', () => {
    expect(protocoloDuplicadoLotesLabel(null, null)).toBe('—');
  });
});
