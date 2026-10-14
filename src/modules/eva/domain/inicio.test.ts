import { describe, expect, it } from 'vitest';
import { montarSnapshot, type EntradaInicio } from './inicio';
import { card, projeto, sprint } from './testes/fabricas';

const HOJE = '2026-10-13';
const EU = 'u-eu';
const OUTRO = 'u-outro';

function entrada(parcial: Partial<EntradaInicio>): EntradaInicio {
  return {
    visao: 'team',
    usuarioId: EU,
    hoje: HOJE,
    cards: [],
    projetos: [],
    sprints: [],
    pessoas: [{ id: EU, name: 'Rafael Lima' }, { id: OUTRO, name: 'Ana Costa' }],
    cobrancasHoje: null,
    ...parcial,
  };
}

const valor = (s: ReturnType<typeof montarSnapshot>, key: string) => s.stats.find((x) => x.key === key)?.value;

describe('montarSnapshot — visão Equipe', () => {
  it('conta abertos, atrasados e concluídos da semana; cobranças ficam "—" antes do WhatsApp', () => {
    const s = montarSnapshot(entrada({
      cards: [
        card({ kanban_status: 'todo' }),
        card({ kanban_status: 'in_progress', due_date: '2026-10-10', priority: 'critical' }),
        card({ kanban_status: 'done', status: 'resolved', updated_at: '2026-10-12T10:00:00Z' }),
        card({ kanban_status: 'todo', kanban_hidden: true }),
      ],
    }));
    expect(valor(s, 'open')).toBe(2);
    expect(valor(s, 'overdue')).toBe(1);
    expect(s.stats.find((x) => x.key === 'overdue')?.hint).toBe('1 crítica');
    expect(valor(s, 'done')).toBe(1);
    expect(valor(s, 'charges')).toBe('—');
    expect(s.totalCards).toBe(3);
  });

  it('briefing sem atrasadas não diz "0 tasks atrasadas"', () => {
    const s = montarSnapshot(entrada({ cards: [card({ kanban_status: 'todo' })] }));
    expect(s.briefing).toBe('Nenhuma task atrasada hoje.');
    expect(s.briefing).not.toMatch(/\b0\b/);
  });

  it('briefing com atrasadas e cards vencendo, no singular e no plural', () => {
    const s = montarSnapshot(entrada({
      cards: [card({ due_date: '2026-10-12' }), card({ due_date: '2026-10-15' }), card({ due_date: '2026-10-16' })],
    }));
    expect(s.briefing).toBe('Hoje há 1 task atrasada. 2 cards vencem nos próximos 7 dias.');
  });

  it('atrasada mostra o projeto, o responsável e se é minha', () => {
    const p = projeto({ name: 'Portal do Paciente' });
    const s = montarSnapshot(entrada({
      projetos: [p],
      cards: [card({ project_id: p.id, assigned_to: [OUTRO], due_date: '2026-10-11' })],
    }));
    expect(s.overdue[0]).toMatchObject({ project: 'Portal do Paciente', memberId: OUTRO, daysLate: 2, isMine: false });
    expect(s.members[OUTRO]).toMatchObject({ name: 'Ana Costa', initials: 'AC' });
  });
});

describe('montarSnapshot — Minha visão', () => {
  it('só os meus cards; "Hoje" conta x/y das tasks do dia', () => {
    const s = montarSnapshot(entrada({
      visao: 'me',
      cards: [
        card({ assigned_to: [EU], due_date: HOJE }),
        card({ assigned_to: [EU], due_date: HOJE, kanban_status: 'done', status: 'resolved', updated_at: '2026-10-13T15:00:00Z' }),
        card({ assigned_to: [OUTRO], due_date: '2026-10-01' }),
      ],
    }));
    expect(valor(s, 'open')).toBe(1);
    expect(valor(s, 'overdue')).toBe(0);
    expect(valor(s, 'today')).toBe('1/2');
    expect(s.myTasks).toHaveLength(2);
    expect(s.briefing).toBe('Você tem 1 task para hoje.');
  });

  it('projetos: só os que têm card meu; dica conta os em risco', () => {
    const meu = projeto({ name: 'Meu' });
    const alheio = projeto({ name: 'Alheio' });
    const s = montarSnapshot(entrada({
      visao: 'me',
      projetos: [meu, alheio],
      sprints: [sprint({ project_id: meu.id, start_date: '2026-10-06', end_date: '2026-10-30' })],
      cards: [
        card({ project_id: meu.id, assigned_to: [EU], due_date: '2026-10-10' }),
        card({ project_id: alheio.id, assigned_to: [OUTRO] }),
      ],
    }));
    expect(s.projects.map((p) => p.name)).toEqual(['Meu']);
    expect(s.projects[0]).toMatchObject({ status: 'late', due: '30/10', isMine: true });
    expect(s.stats.find((x) => x.key === 'projects')?.hint).toBe('1 em risco');
  });

  it('sem tasks no dia: briefing e dica próprios', () => {
    const s = montarSnapshot(entrada({ visao: 'me', cards: [] }));
    expect(s.briefing).toBe('Você não tem tasks pendentes para hoje.');
    expect(s.stats.find((x) => x.key === 'today')).toMatchObject({ value: '0/0', hint: 'Nada vence hoje' });
  });
});
