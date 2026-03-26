// ============================================================================
// BILLING MODULE - Types & Interfaces
// Sistema de Gestão de Faturamento e Recebíveis (Espelho APLIS)
// ============================================================================

// ============================================================================
// ENUMS / TIPOS LITERAIS
// ============================================================================

export type OperadoraStatus = 'ativa' | 'inativa';

export type LoteStatus = 'aberto' | 'enviado' | 'processado' | 'fechado';

export type RequisicaoStatus = 'pendente' | 'em_lote' | 'faturada' | 'paga' | 'glosada';

export type NotaStatus = 'aberta' | 'parcialmente_recebida' | 'recebida' | 'glosada' | 'cancelada';

export type RecebimentoStatus = 'previsto' | 'recebido' | 'parcial' | 'cancelado';

export type GlosaStatus = 'aberta' | 'em_recurso' | 'revertida' | 'definitiva';

export type SyncType = 'operadoras' | 'notas' | 'lotes' | 'requisicoes' | 'full';

export type SyncStatus = 'running' | 'success' | 'error' | 'partial';

// ============================================================================
// INTERFACES PRINCIPAIS
// ============================================================================

/**
 * Operadora de plano de saúde / Convênio
 * Sincronizado do sistema APLIS
 */
export interface Operadora {
  id_operadora: string;
  nome: string;
  cnpj?: string;
  prazo_pagamento_dias: number;
  contato_email?: string;
  contato_telefone?: string;
  aplis_id?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Lote de faturamento - agrupa requisições para envio à operadora
 * Sincronizado do sistema APLIS
 */
export interface Lote {
  id_lote: string;
  operadora_id: string;
  codigo_lote: string;
  data_criacao: string;
  data_envio?: string;
  status: LoteStatus;
  valor_total: number;
  qtd_requisicoes: number;
  aplis_id?: string;
  created_at: string;
  updated_at: string;
  // Relacionamentos (join)
  operadora?: Operadora;
  requisicoes?: Requisicao[];
}

/**
 * Requisição / Guia de procedimento médico
 * Sincronizado do sistema APLIS
 */
export interface Requisicao {
  id_requisicao: string;
  lote_id?: string;
  numero_guia: string;
  data_criacao: string;
  data_execucao?: string;
  valor: number;
  status: RequisicaoStatus;
  paciente_nome?: string;
  procedimento_codigo?: string;
  procedimento_descricao?: string;
  aplis_id?: string;
  created_at: string;
  updated_at: string;
  // Relacionamentos (join)
  lote?: Lote;
}

/**
 * Nota Fiscal / Fatura emitida para operadora
 * Sincronizado do sistema APLIS
 */
export interface Nota {
  id_nota: string;
  operadora_id: string;
  numero_nota: string;
  data_emissao: string;
  data_vencimento?: string;
  valor_total: number;
  valor_recebido: number;
  valor_glosado: number;
  status: NotaStatus;
  competencia?: string;
  observacoes?: string;
  aplis_id?: string;
  created_at: string;
  updated_at: string;
  // Relacionamentos (join)
  operadora?: Operadora;
  lotes?: Lote[];
  recebimentos?: Recebimento[];
  glosas?: Glosa[];
}

/**
 * Tabela associativa Nota-Lote (N:N)
 */
export interface NotaLote {
  id_nota: string;
  id_lote: string;
  created_at: string;
}

/**
 * Recebimento / Conta a Receber
 * Gerenciado localmente (não sincronizado do APLIS)
 */
export interface Recebimento {
  id_receb: string;
  nota_id?: string;
  lote_id?: string;
  data_prevista: string;
  data_receb?: string;
  valor_previsto: number;
  valor_recebido: number;
  status: RecebimentoStatus;
  banco_nome?: string;
  banco_conta?: string;
  comprovante_url?: string;
  observacoes?: string;
  registrado_por?: string;
  created_at: string;
  updated_at: string;
  // Relacionamentos (join)
  nota?: Nota;
  lote?: Lote;
  glosas?: Glosa[];
}

/**
 * Glosa - valor não pago pela operadora
 * Gerenciado localmente (não sincronizado do APLIS)
 */
export interface Glosa {
  id_glosa: string;
  recebimento_id: string;
  nota_id?: string;
  requisicao_id?: string;
  valor: number;
  motivo: string;
  codigo_glosa?: string;
  status: GlosaStatus;
  recurso: boolean;
  data_recurso?: string;
  resultado_recurso?: string;
  responsavel?: string;
  created_at: string;
  updated_at: string;
  // Relacionamentos (join)
  recebimento?: Recebimento;
  nota?: Nota;
  requisicao?: Requisicao;
}

/**
 * Log de sincronização com APLIS
 */
export interface BillingSyncLog {
  id: string;
  sync_type: SyncType;
  started_at: string;
  finished_at?: string;
  status: SyncStatus;
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  error_message?: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// INTERFACES PARA FORMULÁRIOS / INPUT
// ============================================================================

export interface OperadoraInput {
  nome: string;
  cnpj?: string;
  prazo_pagamento_dias?: number;
  contato_email?: string;
  contato_telefone?: string;
}

export interface RecebimentoInput {
  nota_id?: string;
  lote_id?: string;
  data_prevista: string;
  valor_previsto: number;
  data_receb?: string;
  valor_recebido?: number;
  banco_nome?: string;
  banco_conta?: string;
  observacoes?: string;
}

export interface RecebimentoBaixaInput {
  data_receb: string;
  valor_recebido: number;
  banco_nome?: string;
  banco_conta?: string;
  comprovante_url?: string;
  observacoes?: string;
}

export interface GlosaInput {
  recebimento_id: string;
  nota_id?: string;
  requisicao_id?: string;
  valor: number;
  motivo: string;
  codigo_glosa?: string;
}

export interface GlosaRecursoInput {
  status: GlosaStatus;
  data_recurso?: string;
  resultado_recurso?: string;
  responsavel?: string;
}

// ============================================================================
// INTERFACES PARA MÉTRICAS / DASHBOARD
// ============================================================================

export interface BillingMetrics {
  totalNotasAbertas: number;
  valorTotalAReceber: number;
  valorRecebidoMes: number;
  valorGlosadoMes: number;
  taxaGlosa: number; // Percentual
  notasPorStatus: {
    abertas: number;
    parcialmente_recebidas: number;
    recebidas: number;
    glosadas: number;
  };
  previsaoRecebimento: {
    proximo30dias: number;
    proximo60dias: number;
    proximo90dias: number;
  };
  glosasPendentes: number;
  glosasEmRecurso: number;
}

export interface RecebimentoAgrupado {
  periodo: '30dias' | '60dias' | '90dias' | 'vencido';
  quantidade: number;
  valorTotal: number;
  recebimentos: Recebimento[];
}

// ============================================================================
// INTERFACES PARA RESPOSTA DA API APLIS (Mock)
// ============================================================================

export interface AplisOperadoraResponse {
  id: string;
  name: string;
  cnpj: string;
  paymentTermDays: number;
}

export interface AplisNotaResponse {
  id: string;
  operadoraId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  totalValue: number;
  competence: string;
  status: string;
}

export interface AplisLoteResponse {
  id: string;
  operadoraId: string;
  batchCode: string;
  creationDate: string;
  sendDate?: string;
  status: string;
  totalValue: number;
  requisitionCount: number;
}

export interface AplisRequisicaoResponse {
  id: string;
  batchId?: string;
  guideNumber: string;
  creationDate: string;
  executionDate?: string;
  value: number;
  status: string;
  patientName?: string;
  procedureCode?: string;
  procedureDescription?: string;
}

export interface AplisSyncResponse {
  success: boolean;
  timestamp: string;
  data: {
    operadoras?: AplisOperadoraResponse[];
    notas?: AplisNotaResponse[];
    lotes?: AplisLoteResponse[];
    requisicoes?: AplisRequisicaoResponse[];
  };
}
