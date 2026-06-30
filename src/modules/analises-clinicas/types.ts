// Módulo Análises Clínicas — tipos de domínio (escopo: agendamento)
// Espelham as colunas das tabelas ac_* (migrations 20260629120000 e 20260630130000).

// Status do agendamento no FlowLab. Hoje o receive-agendamento grava sempre
// 'recebido'; os demais estados entram quando o fluxo de coleta for implementado.
export type AcAgendamentoStatus =
  | 'recebido'
  | 'em_coleta'
  | 'coletado'
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
