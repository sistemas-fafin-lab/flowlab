// Módulo EVA — agente de IA do módulo de TI (homepage /it/inicio).
// Tipos de interface do handoff (docs/flowlab_agent), ajustados aos dados reais:
// os cards levam id e código, e o responsável pode faltar.
import type { BlocoChat, PassoChat } from './domain/blocos';
import type { ColunaKanban, Prioridade } from './domain/demandas';
import type { SituacaoProjeto } from './domain/projetos';
import type { CardResumo, PropostaCard, TipoSugestao } from './services/agenteAdmin';

export type EvaView = 'team' | 'me';
export type OverdueFilter = 'all' | 'critical';

export type KanbanColumnKey = ColunaKanban;
export type Priority = Prioridade;
export type WaStatus = 'scheduled' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
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

/** Mudança num card que um comentário propõe (D28): só executa depois de confirmada. */
export interface PropostaDeComentario {
  tipo: TipoSugestao;
  card_id: string;
  card: CardResumo;
  proposta: PropostaCard;
  trecho: string;
}

/** O que o botão principal do comentário faz (D21). Nenhuma escreve direto no board. */
export type AcaoInsight =
  | { tipo: 'navegar'; para: string }
  | { tipo: 'abrir_card'; cardId: string }
  | { tipo: 'chat'; pergunta: string }
  /** Cobrança manual (D22), pela mesma rota do botão Cobrar: respeita a janela de 4 h. */
  | { tipo: 'cobrar'; cardId: string }
  | {
      tipo: 'propor';
      /** Pergunta do diálogo de confirmação ("Passar IT-045 e IT-052 da Ana para o Diego?"). */
      titulo: string;
      propostas: PropostaDeComentario[];
      /** Texto depois que o gestor aprovou e a EVA executou. */
      feitoGestor: string;
      /** Texto depois que a proposta foi para a fila. */
      feitoFila: string;
    };

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
  acao: AcaoInsight;
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

/**
 * Ação que a EVA propôs no chat (D28, RN17). Nada muda no board até a confirmação:
 * gestor confirma e ela executa; os demais mandam para a fila de aprovação.
 */
export interface PropostaEva {
  id: string;
  tipo: TipoSugestao;
  card_id: string | null;
  proposta: PropostaCard;
  trecho: string;
  confianca: 'alta' | 'media' | 'baixa';
  avisos: string[];
  card: CardResumo | null;
  estado: 'aberta' | 'enviando' | 'executada' | 'na_fila' | 'descartada';
  erro?: string;
}

/** Aviso pelo WhatsApp para uma pessoa, preparado pela EVA no chat (D32): só sai quando o gestor confirma. */
export interface AvisoEva {
  id: string;
  pessoaId: string;
  nome: string;
  texto: string;
  estado: 'aberto' | 'enviando' | 'enviado' | 'descartado';
  /** Fora do horário da EVA, quando ele sai (ISO). */
  agendadaPara?: string | null;
  erro?: string;
}

export interface ChatMessage {
  id: string;
  from: 'eva' | 'me';
  text: string;
  /** Códigos dos cards que a EVA citou (só os que existem no board). */
  cardsCitados?: string[];
  propostas?: PropostaEva[];
  avisos?: AvisoEva[];
  /** Blocos visuais e próximos passos (D34): a IA escolheu, o Início monta com os dados do board. */
  blocos?: BlocoChat[];
  proximosPassos?: PassoChat[];
  /** Resposta que acabou de chegar: aparece aos poucos, uma vez só. */
  nova?: boolean;
  /** Resposta de erro (limite do dia, IA fora): mostrada sem cartões. */
  falhou?: boolean;
}

/** `attention`: algo espera alguém (ex.: sugestões aguardando aprovação). */
export type IntegrationState = 'online' | 'offline' | 'pending' | 'attention';

export interface IntegrationStatus {
  id: 'granola' | 'waha' | 'sugestoes';
  name: string;
  detail: string;
  state: IntegrationState;
  /** Quando presente, o chip vira um link (ex.: sugestões pendentes → /it/eva). */
  href?: string;
}
