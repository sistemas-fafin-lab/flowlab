import { describe, expect, it } from 'vitest';
import {
  alertasDeOrcamento,
  consumoDoAno,
  orcadoNoPeriodo,
  orcadoPorMes,
  orcadoRealizadoPorCategoria,
  realizadoPorCategoria,
  statusConsumo,
} from './orcamento';
import type { Despesa, Lancamento, Orcamento } from '../types';

const orc = (categoriaId: string, ano: number, valorAnual: number): Orcamento => ({ id: `${categoriaId}-${ano}`, ano, categoriaId, valorAnual, observacao: null });
const orcamentos = [orc('ia', 2026, 12000), orc('saas', 2026, 24000), orc('ia', 2027, 18000)];
const nome = (id: string) => ({ ia: 'Inteligência Artificial', saas: 'SaaS', cloud: 'Cloud' })[id] ?? id;

describe('statusConsumo', () => {
  it('ok abaixo de 90%, atenção de 90 a 100, estourado acima; sem orçamento é null', () => {
    expect(statusConsumo(50)).toBe('ok');
    expect(statusConsumo(90)).toBe('atencao');
    expect(statusConsumo(100)).toBe('atencao');
    expect(statusConsumo(100.1)).toBe('estourado');
    expect(statusConsumo(null)).toBe('sem_orcamento');
  });
});

describe('orçado por mês e no período (RN13)', () => {
  it('anual ÷ 12, por ano do mês; ano sem orçamento fica null', () => {
    expect(orcadoPorMes(orcamentos, ['2026-11-01', '2026-12-01', '2027-01-01', '2028-01-01'])).toEqual([3000, 3000, 1500, null]);
  });

  it('filtra por categoria', () => {
    expect(orcadoPorMes(orcamentos, ['2026-10-01'], new Set(['ia']))).toEqual([1000]);
    expect(orcadoPorMes(orcamentos, ['2026-10-01'], new Set(['cloud']))).toEqual([null]);
  });

  it('soma do período; null se nenhum mês tem orçamento', () => {
    expect(orcadoNoPeriodo(orcamentos, ['2026-10-01', '2026-11-01', '2026-12-01'])).toBe(9000);
    expect(orcadoNoPeriodo(orcamentos, ['2028-01-01'])).toBeNull();
  });
});

const despesas = [{ id: 'd-ia', categoriaId: 'ia' }, { id: 'd-saas', categoriaId: 'saas' }, { id: 'd-cloud', categoriaId: 'cloud' }] as Despesa[];
const pago = (despesaId: string, competencia: string, valorPago: number, status: Lancamento['status'] = 'pago') =>
  ({ despesaId, competencia, status, valorPago: status === 'pago' ? valorPago : null }) as Lancamento;

describe('realizadoPorCategoria', () => {
  it('soma o pago do ano por categoria da despesa', () => {
    const r = realizadoPorCategoria(
      [pago('d-ia', '2026-01-01', 1000), pago('d-ia', '2026-02-01', 1500), pago('d-saas', '2026-03-01', 500), pago('d-ia', '2025-12-01', 9999), pago('d-saas', '2026-04-01', 0, 'previsto')],
      despesas,
      2026,
    );
    expect([...r.entries()]).toEqual([
      ['ia', 2500],
      ['saas', 500],
    ]);
  });
});

describe('orçado × realizado por categoria', () => {
  it('com orçamento primeiro (mais consumida antes), sem orçamento no fim', () => {
    const r = orcadoRealizadoPorCategoria(orcamentos, new Map([['ia', 11000], ['saas', 6000], ['cloud', 800]]), 2026, nome);
    expect(r.map((c) => [c.categoriaId, c.orcado, c.realizado, Math.round(c.percentual ?? -1), c.status])).toEqual([
      ['ia', 12000, 11000, 92, 'atencao'],
      ['saas', 24000, 6000, 25, 'ok'],
      ['cloud', null, 800, -1, 'sem_orcamento'],
    ]);
  });

  it('orçamento zero com gasto é estourado', () => {
    const [c] = orcadoRealizadoPorCategoria([orc('ia', 2026, 0)], new Map([['ia', 10]]), 2026, nome);
    expect(c.status).toBe('estourado');
  });
});

describe('consumoDoAno', () => {
  it('realizado ÷ orçamento do ano, com o ritmo esperado pelo mês atual', () => {
    const c = consumoDoAno(orcamentos, new Map([['ia', 9000], ['saas', 9000]]), 2026, '2026-10-15');
    expect(c.orcado).toBe(36000);
    expect(c.realizado).toBe(18000);
    expect(c.percentual).toBe(50);
    expect(c.ritmo).toBeCloseTo(83.33, 1);
    expect(c.status).toBe('ok');
  });

  it('ritmo 100 para ano passado, 0 para ano futuro; filtro de categoria', () => {
    expect(consumoDoAno(orcamentos, new Map(), 2025, '2026-10-15').ritmo).toBe(100);
    expect(consumoDoAno(orcamentos, new Map(), 2027, '2026-10-15').ritmo).toBe(0);
    const soIa = consumoDoAno(orcamentos, new Map([['ia', 6000], ['saas', 9000]]), 2026, '2026-10-15', new Set(['ia']));
    expect([soIa.orcado, soIa.realizado, soIa.percentual]).toEqual([12000, 6000, 50]);
  });

  it('sem orçamento no ano: percentual null', () => {
    expect(consumoDoAno(orcamentos, new Map([['ia', 100]]), 2030, '2026-10-15')).toMatchObject({ orcado: null, percentual: null, status: 'sem_orcamento' });
  });
});

describe('alertasDeOrcamento', () => {
  it('atenção é média, estourado é alta; ok e sem orçamento não geram alerta', () => {
    const consumos = orcadoRealizadoPorCategoria(orcamentos, new Map([['ia', 13000], ['saas', 22000], ['cloud', 500]]), 2026, nome);
    const alertas = alertasDeOrcamento(consumos, 2026);
    expect(alertas.map((a) => [a.severidade, a.titulo])).toEqual([
      ['alta', 'Inteligência Artificial estourou o orçamento de 2026'],
      ['media', 'SaaS já consumiu 92% do orçamento de 2026'],
    ]);
  });
});
