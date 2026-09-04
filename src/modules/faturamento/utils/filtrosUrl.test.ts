import { describe, expect, it } from 'vitest';
import { idFontePagadoraInicialDaUrl, periodoInicialDaUrl } from './filtrosUrl';

describe('periodoInicialDaUrl', () => {
  it('lê período quando os dois parâmetros vêm em YYYY-MM-DD', () => {
    const params = new URLSearchParams({ periodoIni: '2026-01-01', periodoFim: '2026-01-31' });
    expect(periodoInicialDaUrl(params)).toEqual({ periodoIni: '2026-01-01', periodoFim: '2026-01-31' });
  });

  it('ignora quando não há nenhum parâmetro de período', () => {
    expect(periodoInicialDaUrl(new URLSearchParams())).toBeNull();
  });

  it('ignora período parcial (só periodoIni)', () => {
    const params = new URLSearchParams({ periodoIni: '2026-01-01' });
    expect(periodoInicialDaUrl(params)).toBeNull();
  });

  it('ignora período parcial (só periodoFim)', () => {
    const params = new URLSearchParams({ periodoFim: '2026-01-31' });
    expect(periodoInicialDaUrl(params)).toBeNull();
  });

  it('ignora datas fora do formato YYYY-MM-DD', () => {
    const params = new URLSearchParams({ periodoIni: '01/01/2026', periodoFim: '2026-01-31' });
    expect(periodoInicialDaUrl(params)).toBeNull();
  });
});

describe('idFontePagadoraInicialDaUrl', () => {
  it('lê um id inteiro positivo', () => {
    expect(idFontePagadoraInicialDaUrl(new URLSearchParams({ idFontePagadora: '1025' }))).toBe(1025);
  });

  it('devolve undefined quando o parâmetro está ausente', () => {
    expect(idFontePagadoraInicialDaUrl(new URLSearchParams())).toBeUndefined();
  });

  it('devolve undefined para valor não numérico', () => {
    expect(idFontePagadoraInicialDaUrl(new URLSearchParams({ idFontePagadora: 'abc' }))).toBeUndefined();
  });

  it('devolve undefined para zero ou negativo', () => {
    expect(idFontePagadoraInicialDaUrl(new URLSearchParams({ idFontePagadora: '0' }))).toBeUndefined();
    expect(idFontePagadoraInicialDaUrl(new URLSearchParams({ idFontePagadora: '-5' }))).toBeUndefined();
  });

  it('devolve undefined para valor decimal', () => {
    expect(idFontePagadoraInicialDaUrl(new URLSearchParams({ idFontePagadora: '10.5' }))).toBeUndefined();
  });
});
