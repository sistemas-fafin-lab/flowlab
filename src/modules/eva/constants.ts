import type { BadgeTone, KanbanColumnKey, Priority, ProjectStatus, WaStatus } from './types';

// Mesmas cores/rótulos de ITProjectDashboard.tsx
export const KANBAN_STATUS_COLORS: Record<KanbanColumnKey, string> = {
  backlog: '#64748b',
  todo: '#3b82f6',
  in_progress: '#f59e0b',
  review: '#8b5cf6',
  done: '#10b981',
};

export const KANBAN_STATUS_LABELS: Record<KanbanColumnKey, string> = {
  backlog: 'Backlog',
  todo: 'A Fazer',
  in_progress: 'Em Progresso',
  review: 'Revisão',
  done: 'Concluído',
};

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; ring: string }> = {
  critical: { label: 'Crítica', color: '#ef4444', ring: 'rgba(239,68,68,.15)' },
  high: { label: 'Alta', color: '#f97316', ring: 'rgba(249,115,22,.15)' },
  medium: { label: 'Média', color: '#f59e0b', ring: 'rgba(245,158,11,.15)' },
  low: { label: 'Baixa', color: '#94a3b8', ring: 'rgba(148,163,184,.15)' },
};

export const WA_STATUS_CONFIG: Record<WaStatus, { label: string; tone: BadgeTone }> = {
  scheduled: { label: 'Agendada', tone: 'neutral' },
  sending: { label: 'Enviando', tone: 'info' },
  sent: { label: 'Enviada', tone: 'info' },
  delivered: { label: 'Entregue', tone: 'success' },
  read: { label: 'Lida', tone: 'info' },
  failed: { label: 'Falhou', tone: 'danger' },
};

export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; tone: BadgeTone; bar: string }> = {
  on_track: { label: 'No prazo', tone: 'success', bar: 'linear-gradient(to right,#3b82f6,#8b5cf6)' },
  at_risk: { label: 'Em risco', tone: 'warning', bar: 'linear-gradient(to right,#f59e0b,#f97316)' },
  late: { label: 'Atrasado', tone: 'danger', bar: 'linear-gradient(to right,#ef4444,#e11d48)' },
  // Não está no protótipo: projeto em andamento sem nenhum prazo (RN05).
  no_deadline: { label: 'Sem prazo', tone: 'neutral', bar: 'linear-gradient(to right,#94a3b8,#64748b)' },
};

export const EVA_SUGGESTIONS = ['O que está atrasado?', 'Resumo da última reunião', 'Quem está sobrecarregado?'];

/** Gradiente cônico da borda "Siri" (cores do EVENT_COLORS do Hub) */
export const EVA_CONIC = 'conic-gradient(from 0deg, #3b82f6, #6366f1, #8b5cf6, #ec4899, #06b6d4, #3b82f6)';
