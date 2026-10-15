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
import { PropostaChatCard } from './PropostaChatCard';
import { AvisoChatCard } from './AvisoChatCard';
import { mensagensDaFila } from './fila';
import type { OverdueRow } from '../hooks/useEvaHome';
import type { MensagemFila } from '../domain/whatsapp';
import type { AvisoEva, PropostaEva } from '../types';

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
  return s.overdue.map((t) => ({ ...t, charged: false, memberName: 'Rafael Lima', lateLabel: '1 dia', statusText: '', chargeable: false }));
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

  it('proposta do chat: o botão depende de quem confirma, e nada diz que já mudou (D28)', () => {
    const p: PropostaEva = {
      id: 'p1', tipo: 'atualizar_card', card_id: 'c1', trecho: 'move o IT-045 para revisão', confianca: 'alta', avisos: [], estado: 'aberta',
      proposta: { kanban_status: 'review' },
      card: { id: 'c1', codigo: 'IT-045', title: 'Robô de pré-faturamento', kanban_status: 'in_progress', priority: 'high', due_date: null, assigned_to: [] },
    };
    const gestor = render(h(PropostaChatCard, { p, podeAprovar: true, nome: () => 'Ana', onConfirmar: noop, onDescartar: noop }));
    expect(gestor).toContain('Aprovar e executar');
    expect(gestor).toContain('Em Progresso');
    expect(gestor).toContain('Revisão');
    expect(render(h(PropostaChatCard, { p, podeAprovar: false, nome: () => 'Ana', onConfirmar: noop, onDescartar: noop }))).toContain('Enviar para aprovação');
    expect(render(h(PropostaChatCard, { p: { ...p, estado: 'na_fila' }, podeAprovar: false, nome: () => 'Ana', onConfirmar: noop, onDescartar: noop }))).toContain('Enviada para aprovação');
  });

  it('Cobrar/Lembrar só onde pode; sem WhatsApp, desabilitado com a dica (D22)', () => {
    const [r] = linhas(snapshot(false));
    const html = (row: OverdueRow) => render(h(OverdueCard, { rows: [row], filter: 'all', onFilterChange: noop, onOpenCard: noop, onCharge: noop }));
    expect(html({ ...r, chargeable: false })).not.toContain('>Lembrar<');
    expect(html({ ...r, chargeable: true })).toContain('>Lembrar<');
    const semZap = html({ ...r, chargeable: true, chargeHint: 'Você não tem WhatsApp com adesão à cobrança (EVA → Membros).' });
    expect(semZap).toContain('disabled=""');
    expect(semZap).toContain('title="Você não tem WhatsApp');
    expect(html({ ...r, chargeable: true, charged: true, statusText: 'Cobrança enviada agora via WhatsApp' })).toContain('>Cobrada<');
  });

  it('fila do WhatsApp com mensagens reais', () => {
    const fila: MensagemFila[] = [
      { id: 'a', membro_id: 'm', membro_user_id: 'u', membro_nome: 'Ana Costa', direcao: 'saida', tipo: 'cobranca', texto: 'Bom dia, Ana!', card_ids: [], status: 'enviada', erro: null, created_at: '2026-10-13T11:05:00Z', enviada_em: '2026-10-13T11:05:10Z' },
      { id: 'b', membro_id: 'm', membro_user_id: 'u', membro_nome: 'Ana Costa', direcao: 'entrada', tipo: 'recebida', texto: 'IT-045 concluída', card_ids: [], status: 'recebida', erro: null, created_at: '2026-10-13T11:20:00Z', enviada_em: null },
      { id: 'c', membro_id: 'm2', membro_user_id: 'u2', membro_nome: 'Diego Lima', direcao: 'saida', tipo: 'teste', texto: 'Teste', card_ids: [], status: 'falhou', erro: 'O número não está no WhatsApp.', created_at: '2026-10-13T11:45:00Z', enviada_em: null },
      { id: 'd', membro_id: null, membro_user_id: null, membro_nome: null, direcao: 'saida', tipo: 'grupo', texto: 'Fechamento do dia', card_ids: [], status: 'pendente', erro: null, created_at: '2026-10-13T21:00:00Z', enviada_em: null, chat_id_destino: '120363000000000001@g.us' },
    ];
    const msgs = mensagensDaFila(fila, HOJE, null);
    expect(msgs.map((m) => [m.to, m.status, m.time])).toEqual([['Ana Costa', 'sent', '08:05'], ['Diego Lima', 'failed', '08:45'], ['Grupo da equipe', 'scheduled', '18:00']]);
    expect(mensagensDaFila(fila, HOJE, 'u2')).toHaveLength(1);
    const html = render(h(WhatsAppQueueCard, { messages: msgs, ativa: true }));
    expect(html).toContain('Ao vivo');
    expect(html).toContain('Enviada');
    expect(html).toContain('O número não está no WhatsApp.');
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

describe('aviso pelo WhatsApp no chat (D32)', () => {
  const aviso: AvisoEva = { id: 'a1', pessoaId: 'u-bruno', nome: 'Bruno Mendes', texto: 'A reunião mudou para as 10h.', estado: 'aberto' };
  it('mostra para quem vai, o texto editável e o botão de enviar; depois, onde está', () => {
    const aberto = render(h(AvisoChatCard, { a: aviso, onEnviar: () => undefined, onDescartar: () => undefined }));
    expect(aberto).toContain('Aviso pelo WhatsApp · para Bruno');
    expect(aberto).toContain('A reunião mudou para as 10h.</textarea>');
    expect(aberto).toContain('Enviar pelo WhatsApp');
    expect(render(h(AvisoChatCard, { a: { ...aviso, estado: 'enviado', agendadaPara: null }, onEnviar: () => undefined, onDescartar: () => undefined }))).toContain('Na fila do WhatsApp: sai em instantes.');
    expect(render(h(AvisoChatCard, { a: { ...aviso, estado: 'enviado', agendadaPara: '2026-10-19T10:00:00.000Z' }, onEnviar: () => undefined, onDescartar: () => undefined }))).toContain('Fora do horário da EVA: sai');
    expect(render(h(AvisoChatCard, { a: { ...aviso, estado: 'descartado' }, onEnviar: () => undefined, onDescartar: () => undefined }))).toContain('Nada foi enviado.');
  });
});
