import { describe, expect, it } from 'vitest';
import { agruparPorAno, anosDisponiveis, filtrarRecibos, reciboCasaBusca } from './recibosFiltro';

const recibos = [
  { competencia: '2025-12-01' },
  { competencia: '2026-03-01' },
  { competencia: '2026-09-01' },
  { competencia: '2025-03-01' },
];

describe('reciboCasaBusca', () => {
  it('nome do mês sem acento', () => expect(reciboCasaBusca('2026-03-01', 'marco')).toBe(true));
  it('nome do mês com acento', () => expect(reciboCasaBusca('2026-03-01', 'Março')).toBe(true));
  it('MM/AAAA', () => expect(reciboCasaBusca('2026-03-01', '03/2026')).toBe(true));
  it('ano', () => expect(reciboCasaBusca('2026-03-01', '2026')).toBe(true));
  it('mês + ano', () => expect(reciboCasaBusca('2026-03-01', 'março 2025')).toBe(false));
  it('prefixo do mês', () => expect(reciboCasaBusca('2026-09-01', 'set')).toBe(true));
  it('busca vazia casa tudo', () => expect(reciboCasaBusca('2026-09-01', '  ')).toBe(true));
});

describe('anosDisponiveis', () => {
  it('únicos e decrescentes', () => expect(anosDisponiveis(recibos)).toEqual([2026, 2025]));
});

describe('filtrarRecibos', () => {
  it('por ano', () => expect(filtrarRecibos(recibos, '', 2025).map((r) => r.competencia)).toEqual(['2025-12-01', '2025-03-01']));
  it('por busca e ano', () => expect(filtrarRecibos(recibos, 'março', 2026)).toEqual([{ competencia: '2026-03-01' }]));
});

describe('agruparPorAno', () => {
  it('agrupa e ordena desc', () => {
    expect(agruparPorAno(recibos)).toEqual([
      { ano: 2026, recibos: [{ competencia: '2026-09-01' }, { competencia: '2026-03-01' }] },
      { ano: 2025, recibos: [{ competencia: '2025-12-01' }, { competencia: '2025-03-01' }] },
    ]);
  });
});
