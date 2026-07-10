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
  validade_ok: boolean | null; // validade da amostra conferida no check-in (Fase 7A)
  etiquetado: boolean | null;  // etiqueta colocada no check-in (Fase 7A)
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

// ─── Fase 7 (Etapa A) — Catálogo de exames + Culturas ───────────────────────────

// Exame do catálogo (espelha ac_exames). Importado da planilha de valores;
// `is_cultura` marca os microbiológicos que geram acompanhamento em ac_culturas.
export interface AcExame {
  id: string;
  nome: string;
  mnemonico: string | null;
  codigo_tuss: string | null;
  material: string | null; // tipo de amostra: S (soro), U (urina), F (fezes)…
  is_cultura: boolean;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

// Exame marcado num agendamento no check-in (espelha ac_agendamento_exames).
export interface AcAgendamentoExame {
  id: string;
  agendamento_id: string;
  exame_id: string;
  exame_nome: string; // snapshot
  is_cultura: boolean;
  created_at: string;
}

// Etapa da trilha de cultura (espelha ac_cultura_etapas). Ordenada e extensível —
// o stepper da página desenha a partir dela; adicionar etapa = inserir uma linha.
export interface AcCulturaEtapa {
  id: string;
  ordem: number;
  nome: string;
  ativo: boolean;
}

// Status/desfecho de uma cultura. Lista fixa (badge); tolera novos valores.
// `sem_crescimento` foi removido do fluxo; o `string & {}` ainda tolera linhas legadas.
export type CulturaStatus =
  | 'em_andamento'
  | 'positiva'
  | 'pronta_laudo'
  | (string & {});

// Lista FIXA dos status (fonte do badge e do select da página).
export const STATUS_CULTURA: { key: CulturaStatus; label: string }[] = [
  { key: 'em_andamento', label: 'Em andamento' },
  { key: 'positiva',     label: 'Positiva' },
  { key: 'pronta_laudo', label: 'Laudo concluído' },
];

// Cultura acompanhada manualmente (espelha ac_culturas).
export interface AcCultura {
  id: string;
  agendamento_id: string;
  exame_id: string | null;
  exame_nome: string;         // tipo do exame (snapshot)
  paciente_nome: string | null;
  posto_id: string | null;
  local_posto: string | null;
  etapa_ordem: number;        // etapa atual (→ AcCulturaEtapa.ordem)
  status: CulturaStatus;
  nota: string | null;
  resultado: string | null;   // desfecho/laudo textual (opcional)
  iniciada_em: string;        // ISO 8601
  prazo_dias: number;
  created_at: string;
  updated_at: string;
}

// ─── Fase 7 (Etapa C) — Temperatura e Equipamentos ──────────────────────────────

// Tipos de equipamento monitorado (espelham o CHECK de ac_equipamentos.tipo).
export type EquipamentoTipo =
  | 'geladeira'
  | 'freezer'
  | 'estufa'
  | 'incubadora'
  | 'banho_maria'
  | 'ambiente'
  | 'outro';

// Lista FIXA dos tipos (fonte do select da tela e das chaves válidas de tipo).
export const TIPOS_EQUIPAMENTO: { key: EquipamentoTipo; label: string }[] = [
  { key: 'geladeira',   label: 'Geladeira' },
  { key: 'freezer',     label: 'Freezer' },
  { key: 'estufa',      label: 'Estufa' },
  { key: 'incubadora',  label: 'Incubadora' },
  { key: 'banho_maria', label: 'Banho-maria' },
  { key: 'ambiente',    label: 'Ambiente' },
  { key: 'outro',       label: 'Outro' },
];

// Equipamento monitorado + faixa aceitável — espelha ac_equipamentos.
export interface AcEquipamento {
  id: string;
  nome: string;
  tipo: EquipamentoTipo;
  localizacao: string | null;
  temp_min: number;
  temp_max: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// Leitura de temperatura (log append-only) — espelha ac_temperaturas.
// `fora_faixa` é derivado no banco (trigger) contra a faixa do equipamento.
export interface AcTemperatura {
  id: string;
  equipamento_id: string;
  temperatura: number;
  fora_faixa: boolean;
  registrado_por: string;
  observacao: string | null;
  registrado_em: string; // ISO 8601
  created_at: string;
}
