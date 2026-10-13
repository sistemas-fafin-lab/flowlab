// Módulo EVA — agente de IA do módulo de TI
export { default as EvaHomePage } from './components/EvaHomePage';
export { EvaOrb } from './components/EvaOrb';
export { GlowFrame } from './components/EvaGlow';
export { evaService } from './services/evaService';
export type {
  EvaView, EvaHomeSnapshot, EvaInsightData, InsightSlot, KanbanColumnSummary, OverdueTask,
  WaMessage, ProjectSummary, DailyTask, ChatMessage, TeamMember,
} from './types';
