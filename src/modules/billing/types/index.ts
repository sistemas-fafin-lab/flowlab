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

export interface RecebimentoAgrupado {
  periodo: '30dias' | '60dias' | '90dias' | 'vencido';
  quantidade: number;
  valorTotal: number;
  recebimentos: Recebimento[];
}

// ============================================================================
// LOTES DE FATURAMENTO (aba Faturas)
// ============================================================================
// Contrato de GET /api/faturamento/lotes e GET /api/faturamento/lote-detalhe, que
// consultam o MySQL de backup do laboratório ao vivo — nada disso é persistido no
// Supabase. Espelha api/_lib/faturamento/bdLab.ts (fonte da verdade); sincronizado à
// mão, porque o SPA e as functions não compartilham pacote de tipos.
//
// A normalização acontece no servidor: `valor` chega número (o MySQL manda DECIMAL
// como string) e as datas chegam ISO YYYY-MM-DD, formatadas pelo próprio banco para
// não trocarem de dia entre o fuso do Vercel (UTC) e o da máquina de dev.

/** Tabela de código STLOT ("Status de Lote") do apLIS. */
export const STLOT_LABELS: Record<number, string> = {
  1: 'Em Processamento',
  2: 'Conciliação',
  3: 'Faturado',
  4: 'Recebido',
  5: 'Cancelado',
  6: 'Exportado TOTVS',
  7: 'Recebido - parcial',
  8: 'Prejuízo',
};

export interface LoteFaturamento {
  idLote: number;
  status: number;
  statusLabel: string;
  dtaCriacao: string | null;
  dtaFechamento: string | null;
  dtaEnvio: string | null;
  dtaCancelamento: string | null;
  protocolo: string | null;
  nfeNumero: string | null;
  nfeCodigoVerificacao: string | null;
  numeroRPS: number | null;
  /** Vencimento da NF/RPS do lote. */
  dtaVencimento: string | null;
  prestador: string | null;
  valor: number;
  qtdRequisicoes: number;
  fontePagadora: {
    /** `fatinstituicao.IdInstituicao` — vira `operadoras.aplis_id` no título. */
    id: number | null;
    nome: string | null;
    razaoSocial: string | null;
    cpfCnpj: string | null;
  };
  /** Título de contas a receber que já cobra este lote; null = disponível.
   *  Preenchido pelo servidor fora do cache do apLIS (ver faturamento-lotes.ts). */
  tituloId?: string | null;
  tituloNumero?: string | null;
}

/** Item cobrado de uma requisição. A descrição vem da tabela de preço do convênio. */
export interface ProcedimentoRequisicao {
  codigo: string | null;
  descricao: string | null;
  quantidade: number;
  valorUnitario: number;
  valor: number;
  numGuia: string | null;
  motivoGlosa: string | null;
}

/** Requisição dentro de um lote, com os procedimentos que ela levou para a cobrança. */
export interface RequisicaoLote {
  idRequisicao: number;
  codRequisicao: string | null;
  dtaSolicitacao: string | null;
  dtaFinalizacao: string | null;
  numGuiaConvenio: string | null;
  paciente: string | null;
  valor: number;
  procedimentos: ProcedimentoRequisicao[];
}

export interface LotesFiltros {
  /** YYYY-MM-DD */
  periodoIni: string;
  periodoFim: string;
  pagina?: number;
  tamanho?: number;
  /** Código STLOT. */
  statusLote?: number;
  /** Termo de busca textual (paciente, fonte pagadora, código da requisição, guia, lote). */
  busca?: string;
  /** Esconde os lotes que já pertencem a um título ativo. Usado pelo modal de
   *  criação; recorta a página, não o total (ver o handler). */
  somenteSemTitulo?: boolean;
}

export interface LotesMeta {
  pagina: number;
  tamanho: number;
  qtdPaginas: number;
  registros: number;
  /** Data do lote mais recente que existe no backup — o banco é réplica e atrasa ~1 dia. */
  dadoAte: string | null;
  /** Só quando somenteSemTitulo=1: quantos lotes desta página foram ocultados por
   *  já ter título. `registros`/`qtdPaginas` continuam contando SEM esse filtro. */
  filtrados?: number;
}

// ============================================================================
// CONTAS A RECEBER (aba Faturamento → Contas a Receber)
// ============================================================================
// Um TÍTULO (`notas`) é o agrupamento manual de N lotes do apLIS cobrado de uma
// operadora. Sobre ele são registradas baixas parciais (`recebimentos`) e glosas.
//
// Os lotes e as guias ficam CONGELADOS no título no instante da criação: o MySQL
// de backup continua se atualizando, e um título já emitido não pode mudar de
// valor sozinho.

export type TituloStatus =
  | 'aberta'
  | 'parcialmente_recebida'
  | 'recebida'
  | 'liquidada'
  | 'glosada'
  | 'cancelada';

/** Guia congelada dentro de um lote do título. Base do rateio de baixa e glosa. */
export interface TituloGuia {
  id: string;
  numeroGuia: string;
  dataExecucao: string | null;
  valor: number;
  pacienteNome: string | null;
  procedimentoDescricao: string | null;
}

