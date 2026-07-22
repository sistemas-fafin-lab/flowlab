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
  labhub_id: string | null; // NULL = agendamento nativo do FlowLab (criado à mão, sem LAB-HUB)
  paciente_nome: string;
  paciente_telefone: string | null;
  posto_id: string | null;
  local_posto: string; // snapshot do nome do posto
  data_hora: string; // ISO 8601
  status: AcAgendamentoStatus;
  recebido_em: string;
  updated_at: string;
  // Auditoria do cancelamento pelo operador (migration 20260722120000). Todos
  // NULL quando o cancelamento veio do LAB-HUB (receive-cancelamento não preenche).
  cancelado_em?: string | null; // ISO 8601
  cancelado_por?: string | null;
  cancelamento_motivo?: string | null;
}

export interface AcPosto {
  id: string;
  nome: string;
  endereco: string;
  ativo: boolean;
  // Grade de agenda (1:1): a janela início→fim com passo `intervalo` gera os
  // horários; `dias_semana` (0=dom … 6=sáb) define em quais dias o posto opera.
  // Campos de hora nulos = agenda ainda não configurada. Cada horário atende 1.
  agenda_hora_inicio: string | null;   // 'HH:MM'
  agenda_hora_fim: string | null;      // 'HH:MM'
  agenda_intervalo_min: number | null; // minutos entre atendimentos
  agenda_dias_semana: number[];        // subconjunto de 0..6
  created_at?: string;
  updated_at?: string;
}

// Data bloqueada de um posto (feriado): nenhum agendamento naquela data.
export interface AcDiaExcecao {
  id: string;
  posto_id: string;
  data: string; // 'YYYY-MM-DD'
}

// ─── Fase 6 — Coleta ────────────────────────────────────────────────────────────

// Chaves dos itens do checklist de recepção (espelham o CHECK de ac_checkins.problema_em).
export type ChecklistItemKey = 'identidade' | 'guia' | 'pedido_medico' | 'jejum' | 'termo';

// Resultado de uma conferência: liberou a coleta ou registrou um problema.
export type CheckinResultado = 'liberado' | 'problema';

// Tipo de documento que o paciente envia pelo app do LAB-HUB.
// Espelha TipoDocumento de @lab-hub/shared (packages/shared/src/index.ts:79).
export type TipoDocumento = 'identidade' | 'carteirinha' | 'pedido_medico' | 'outro';

// Documento exibido na conferência de recepção.
// Espelha DocumentoFlowLab de @lab-hub/shared (packages/shared/src/index.ts:184).
// `url` é signed URL FRESCA gerada pelo LAB-HUB a cada busca: os bytes ficam só lá
// (LGPD) e o link vence em ~15min — daí `expiraEm`, e daí não cachearmos nada.
export interface DocumentoCheckin {
  id: string;
  tipo: TipoDocumento;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
  criadoEm: string; // ISO 8601
  url: string;
  expiraEm: string; // ISO 8601
}

// Decide pelo mimeType, não pela extensão do nome: o nome vem do paciente, enquanto
// o mimeType foi conferido por magic bytes no upload ao LAB-HUB.
export const isImagem = (mimeType: string): boolean => mimeType.startsWith('image/');

// Lista FIXA do checklist de recepção (§2.2). É a fonte dos itens da tela e das
// chaves válidas de problema_em. Trocar a lista = ajuste aqui + no CHECK da tabela.
//
// `tipoDocumento` liga o item ao documento que o paciente enviou pelo LAB-HUB, p/ o
// operador conferir o arquivo no mesmo item que está marcando. Itens sem documento
// (jejum, termo) são confirmados de viva voz e ficam sem o campo. É opcional de
// propósito: a lista e as chaves seguem intactas, então todosOk, o ProgressRing e o
// CHECK de ac_checkins.problema_em não mudam.
export const CHECKLIST_RECEPCAO: {
  key: ChecklistItemKey;
  label: string;
  descricao: string;
  tipoDocumento?: TipoDocumento;
}[] = [
  { key: 'identidade',    label: 'Identidade do paciente', descricao: 'Documento com foto confere com o cadastro.',    tipoDocumento: 'identidade' },
  { key: 'guia',          label: 'Guia do convênio',       descricao: 'Guia apresentada e autorização válida.',        tipoDocumento: 'carteirinha' },
  { key: 'pedido_medico', label: 'Pedido médico',          descricao: 'Pedido apresentado, assinatura e CRM legíveis.', tipoDocumento: 'pedido_medico' },
  { key: 'jejum',         label: 'Preparo / jejum',        descricao: 'Preparo/jejum confirmado com o paciente.' },
  { key: 'termo',         label: 'Termo de coleta',        descricao: 'Termo de consentimento assinado.' },
];

