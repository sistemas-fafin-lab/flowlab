import { describe, expect, it } from 'vitest';
import {
  concluidoNaSemana, diasDeAtraso, estaAberto, estaAtrasado, estaParado, ordenarAtrasados, resumoKanban, tasksDoDia,
  venceEmBreve,
} from './demandas';
import { card } from './testes/fabricas';

const HOJE = '2026-10-13'; // terça

describe('estaAberto (RN01)', () => {
  it('card em done com status ainda pending não é aberto', () => {
    expect(estaAberto(card({ kanban_status: 'done', status: 'pending' }))).toBe(false);
  });
  it('resolvido fora da coluna done também não é aberto', () => {
    expect(estaAberto(card({ kanban_status: 'review', status: 'resolved' }))).toBe(false);
  });
  it('oculto no Kanban e cancelado ficam de fora', () => {
    expect(estaAberto(card({ kanban_hidden: true }))).toBe(false);
    expect(estaAberto(card({ status: 'cancelled' }))).toBe(false);
  });
});

describe('estaAtrasado (RN02)', () => {
  it('card que vence às 21h de hoje (Brasília) não está atrasado', () => {
    // 2026-10-14T00:00Z = 13/10 21h em SP
    expect(estaAtrasado(card({ due_date: '2026-10-14T00:00:00Z' }), HOJE)).toBe(false);
  });
  it('venceu ontem: atrasado há 1 dia', () => {
    const c = card({ due_date: '2026-10-12' });
    expect(estaAtrasado(c, HOJE)).toBe(true);
    expect(diasDeAtraso(c, HOJE)).toBe(1);
  });
  it('sem prazo nunca está atrasado', () => {
    expect(estaAtrasado(card({ due_date: null }), HOJE)).toBe(false);
  });
  it('concluído não está atrasado mesmo com prazo vencido', () => {
    expect(estaAtrasado(card({ due_date: '2026-10-01', kanban_status: 'done' }), HOJE)).toBe(false);
  });
});

describe('venceEmBreve (RN03)', () => {
  it('conta hoje e o limite, não conta o dia seguinte ao limite', () => {
    expect(venceEmBreve(card({ due_date: HOJE }), HOJE, 7)).toBe(true);
    expect(venceEmBreve(card({ due_date: '2026-10-20' }), HOJE, 7)).toBe(true);
    expect(venceEmBreve(card({ due_date: '2026-10-21' }), HOJE, 7)).toBe(false);
    expect(venceEmBreve(card({ due_date: '2026-10-12' }), HOJE, 7)).toBe(false);
  });
});

describe('estaParado (RN04)', () => {
  it('em andamento sem mudança há 5 dias está parado', () => {
    expect(estaParado(card({ kanban_status: 'in_progress', updated_at: '2026-10-08T15:00:00Z' }), HOJE, 5)).toBe(true);
  });
  it('um comentário recente tira o card de parado', () => {
    const c = card({ kanban_status: 'in_progress', updated_at: '2026-10-01T15:00:00Z' });
    expect(estaParado(c, HOJE, 5, '2026-10-12T10:00:00Z')).toBe(false);
  });
  it('só vale para em andamento e revisão', () => {
    expect(estaParado(card({ kanban_status: 'todo', updated_at: '2026-09-01T00:00:00Z' }), HOJE, 5)).toBe(false);
  });
});

describe('tasksDoDia (D23)', () => {
  const eu = 'u1';
  it('entram os meus que vencem hoje ou estão atrasados; vence amanhã não entra', () => {
    const hoje = card({ assigned_to: [eu], due_date: HOJE });
    const atrasado = card({ assigned_to: [eu], due_date: '2026-10-10' });
    const amanha = card({ assigned_to: [eu], due_date: '2026-10-14' });
    const deOutro = card({ assigned_to: ['u2'], due_date: HOJE });
    const lista = tasksDoDia([hoje, atrasado, amanha, deOutro], eu, HOJE);
    expect(lista.map((c) => c.id)).toEqual([atrasado.id, hoje.id]);
  });
  it('concluído hoje continua na lista (marcado); concluído antes sai', () => {
    const feitoHoje = card({ assigned_to: [eu], due_date: HOJE, kanban_status: 'done', status: 'resolved', updated_at: '2026-10-13T14:00:00Z' });
    const feitoOntem = card({ assigned_to: [eu], due_date: '2026-10-12', kanban_status: 'done', status: 'resolved', updated_at: '2026-10-12T14:00:00Z' });
    expect(tasksDoDia([feitoHoje, feitoOntem], eu, HOJE).map((c) => c.id)).toEqual([feitoHoje.id]);
  });
});

describe('resumoKanban', () => {
  it('no máximo 2 destaques: maior prioridade, depois prazo mais próximo, depois o mais recente', () => {
    const baixa = card({ kanban_status: 'review', priority: 'low' });
    const altaLonge = card({ kanban_status: 'review', priority: 'high', due_date: '2026-10-30' });
    const altaPerto = card({ kanban_status: 'review', priority: 'high', due_date: '2026-10-15' });
    const critica = card({ kanban_status: 'review', priority: 'critical' });
    const review = resumoKanban([baixa, altaLonge, altaPerto, critica], HOJE).find((c) => c.coluna === 'review')!;
    expect(review.total).toBe(4);
    expect(review.destaques.map((c) => c.id)).toEqual([critica.id, altaPerto.id]);
  });
  it('em "Concluído" só conta o que foi concluído nesta semana', () => {
    const daSemana = card({ kanban_status: 'done', updated_at: '2026-10-12T10:00:00Z' });
    const antigo = card({ kanban_status: 'done', updated_at: '2026-10-09T10:00:00Z' });
    const done = resumoKanban([daSemana, antigo], HOJE).find((c) => c.coluna === 'done')!;
    expect(done.total).toBe(1);
    expect(concluidoNaSemana(antigo, HOJE)).toBe(false);
  });
});

describe('ordenarAtrasados', () => {
  it('do mais atrasado para o menos, desempate por prioridade', () => {
    const a = card({ due_date: '2026-10-12', priority: 'low' });
    const b = card({ due_date: '2026-10-10', priority: 'low' });
    const c = card({ due_date: '2026-10-12', priority: 'critical' });
    expect(ordenarAtrasados([a, b, c], HOJE).map((x) => x.id)).toEqual([b.id, c.id, a.id]);
  });
});
