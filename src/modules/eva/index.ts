// Módulo EVA — agente de IA do módulo de TI (plano: docs/plans/agente-ti/PLANO_AGENTE_TI.md)
export { default as EvaHomePage } from './components/EvaHomePage';
export { EvaSugestoesPage, EvaReunioesPage, EvaMembrosPage, EvaPermissoesPage, EvaConfiguracoesPage } from './components/admin/paginas';
export { EvaOrb } from './components/EvaOrb';
export { GlowFrame } from './components/EvaGlow';
export { evaService } from './services/evaService';
export type {
  EvaView, EvaHomeSnapshot, EvaInsightData, InsightSlot, KanbanColumnSummary, OverdueTask,
  WaMessage, ProjectSummary, DailyTask, ChatMessage, TeamMember,
} from './types';