// Tipos já cobertos por algum item do checklist. Derivado da lista acima em vez de
// escrito à mão: um `tipo` novo no LAB-HUB cai automaticamente em "outros documentos"
// na tela, em vez de sumir calado quando o espelho de tipos ficar desatualizado.
export const TIPOS_NO_CHECKLIST = new Set(
  CHECKLIST_RECEPCAO.map((i) => i.tipoDocumento).filter(Boolean),
);

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
  { key: 'positiva',     label: 'Positivada' },
  { key: 'pronta_laudo', label: 'Concluída' },
];

// Cultura acompanhada manualmente (espelha ac_culturas).
export interface AcCultura {
  id: string;
  agendamento_id: string | null; // NULL = cultura avulsa (sem vínculo com coleta/agendamento)
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

// ─── Fase 6 (Etapa B) — Recoletas ───────────────────────────────────────────────

// Status de uma recoleta. Lista fixa (badge/select); tolera valores futuros.
export type RecoletaStatus =
  | 'pendente'
  | 'concluida'
  | 'cancelada'
  | (string & {});

// Lista FIXA dos status (fonte do badge e do select da página).
export const STATUS_RECOLETA: { key: RecoletaStatus; label: string }[] = [
  { key: 'pendente',  label: 'Pendente' },
  { key: 'concluida', label: 'Concluída' },
  { key: 'cancelada', label: 'Cancelada' },
];

// Motivo da recoleta (espelha o CHECK de ac_recoletas.motivo).
export type RecoletaMotivo =
  | 'hemolise'
  | 'estabilidade'
  | 'recipiente_inadequado'
  | 'amostra_insuficiente'
  | 'confirmacao_resultados'
  | 'amostra_extraviada';

// Lista FIXA dos motivos (fonte do select da tela e das chaves válidas de motivo).
export const MOTIVOS_RECOLETA: { key: RecoletaMotivo; label: string }[] = [
  { key: 'hemolise',             label: 'Hemólise' },
  { key: 'estabilidade',         label: 'Estabilidade' },
  { key: 'recipiente_inadequado', label: 'Recipiente Inadequado' },
  { key: 'amostra_insuficiente',  label: 'Amostra Insuficiente' },
  { key: 'confirmacao_resultados',  label: 'Nova amostra para confirmação de resultados' },
  { key: 'amostra_extraviada',    label: 'Amostra Extraviada' },
];

// Recoleta acompanhada manualmente (espelha ac_recoletas).
export interface AcRecoleta {
  id: string;
  agendamento_id: string | null;      // NULL = recoleta avulsa (registrada à mão)
  coleta_id: string | null;           // coleta cuja amostra ficou inviável (se conhecida)
  origem_recoleta_id: string | null;  // recoleta anterior (a "recoleta da recoleta")
  exame_nome: string | null;     // exame/material a recoletar (snapshot)
  paciente_nome: string | null;
  posto_id: string | null;
  local_posto: string | null;
  motivo: RecoletaMotivo;
  motivo_detalhe: string | null; // texto livre (obrigatório quando motivo='outro')
  status: RecoletaStatus;
  nota: string | null;
  prazo_dias: number;
  solicitado_por: string;
  solicitada_em: string;         // ISO 8601
  resolvida_em: string | null;   // carimbo ao concluir/cancelar
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

// ─── Fase 8 — Laudos ────────────────────────────────────────────────────────────

// Status de um laudo. Lista fixa (badge/select); tolera valores futuros.
export type LaudoStatus =
  | 'aguarda_liberacao'
  | 'laudo_parcial_liberado'
  | 'laudo_completo_liberado'
  | (string & {});

// Lista FIXA dos status (fonte do badge e do select da página).
export const STATUS_LAUDO: { key: LaudoStatus; label: string }[] = [
  { key: 'aguarda_liberacao',      label: 'Aguarda liberação' },
  { key: 'laudo_parcial_liberado', label: 'Laudo parcial liberado' },
  { key: 'laudo_completo_liberado',label: 'Laudo completo liberado' },
];

// Laudo vinculado a um agendamento (1:1) — espelha ac_laudos.
export interface AcLaudo {
  id: string;
  agendamento_id: string;
  status: LaudoStatus;
  exames_concluidos: number;
  exames_total: number;
  nota: string | null;
  criado_por: string;
  criado_em: string;      // ISO 8601
  atualizado_em: string;  // ISO 8601
  liberado_em: string | null; // ISO 8601 (carimbo ao liberar)
}