/** Lote do apLIS congelado no título. */
export interface TituloLote {
  id: string;
  aplisId: string | null;
  codigoLote: string;
  statusLabel: string | null;
  dataEnvio: string | null;
  valorTotal: number;
  qtdRequisicoes: number;
  guias?: TituloGuia[];
}

export interface TituloReceber {
  id: string;
  numeroNota: string;
  operadoraId: string;
  operadoraNome: string | null;
  dataEmissao: string;
  dataVencimento: string | null;
  competencia: string | null;
  valorTotal: number;
  valorRecebido: number;
  valorGlosado: number;
  /** Derivada no banco: total - recebido - glosado. */
  valorSaldo: number;
  status: TituloStatus;
  observacoes: string | null;
  /** Dias corridos de atraso; negativo = ainda a vencer, null = sem vencimento. */
  diasAtraso: number | null;
  lotes: TituloLote[];
}

export interface TitulosFiltros {
  /** YYYY-MM-DD, sobre a data de emissão. */
  desde: string;
  ate: string;
  status?: TituloStatus | '';
  operadoraId?: string;
  /** Número da nota (busca parcial). */
  busca?: string;
  pagina?: number;
  tamanho?: number;
}

/** Glosa lançada junto de uma baixa. Nome distinto do `GlosaInput` legado, que
 *  espelha as colunas cruas da tabela e é consumido por useBilling. */
export interface GlosaLancamentoInput {
  valor: number;
  motivo: string;
  codigoGlosa?: string | null;
  status?: 'aberta' | 'em_recurso' | 'revertida' | 'definitiva';
  /** Guia a que a glosa se refere, quando o operador detalhou o rateio. */
  requisicaoId?: string | null;
  loteId?: string | null;
}

export interface BaixaInput {
  notaId: string;
  valorRecebido: number;
  /** YYYY-MM-DD */
  dataRecebimento: string;
  bancoNome?: string | null;
  bancoConta?: string | null;
  formaRecebimento?: string | null;
  observacoes?: string | null;
  glosas: GlosaLancamentoInput[];
}

/** Filtros do painel de Contas a Receber.
 *
 *  Os três recortes aceitam vários valores: dentro de um campo valem como OR,
 *  entre campos como AND. Lista vazia = campo sem filtro. */
export interface DashboardReceberFiltros {
  /** YYYY-MM-DD, sobre a data de emissão do título. */
  desde: string;
  ate: string;
  operadoraIds: string[];
  /** Códigos de lote no apLIS (ou aplis_id), cada um em busca parcial. */
  lotes: string[];
  /** Números de nota fiscal, cada um em busca parcial. */
  notas: string[];
}

/** Contrato de `fat_dashboard_receber`. Tudo já agregado no banco.
 *
 *  Os quatro valores de `kpis` saem do mesmo conjunto de títulos — os emitidos
 *  no período — e por isso fecham entre si: `acatado` é a parte de `glosado`
 *  já assumida como perda (glosa definitiva), e não uma quinta grandeza. */
export interface DashboardReceber {
  kpis: {
    faturado: number;
    recebido: number;
    glosado: number;
    /** Glosa definitiva: o pedaço do glosado que não será mais recorrido. */
    acatado: number;
    qtdTitulos: number;
    /** Dias que a regra contratual da operadora promete, do envio ao pagamento. */
    prazoPrevistoDias: number | null;
    /** Dias medidos: envio do lote → primeiro recebimento do título. */
    prazoMedioDias: number | null;
    /** O mesmo prazo, ponderado pelo valor recebido. */
    prazoPonderadoDias: number | null;
    /** Títulos que tinham envio e recebimento — a base dos dois prazos acima. */
    prazoBaseTitulos: number;
  };
  aging: {
    a_vencer: number;
    d1_30: number;
    d31_60: number;
    d61_90: number;
    d90_mais: number;
  };
  porOperadora: {
    operadoraId: string;
    nome: string;
    saldo: number;
    /** Carteira inteira da operadora (todo título não cancelado), sem recorte de
     *  período — diferente de `kpis.qtdTitulos`, que é só os emitidos no período. */
    qtdTitulos: number;
    faturado: number;
    glosado: number;
    percentualGlosa: number;
  }[];
  previsaoOperadoras: PrevisaoOperadora[];
  serieMensal: {
    competencia: string;
    faturado: number;
    recebido: number;
    glosado: number;
  }[];
}

/** Prazo prometido × prazo praticado por uma operadora, no período filtrado.
 *
 *  Os três prazos são NULL quando não há base: título sem data de envio do lote
 *  ou ainda sem nenhum recebimento. `base` diz sobre quantos títulos os prazos
 *  realizados foram medidos — sem ele, "sem histórico" e "pagou no dia" ficariam
 *  indistinguíveis na tela. */
export interface PrevisaoOperadora {
  operadoraId: string;
  nome: string;
  /** A regra do contrato como está escrita, ou null quando não cadastrada. */
  regra: string | null;
  /** Títulos da operadora emitidos no período. */
  qtdTitulos: number;
  prazoPrevisto: number | null;
  prazoMedio: number | null;
  prazoPonderado: number | null;
  base: number;
}

/** Operadora do seletor de filtros. */
export interface OperadoraResumo {
  id: string;
  nome: string;
}
