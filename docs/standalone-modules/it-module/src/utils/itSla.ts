// ─── SLA de resolução das solicitações de TI, calculado a partir da prioridade ─

export type ITPriority = 'low' | 'medium' | 'high' | 'critical';
export type ITStatusLike = 'pending' | 'in_progress' | 'resolved' | 'cancelled';
export type ITKanbanColumnLike = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';

export const SLA_HOURS_BY_PRIORITY: Record<ITPriority, number> = {
  low: 336,     // 2 semanas
  medium: 168,  // 1 semana
  high: 72,
  critical: 48,
};

export function getSlaDeadline(createdAt: string, priority: ITPriority): Date {
  const hours = SLA_HOURS_BY_PRIORITY[priority] ?? SLA_HOURS_BY_PRIORITY.medium;
  return new Date(new Date(createdAt).getTime() + hours * 60 * 60 * 1000);
}

export type SlaUrgency = 'ok' | 'warning' | 'overdue' | 'concluded';

export interface SlaStatus {
  urgency: SlaUrgency;
  isOverdue: boolean;
  label: string;
  deadline: Date;
  badgeClass: string;
  textClass: string;
  dotClass: string;
}

const URGENCY_STYLES: Record<SlaUrgency, { badge: string; text: string; dot: string }> = {
  ok: {
    badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  warning: {
    badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    text: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  overdue: {
    badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    text: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
  },
  concluded: {
    badge: 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400',
    text: 'text-slate-500 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
};

// Fração da janela de SLA restante abaixo da qual o badge vira "atenção" (âmbar).
const WARNING_THRESHOLD = 0.25;

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export function getSlaStatus(
  createdAt: string,
  priority: ITPriority,
  opts?: { status?: ITStatusLike | null; kanbanStatus?: ITKanbanColumnLike | null; now?: Date }
): SlaStatus {
  const created = new Date(createdAt);
  const deadline = getSlaDeadline(createdAt, priority);
  const isConcluded =
    opts?.status === 'resolved' || opts?.status === 'cancelled' || opts?.kanbanStatus === 'done';

  if (isConcluded) {
    return {
      urgency: 'concluded',
      isOverdue: false,
      label: 'Concluído',
      deadline,
      ...toClasses('concluded'),
    };
  }

  const now = opts?.now ?? new Date();
  const remainingMs = deadline.getTime() - now.getTime();
  const totalMs = deadline.getTime() - created.getTime();

  if (remainingMs <= 0) {
    return {
      urgency: 'overdue',
      isOverdue: true,
      label: `Vencido há ${formatDuration(-remainingMs)}`,
      deadline,
      ...toClasses('overdue'),
    };
  }

  const remainingFraction = totalMs > 0 ? remainingMs / totalMs : 0;
  const urgency: SlaUrgency = remainingFraction < WARNING_THRESHOLD ? 'warning' : 'ok';

  return {
    urgency,
    isOverdue: false,
    label: `Vence em ${formatDuration(remainingMs)}`,
    deadline,
    ...toClasses(urgency),
  };
}

function toClasses(urgency: SlaUrgency): { badgeClass: string; textClass: string; dotClass: string } {
  const style = URGENCY_STYLES[urgency];
  return { badgeClass: style.badge, textClass: style.text, dotClass: style.dot };
}
