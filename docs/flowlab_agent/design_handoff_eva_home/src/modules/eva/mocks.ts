// Dados de exemplo do protótipo. Substituir por Supabase (it_requests / projetos / sprints),
// Wa-ha (fila de mensagens) e Granola (resumos de reunião) — ver services/evaService.ts.
import type { ChatMessage, DailyTask, EvaHomeSnapshot, IntegrationStatus, TeamMember } from './types';

export const MEMBERS: Record<string, TeamMember> = {
  ana: { id: 'ana', name: 'Ana Costa', initials: 'AC', gradient: 'linear-gradient(135deg,#3b82f6,#6366f1)' },
  bruno: { id: 'bruno', name: 'Bruno Mendes', initials: 'BM', gradient: 'linear-gradient(135deg,#10b981,#059669)' },
  carla: { id: 'carla', name: 'Carla Dias', initials: 'CD', gradient: 'linear-gradient(135deg,#f59e0b,#f97316)' },
  diego: { id: 'diego', name: 'Diego Souza', initials: 'DS', gradient: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' },
  rafael: { id: 'rafael', name: 'Rafael Lima', initials: 'RL', gradient: 'linear-gradient(135deg,#06b6d4,#3b82f6)' },
};

export const INTEGRATIONS: IntegrationStatus[] = [
  { id: 'granola', name: 'Granola', detail: 'API · sincronizado às 07:30', online: true },
  { id: 'waha', name: 'Wa-ha', detail: 'WhatsApp conectado', online: true },
];

export const MY_TASKS: DailyTask[] = [
  { id: 'm1', time: '09:30', title: 'Daily da equipe de TI', project: 'Reunião', done: true },
  { id: 'm2', time: '11:00', title: 'Validar seletor de convênios no LAB-HUB', project: 'Portal do Paciente', late: true, done: false },
  { id: 'm3', time: '14:30', title: 'Revisar PR de upload de carteirinha', project: 'Portal do Paciente', done: false },
  { id: 'm4', time: '16:00', title: 'Definir escopo da integração Granola', project: 'Agente EVA', done: false },
  { id: 'm5', time: '17:00', title: 'Aprovar templates de notificação AC', project: 'Notificações WhatsApp', done: false },
];

const OVERDUE = [
  { id: 't1', title: 'Aplicar migration de cultura avulsa em produção', project: 'Análises Clínicas', memberId: 'bruno', daysLate: 2, priority: 'critical' as const, lastChargeText: 'Cobrada às 10:12 · sem resposta', isMine: false },
  { id: 't2', title: 'Template de recoleta genérica para WhatsApp', project: 'Notificações WhatsApp', memberId: 'diego', daysLate: 3, priority: 'high' as const, lastChargeText: 'Cobrada ontem às 17:30 · respondeu “amanhã cedo”', isMine: false },
  { id: 't3', title: 'Regra de 24h para autorização do convênio', project: 'Portal do Paciente', memberId: 'ana', daysLate: 1, priority: 'high' as const, lastChargeText: 'Ainda não cobrada', isMine: false },
  { id: 't4', title: 'Validar seletor de convênios no LAB-HUB', project: 'Portal do Paciente', memberId: 'rafael', daysLate: 1, priority: 'medium' as const, lastChargeText: 'Lembrete enviado às 09:00', isMine: true },
];

const PROJECTS = [
  { id: 'p1', name: 'Portal do Paciente (LAB-HUB)', sprint: 'Sprint 6', done: 31, total: 40, due: '24/10', status: 'on_track' as const, isMine: true },
  { id: 'p2', name: 'Notificações WhatsApp · Análises Clínicas', sprint: 'Sprint 2', done: 7, total: 20, due: '07/11', status: 'at_risk' as const, isMine: true },
  { id: 'p3', name: 'Agente EVA', sprint: 'Sprint 1', done: 3, total: 15, due: '14/11', status: 'on_track' as const, isMine: true },
  { id: 'p4', name: 'Análises Clínicas · Fase 7', sprint: 'Sprint 4', done: 22, total: 25, due: '17/10', status: 'on_track' as const, isMine: false },
];

const MINE_INSIGHT = {
  id: 'myTasks-day', source: 'Agenda · hoje',
  text: 'Entre 14:30 e 16:00 você não tem reuniões. É o melhor horário para a revisão do PR, que libera 2 tasks da Ana.',
  ctaLabel: 'Bloquear agenda', doneText: 'Feito. Bloqueei 14:30–16:00.', askPrompt: 'Como organizo meu dia?',
};

export const SNAPSHOT_TEAM: EvaHomeSnapshot = {
  briefing: 'Hoje há 4 tasks atrasadas e 2 mensagens agendadas no WhatsApp. O board já reflete o sprint review de sexta, importado do Granola.',
  columns: [
    { key: 'backlog', count: 18, items: [{ title: 'Estudo de termômetros integrados', memberId: 'carla' }, { title: 'Lista fechada de convênios atendidos', memberId: 'ana' }] },
    { key: 'todo', count: 9, items: [{ title: 'Notificação 24h antes da coleta', memberId: 'diego' }, { title: 'Itens opcionais na conferência', memberId: 'carla' }] },
    { key: 'in_progress', count: 7, items: [{ title: 'Integração Granola via API', memberId: 'rafael' }, { title: 'Regra de 24h para autorização', memberId: 'ana' }] },
    { key: 'review', count: 6, items: [{ title: 'PR: upload de carteirinha (LAB-HUB)', memberId: 'ana' }, { title: 'Painel de temperatura · sparkline', memberId: 'ana' }] },
    { key: 'done', count: 23, items: [{ title: 'Agenda de posto (horários)', memberId: 'bruno' }, { title: 'Alerta de temperatura fora da faixa', memberId: 'carla' }] },
  ],
  overdue: OVERDUE,
  waQueue: [
    { id: 'w1', time: '17:30', to: 'Grupo Equipe TI', text: 'Fechamento do dia: tasks concluídas, pendências e prioridades de amanhã.', status: 'scheduled' },
    { id: 'w2', time: '14:00', to: 'Grupo Equipe TI', text: 'Resumo do sprint review de 10/10 com 5 pendências e responsáveis.', status: 'scheduled' },
    { id: 'w3', time: '10:12', to: 'Bruno Mendes', text: 'Bruno, a task “Aplicar migration de cultura avulsa” venceu há 2 dias. Consegue atualizar o status?', status: 'delivered' },
    { id: 'w4', time: '09:00', to: 'Ana Costa', text: 'Bom dia, Ana. Você tem 3 tasks para hoje e 4 cards aguardando em Revisão.', status: 'read' },
    { id: 'w5', time: '08:45', to: 'Diego Souza', text: 'Bom dia, Diego. Você tem 2 tasks para hoje, 1 atrasada.', status: 'failed', note: 'Sessão Wa-ha desconectada · reenviada às 08:52' },
  ],
  projects: PROJECTS,
  stats: { overdueHint: '1 crítica', doneThisWeek: 23, chargesToday: 6, myOpen: 8, myProjects: 3, myProjectsHint: '1 em risco' },
  insights: {
    kanban: {
      id: 'kanban-team', source: 'Board · agora',
      text: 'A coluna Revisão acumulou 6 cards, 4 deles com a Ana. O Diego tem capacidade livre esta semana: sugiro mover 2 revisões para ele.',
      ctaLabel: 'Redistribuir', doneText: 'Feito. Movi 2 revisões para o Diego e avisei os dois no WhatsApp.', askPrompt: 'Quem está sobrecarregado?',
    },
    overdue: {
      id: 'overdue-team', source: 'Board · Wa-ha',
      text: 'O Bruno não respondeu a cobrança das 10:12. Ele está no plantão de coleta até 13h, então reagendei uma nova cobrança para 13:15.',
      ctaLabel: 'Manter 13:15', doneText: 'Combinado. Cobrança mantida para 13:15.', askPrompt: 'O que está atrasado?',
    },
    whatsapp: {
      id: 'wa-team', source: 'Wa-ha · 08:52',
      text: 'A sessão do Wa-ha caiu às 08:45 e uma mensagem para o Diego falhou. Reconectei às 08:52 e reenviei.',
      ctaLabel: 'Ver logs', doneText: 'Logs abertos em Sistema › Provedores de Mensagens.', askPrompt: 'Como está a fila do WhatsApp?',
    },
    projects: {
      id: 'projects-team', source: 'Granola · Sprint review 10/10',
      text: 'Na reunião de sexta ficou decidido adiar a Etapa B da recoleta. Atualizei o prazo de Notificações WhatsApp para 07/11 e marquei o projeto como em risco.',
      ctaLabel: 'Ver resumo da reunião', doneText: 'Resumo aberto no chat da EVA.', askPrompt: 'Resumo da última reunião',
    },
    myTasks: MINE_INSIGHT,
  },
};

export const SNAPSHOT_ME: EvaHomeSnapshot = {
  briefing: 'Você tem 5 tasks hoje, {late} atrasada. Reservei a tarde para a revisão do PR do Portal do Paciente.',
  columns: [
    { key: 'backlog', count: 2, items: [{ title: 'Roteiro de testes da EVA', memberId: 'rafael' }] },
    { key: 'todo', count: 3, items: [{ title: 'Aprovar templates de notificação AC', memberId: 'rafael' }, { title: 'Definir escopo da integração Granola', memberId: 'rafael' }] },
    { key: 'in_progress', count: 2, items: [{ title: 'Integração Granola via API', memberId: 'rafael' }, { title: 'Validar seletor de convênios', memberId: 'rafael' }] },
    { key: 'review', count: 1, items: [{ title: 'PR: upload de carteirinha (LAB-HUB)', memberId: 'rafael' }] },
    { key: 'done', count: 5, items: [{ title: 'Daily da equipe de TI', memberId: 'rafael' }] },
  ],
  overdue: OVERDUE.filter((t) => t.isMine),
  waQueue: [
    { id: 'wm1', time: '14:20', to: 'Rafael Lima', text: 'Lembrete: revisão do PR de upload de carteirinha às 14:30.', status: 'scheduled' },
    { id: 'wm2', time: '09:00', to: 'Rafael Lima', text: 'Bom dia, Rafael. Você tem 5 tasks hoje, 1 atrasada: validar seletor de convênios.', status: 'read' },
    { id: 'wm3', time: '08:10', to: 'Rafael Lima', text: 'Resumo do sprint review de sexta disponível. 2 pendências são suas.', status: 'read' },
  ],
  projects: PROJECTS.filter((p) => p.isMine),
  stats: { overdueHint: 'Validar seletor de convênios', doneThisWeek: 5, chargesToday: 0, myOpen: 8, myProjects: 3, myProjectsHint: '1 em risco' },
  insights: {
    kanban: {
      id: 'kanban-me', source: 'Board · agora',
      text: 'Você tem 1 card parado em Revisão há 3 dias: o PR de upload de carteirinha. Ele bloqueia 2 tasks da Ana no Portal do Paciente.',
      ctaLabel: 'Reservar horário', doneText: 'Feito. Reservei 14:30–15:30 na sua agenda e avisei a Ana.', askPrompt: 'O que está bloqueado por mim?',
    },
    overdue: {
      id: 'overdue-me', source: 'Board · Portal do Paciente',
      text: 'A validação do seletor de convênios venceu ontem. A Ana precisa dela para fechar a regra de 24h.',
      ctaLabel: 'Lembrar às 11:00', doneText: 'Combinado. Vou lembrar você às 11:00 pelo WhatsApp.', askPrompt: 'O que está atrasado?',
    },
    whatsapp: {
      id: 'wa-me', source: 'Wa-ha · hoje',
      text: 'Você recebeu 2 mensagens minhas hoje. Às 14:20 envio o lembrete da revisão do PR.',
      ctaLabel: 'Silenciar até 14:00', doneText: 'Pronto. Nenhuma mensagem até 14:00.', askPrompt: 'Quais mensagens estão na fila?',
    },
    projects: {
      id: 'projects-me', source: 'Granola · Sprint review 10/10',
      text: 'Na reunião de sexta ficou decidido adiar a Etapa B da recoleta. Atualizei o prazo de Notificações WhatsApp para 07/11.',
      ctaLabel: 'Ver resumo da reunião', doneText: 'Resumo aberto no chat da EVA.', askPrompt: 'Resumo da última reunião',
    },
    myTasks: MINE_INSIGHT,
  },
};

export const INITIAL_CHAT: ChatMessage[] = [
  { id: 'c0', from: 'eva', text: 'Bom dia, Rafael. Li o resumo do sprint review de sexta no Granola e atualizei o board. Como posso ajudar?' },
];
