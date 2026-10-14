import { describe, expect, it } from 'vitest';
import { padraoContem, valorCitadoPostgrest } from './buscaLike';

describe('padraoContem', () => {
  it('envolve o termo em % para "contém"', () => {
    expect(padraoContem('6982')).toBe('%6982%');
  });

  it('escapa % e _ para serem literais no LIKE', () => {
    expect(padraoContem('10%')).toBe('%10\\%%');
    expect(padraoContem('a_b')).toBe('%a\\_b%');
  });

  it('escapa a própria barra antes, para ela não virar escape do caractere seguinte', () => {
    expect(padraoContem('a\\b')).toBe('%a\\\\b%');
  });
});

describe('valorCitadoPostgrest', () => {
  // O parser de valor citado do PostgREST remove a barra de toda sequência
  // `\x` — conferido em produção em 14/10/2026: `"%\%%"` casava todas as
  // observações; `"%\\%%"` só as que têm % literal.
  it('dobra as barras para o escape do LIKE sobreviver ao parser do PostgREST', () => {
    expect(valorCitadoPostgrest('%10\\%%')).toBe('"%10\\\\%%"');
  });

  it('escapa aspas duplas e cerca o valor com aspas', () => {
    expect(valorCitadoPostgrest('%a"b,c%')).toBe('"%a\\"b,c%"');
  });
});
