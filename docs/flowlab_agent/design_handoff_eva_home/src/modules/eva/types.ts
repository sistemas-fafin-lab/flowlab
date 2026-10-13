// Módulo EVA — agente de IA do módulo de TI (homepage /it/inicio)

export type EvaView = 'team' | 'me';
export type OverdueFilter = 'all' | 'critical';

export type KanbanColumnKey = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type WaStatus = 'scheduled' | 'sending' | 'delivered' | 'read' | 'failed';
export type ProjectStatus = 'on_track' | 'at_risk' | 'late';
export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  /** CSS gradient do avatar (ex.: linear-gradient(135deg,#3b82f6,#6366f1)) */
  gradient: string;
}

export interface KanbanColumnSummary {
  key: KanbanColumnKey;
  count: number;
  /** Até 2 cards de destaque por coluna */
  items: { title: string; memberId: string }[];
}

export interface OverdueTask {
  id: string;
  title: string;
  project: string;
  memberId: string;
  daysLate: number;
  priority: Priority;
  /** Texto do último contato da EVA (ex.: "Cobrada às 10:12 · sem resposta") */
  lastChargeText: string;
  isMine: boolean;
}

export interface WaMessage {
  id: string;
  time: string; // HH:mm
  to: string;
  text: string;
  status: WaStatus;
  note?: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  sprint: string;
  done: number;
  total: number;
  due: string; // dd/MM
  status: ProjectStatus;
  isMine: boolean;
}

export interface DailyTask {
  id: string;
  time: string;
  title: string;
  project: string;
  late?: boolean;
  done: boolean;
}

export type InsightSlot = 'kanban' | 'overdue' | 'whatsapp' | 'projects' | 'myTasks';

export interface EvaInsightData {
  id: string;
  /** Origem do insight, ex.: "Granola · Sprint review 10/10" */
  source: string;
  text: string;
  ctaLabel: string;
  /** Texto exibido após o usuário aceitar a ação */
  doneText: string;
  /** Pergunta enviada ao chat ao clicar em "Perguntar à EVA" */
  askPrompt: string;
}

export interface EvaHomeSnapshot {
  briefing: string;
  columns: KanbanColumnSummary[];
  overdue: OverdueTask[];
  waQueue: WaMessage[];
  projects: ProjectSummary[];
  insights: Record<InsightSlot, EvaInsightData>;
  stats: {
    overdueHint: string;
    doneThisWeek: number;
    chargesToday: number;
    myOpen: number;
    myProjects: number;
    myProjectsHint: string;
  };
}

export type StatKey = 'open' | 'overdue' | 'done' | 'charges' | 'today' | 'projects';

export interface StatCardData {
  key: StatKey;
  label: string;
  value: string | number;
  hint: string;
}

export interface ChatMessage {
  id: string;
  from: 'eva' | 'me';
  text: string;
}

export interface IntegrationStatus {
  id: 'granola' | 'waha';
  name: string;
  detail: string;
  online: boolean;
}
