import { describe, expect, it } from 'vitest';
import { PALETA_COR_RISCO_DEFAULT, corDoRisco } from './rotulos';

describe('corDoRisco', () => {
  it('usa a cor escolhida manualmente quando presente', () => {
    expect(corDoRisco({ id: 'r1', cor: '#123456' })).toEqual({ light: '#123456', dark: '#123456' });
  });

  it('é determinística: o mesmo id sempre cai na mesma cor da paleta default', () => {
    const primeira = corDoRisco({ id: 'risco-abc', cor: null });
    const segunda = corDoRisco({ id: 'risco-abc', cor: null });
    expect(primeira).toEqual(segunda);
    expect(PALETA_COR_RISCO_DEFAULT).toContainEqual(primeira);
  });

  it('ids diferentes podem cair em cores diferentes da paleta', () => {
    const cores = new Set(
      ['risco-1', 'risco-2', 'risco-3', 'risco-4', 'risco-5'].map((id) => corDoRisco({ id, cor: null }).light),
    );
    expect(cores.size).toBeGreaterThan(1);
  });
});
