// Módulo EVA — agente de IA do módulo de TI (homepage /it/inicio).
// Tipos de interface do handoff (docs/flowlab_agent), ajustados aos dados reais:
// os cards levam id e código, e o responsável pode faltar.
import type { ColunaKanban, Prioridade } from './domain/demandas';
import type { SituacaoProjeto } from './domain/projetos';

export type EvaView = 'team' | 'me';
export type OverdueFilter = 'all' | 'critical';

export type KanbanColumnKey = ColunaKanban;
export type Priority = Prioridade;
export type WaStatus = 'scheduled' | 'sending' | 'delivered' | 'read' | 'failed';
export type ProjectStatus = SituacaoProjeto;
export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  /** CSS gradient do avatar (ex.: linear-gradient(135deg,#3b82f6,#6366f1)) */
  gradient: string;
}

export interface KanbanCardRef {
  id: string;
  codigo: string;
  title: string;
  /** Primeiro responsável; null quando o card não tem ninguém. */
  memberId: string | null;
}

export interface KanbanColumnSummary {
  key: KanbanColumnKey;
  count: number;
  /** Até 2 cards de destaque por coluna */
  items: KanbanCardRef[];
}

export interface OverdueTask {
  id: string;
  codigo: string;
  title: string;
  project: string;
  memberId: string | null;
  daysLate: number;
  priority: Priority;
  /** Último contato da EVA ("Cobrada às 10:12 · sem resposta"); vazio antes da Fase 3. */
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
  due: string; // dd/MM ou "—"
  status: ProjectStatus;
  isMine: boolean;
}

export interface DailyTask {
  id: string;
  codigo: string;
  title: string;
  project: string;
  late: boolean;
  done: boolean;
}

export type InsightSlot = 'kanban' | 'overdue' | 'whatsapp' | 'projects' | 'myTasks';

export interface EvaInsightData {
  id: string;
  /** Origem do insight, ex.: "Granola · Sprint review 10/10" */
  source: string;
  text: string;
  ctaLabel: string;
  /** Texto exibido depois que a ação terminou de fato */
  doneText: string;
  /** Pergunta enviada ao chat ao clicar em "Perguntar à EVA" */
  askPrompt: string;
}

export type StatKey = 'open' | 'overdue' | 'done' | 'charges' | 'today' | 'projects';

export interface StatCardData {
  key: StatKey;
  label: string;
  value: string | number;
  hint: string;
}

export interface EvaHomeSnapshot {
  briefing: string;
  stats: StatCardData[];
  columns: KanbanColumnSummary[];
  totalCards: number;
  overdue: OverdueTask[];
  projects: ProjectSummary[];
  myTasks: DailyTask[];
  members: Record<string, TeamMember>;
}

export interface ChatMessage {
  id: string;
  from: 'eva' | 'me';
  text: string;
}

export type IntegrationState = 'online' | 'offline' | 'pending';

export interface IntegrationStatus {
  id: 'granola' | 'waha' | 'sugestoes';
  name: string;
  detail: string;
  state: IntegrationState;
  /** Quando presente, o chip vira um link (ex.: sugestões pendentes → /it/eva). */
  href?: string;
}
