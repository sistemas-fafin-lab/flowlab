// ─── SLA de primeiro atendimento das solicitações de TI ───────────────────────
// O relógio corre da abertura do chamado até a TI *começar* a tratar dele — não
// até resolver. Conta como começado o que vier primeiro: o chamado virar card no
// kanban (kanban_hidden = false) ou o status sair de 'Pendente'.

export type ITPriority = 'low' | 'medium' | 'high' | 'critical';
export type ITStatusLike = 'pending' | 'in_progress' | 'resolved' | 'cancelled';
export type ITKanbanColumnLike = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';

export const SLA_HOURS_BY_PRIORITY: Record<ITPriority, number> = {
  low: 336,     // 2 semanas
  medium: 168,  // 1 semana
  high: 72,
  critical: 48,
};

// Instante-limite para a TI começar a atender o chamado.
export function getSlaStartDeadline(createdAt: string, priority: ITPriority): Date {
  const hours = SLA_HOURS_BY_PRIORITY[priority] ?? SLA_HOURS_BY_PRIORITY.medium;
  return new Date(new Date(createdAt).getTime() + hours * 60 * 60 * 1000);
}

export type SlaUrgency = 'ok' | 'warning' | 'overdue' | 'started' | 'concluded';

export interface SlaStatus {
  urgency: SlaUrgency;
  isOverdue: boolean;
  /** false depois que o atendimento começou: o contador parou e o badge some. */
  isRunning: boolean;
  label: string;
  deadline: Date;
  badgeClass: string;
  textClass: string;
  dotClass: string;
}

export interface SlaContext {
  status?: ITStatusLike | null;
  kanbanStatus?: ITKanbanColumnLike | null;
  /** false = já promovido ao kanban, ou seja, a TI pegou o chamado. */
  kanbanHidden?: boolean | null;
  now?: Date;
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
  started: {
    badge: 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400',
    text: 'text-slate-500 dark:text-slate-400',
    dot: 'bg-slate-400',
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

function isConcluded(ctx?: SlaContext): boolean {
  return ctx?.status === 'resolved' || ctx?.status === 'cancelled' || ctx?.kanbanStatus === 'done';
}

// A TI já colocou a mão no chamado? Qualquer um dos sinais basta — o kanban e o
// status são atualizados por caminhos diferentes na tela de solicitações.
function hasStarted(ctx?: SlaContext): boolean {
  if (ctx?.status && ctx.status !== 'pending') return true;
  if (ctx?.kanbanHidden === false) return true;
  if (ctx?.kanbanStatus && ctx.kanbanStatus !== 'backlog') return true;
  return false;
}

export function getSlaStatus(
  createdAt: string,
  priority: ITPriority,
  opts?: SlaContext
): SlaStatus {
  const created = new Date(createdAt);
  const deadline = getSlaStartDeadline(createdAt, priority);

  // Sem registro de quando o atendimento começou, o contador apenas para: não dá
  // para dizer em retrospecto se o início respeitou o prazo.
  if (isConcluded(opts) || hasStarted(opts)) {
    const urgency: SlaUrgency = isConcluded(opts) ? 'concluded' : 'started';
    return {
      urgency,
      isOverdue: false,
      isRunning: false,
      label: urgency === 'concluded' ? 'Concluído' : 'Em atendimento',
      deadline,
      ...toClasses(urgency),
    };
  }

  const now = opts?.now ?? new Date();
  const remainingMs = deadline.getTime() - now.getTime();
  const totalMs = deadline.getTime() - created.getTime();

  if (remainingMs <= 0) {
    return {
      urgency: 'overdue',
      isOverdue: true,
      isRunning: true,
      label: `Início atrasado há ${formatDuration(-remainingMs)}`,
      deadline,
      ...toClasses('overdue'),
    };
  }

  const remainingFraction = totalMs > 0 ? remainingMs / totalMs : 0;
  const urgency: SlaUrgency = remainingFraction < WARNING_THRESHOLD ? 'warning' : 'ok';

  return {
    urgency,
    isOverdue: false,
    isRunning: true,
    label: `Iniciar em ${formatDuration(remainingMs)}`,
    deadline,
    ...toClasses(urgency),
  };
}

function toClasses(urgency: SlaUrgency): { badgeClass: string; textClass: string; dotClass: string } {
  const style = URGENCY_STYLES[urgency];
  return { badgeClass: style.badge, textClass: style.text, dotClass: style.dot };
}
