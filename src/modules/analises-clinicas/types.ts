// Módulo Análises Clínicas — tipos de domínio (escopo: agendamento)
// Espelham as colunas das tabelas ac_* (migrations 20260629120000 e 20260630130000).

// Status do agendamento no FlowLab. Hoje o receive-agendamento grava sempre
// 'recebido'; os demais estados entram quando o fluxo de coleta for implementado.
export type AcAgendamentoStatus =
  | 'recebido'
  | 'em_coleta'
  | 'coletado'
  | 'bloqueado' // conferência de recepção falhou (Fase 6) — sai da fila normal
  | 'cancelado'
  | (string & {}); // tolera estados futuros sem quebrar a tipagem

export interface AcAgendamento {
  id: string;
  labhub_id: string;
  paciente_nome: string;
  paciente_telefone: string | null;
  posto_id: string | null;
  local_posto: string; // snapshot do nome do posto
  data_hora: string; // ISO 8601
  status: AcAgendamentoStatus;
  recebido_em: string;
  updated_at: string;
}

export interface AcPosto {
  id: string;
  nome: string;
  endereco: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

// Um horário (HH:MM) com a capacidade de atendimento simultâneo (default 1).
export interface AcHorarioItem {
  hora: string; // 'HH:MM'
  capacidade: number;
}

// Horário fixo recorrente do posto (vale seg–sáb).
export interface AcHorarioPadrao {
  id: string;
  posto_id: string;
  hora: string; // 'HH:MM'
  capacidade: number;
}

// Sobreposição de um dia específico: fecha o dia ou troca a lista de horários.
export interface AcDiaExcecao {
  id: string;
  posto_id: string;
  data: string; // 'YYYY-MM-DD'
  fechado: boolean;
  horarios: AcHorarioItem[]; // usado quando fechado = false
}

// ─── Fase 6 — Coleta ────────────────────────────────────────────────────────────

// Chaves dos itens do checklist de recepção (espelham o CHECK de ac_checkins.problema_em).
export type ChecklistItemKey = 'identidade' | 'guia' | 'pedido_medico' | 'jejum' | 'termo';

// Resultado de uma conferência: liberou a coleta ou registrou um problema.
export type CheckinResultado = 'liberado' | 'problema';

// Lista FIXA do checklist de recepção (§2.2). É a fonte dos itens da tela e das
// chaves válidas de problema_em. Trocar a lista = ajuste aqui + no CHECK da tabela.
export const CHECKLIST_RECEPCAO: { key: ChecklistItemKey; label: string; descricao: string }[] = [
  { key: 'identidade',    label: 'Identidade do paciente', descricao: 'Documento com foto confere com o cadastro.' },
  { key: 'guia',          label: 'Guia do convênio',       descricao: 'Guia apresentada e autorização válida.' },
  { key: 'pedido_medico', label: 'Pedido médico',          descricao: 'Pedido apresentado, assinatura e CRM legíveis.' },
  { key: 'jejum',         label: 'Preparo / jejum',        descricao: 'Preparo/jejum confirmado com o paciente.' },
  { key: 'termo',         label: 'Termo de coleta',        descricao: 'Termo de consentimento assinado.' },
];

// Conferência de recepção (1:1 agendamento) — espelha ac_checkins.
export interface AcCheckin {
  id: string;
  agendamento_id: string;
  conferido_por: string;
  conferido_em: string; // ISO 8601
  resultado: CheckinResultado;
  problema_em: ChecklistItemKey | null;
  problema_motivo: string | null;
  created_at: string;
  updated_at: string;
}

// Coleta (1:1 agendamento) — espelha ac_coletas.
export interface AcColeta {
  id: string;
  agendamento_id: string;
  posto_id: string | null;
  location_id: string | null; // estoque do posto de onde saiu a baixa
  coletado_por: string;
  coletado_em: string; // ISO 8601
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

// Insumo consumido numa coleta (linha por produto) — espelha ac_coleta_insumos.
export interface AcColetaInsumo {
  id: string;
  coleta_id: string;
  product_id: string;
  quantity: number;
  stock_movement_id: string | null; // a baixa gerada (rastreio/estorno futuro)
  created_at: string;
}

// Input de um insumo no form de coleta (produto + quantidade).
export interface InsumoInput {
  productId: string;
  quantity: number;
}
