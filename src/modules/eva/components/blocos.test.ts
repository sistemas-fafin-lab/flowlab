// Teste de fumaça: os blocos do Início renderizam com um snapshot real do domínio,
// cheio e vazio, sem quebrar. Sem jsdom no projeto: renderToStaticMarkup no node.
import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { montarSnapshot } from '../domain/inicio';
import { card, projeto, sprint } from '../domain/testes/fabricas';
import { KanbanSummaryCard } from './KanbanSummaryCard';
import { OverdueCard } from './OverdueCard';
import { ProjectsCard } from './ProjectsCard';
import { MyTasksCard } from './MyTasksCard';
import { WhatsAppQueueCard } from './WhatsAppQueueCard';
import { EvaStatCards } from './EvaStatCards';
import type { OverdueRow } from '../hooks/useEvaHome';

const HOJE = '2026-10-13';
const EU = 'u-eu';
const noop = () => undefined;
const render = (el: ReturnType<typeof h>) => renderToStaticMarkup(h(StaticRouter, { location: '/it/inicio' }, el));

function snapshot(vazio: boolean) {
  const p = projeto({ name: 'Portal do Paciente' });
  return montarSnapshot({
    visao: 'team',
    usuarioId: EU,
    hoje: HOJE,
    projetos: vazio ? [] : [p],
    sprints: vazio ? [] : [sprint({ project_id: p.id, name: 'Sprint 6', start_date: '2026-10-06', end_date: '2026-10-24' })],
    pessoas: [{ id: EU, name: 'Rafael Lima' }],
    cards: vazio
      ? []
      : [
          card({ title: 'Validar seletor de convênios', project_id: p.id, assigned_to: [EU], due_date: '2026-10-12', priority: 'high' }),
          card({ title: 'Revisar PR de upload', project_id: p.id, kanban_status: 'review', assigned_to: [EU], due_date: HOJE }),
          card({ title: 'Sem responsável', kanban_status: 'backlog' }),
        ],
    cobrancasHoje: null,
  });
}

function linhas(s: ReturnType<typeof montarSnapshot>): OverdueRow[] {
  return s.overdue.map((t) => ({ ...t, charged: false, memberName: 'Rafael Lima', lateLabel: '1 dia', statusText: '' }));
}

describe('blocos do Início (fumaça)', () => {
  it('renderizam com dados', () => {
    const s = snapshot(false);
    const html = [
      render(h(EvaStatCards, { stats: s.stats })),
      render(h(KanbanSummaryCard, { view: 'team', columns: s.columns, total: s.totalCards, members: s.members, onOpenCard: noop })),
      render(h(OverdueCard, { rows: linhas(s), filter: 'all', onFilterChange: noop, onOpenCard: noop })),
      render(h(ProjectsCard, { projects: s.projects })),
      render(h(MyTasksCard, { tasks: s.myTasks, doneCount: 0, onToggle: noop })),
    ].join('');
    expect(html).toContain('Validar seletor de convênios');
    expect(html).toContain('Portal do Paciente');
    expect(html).toContain('Sprint 6');
    expect(html).toContain('Sem responsável');
    // Antes da Fase 3 não há botão de cobrar.
    expect(html).not.toContain('>Cobrar<');
  });

  it('mostram estados vazios em vez de quebrar', () => {
    const s = snapshot(true);
    const html = [
      render(h(KanbanSummaryCard, { view: 'me', columns: s.columns, total: s.totalCards, members: s.members, onOpenCard: noop })),
      render(h(OverdueCard, { rows: [], filter: 'all', onFilterChange: noop, onOpenCard: noop })),
      render(h(ProjectsCard, { projects: [] })),
      render(h(MyTasksCard, { tasks: [], doneCount: 0, onToggle: noop })),
      render(h(WhatsAppQueueCard, { messages: [], ativa: false })),
    ].join('');
    expect(html).toContain('Nenhuma task atrasada');
    expect(html).toContain('Nenhum projeto com sprint ativa ou card aberto.');
    expect(html).toContain('Nenhum card seu vence hoje');
    expect(html).toContain('Ainda não ligada');
  });
});
