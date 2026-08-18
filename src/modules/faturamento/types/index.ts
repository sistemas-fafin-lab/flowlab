// ============================================================================
// FATURAMENTO - Types & Interfaces
// Sistema de Gestão de Faturamento e Recebíveis (Espelho APLIS)
// ============================================================================

// ============================================================================
// ENUMS / TIPOS LITERAIS
// ============================================================================

export type GlosaStatus = 'aberta' | 'em_recurso' | 'revertida' | 'definitiva';

// ============================================================================
// INTERFACES PRINCIPAIS
// ============================================================================

/**
 * Glosa - valor não pago pela operadora, lançada contra um título (`notas`).
 * `recebimento_id` é nullable: glosa avulsa (lançada antes de qualquer baixa)
 * não tem baixa associada.
 */
export interface Glosa {
  id_glosa: string;
  recebimento_id: string | null;
  nota_id: string | null;
  requisicao_id: string | null;
  lote_id: string | null;
  valor: number;
  motivo: string;
  codigo_glosa: string | null;
  status: GlosaStatus;
  recurso: boolean;
  data_recurso: string | null;
  resultado_recurso: string | null;
  responsavel: string | null;
  created_at: string;
  updated_at: string;
  // Relacionamentos (join) — só os campos que a tela de Glosas e Recursos usa.
  nota: { numero_nota: string } | null;
  recebimento: { nota: { numero_nota: string; operadora: { nome: string } | null } | null } | null;
}

// ============================================================================
// INTERFACES PARA FORMULÁRIOS / INPUT
// ============================================================================

export interface GlosaRecursoInput {
  status: GlosaStatus;
  data_recurso?: string;
  resultado_recurso?: string;
  responsavel?: string;
}

/** Filtros que a tela de Glosas salva numa view. */
export interface GlosasViewFiltros {
  status: GlosaStatus | 'todas';
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
// PENDÊNCIAS (aba Contas a Receber → Pendências)
// ============================================================================
// Contrato de GET /api/faturamento/pendencias-nao-faturadas e
// GET /api/faturamento/pendencia-lote-detalhe — lotes do MySQL de backup sem NF/RPS
// vinculado e fora da janela normal de fechamento. Regra completa em
// api/_lib/faturamento/bdLab.ts (listarLotesPendentes).

export interface LotePendencia {
  idLote: number;
  status: number;
  statusLabel: string;
  dtaCriacao: string | null;
  valor: number;
  qtdRequisicoes: number;
  fontePagadora: { id: number | null; nome: string | null; razaoSocial: string | null };
}

/** Requisição de um lote pendente, com a situação de NF individual quando existe
 *  (raro: a requisição foi cobrada fora do lote, mesmo o lote não tendo NF). */
export interface RequisicaoPendencia {
  idRequisicao: number;
  codRequisicao: string | null;
  dtaSolicitacao: string | null;
  dtaFinalizacao: string | null;
  numGuiaConvenio: string | null;
  paciente: string | null;
  valor: number;
  numeroRPS: number | null;
  nfeNumero: string | null;
}

export interface PendenciasFiltros {
  /** YYYY-MM-DD */
  desde?: string;
  /** YYYY-MM-DD — nunca ultrapassa o cutoff de M-2 devolvido em `PendenciasMeta`. */
  ate?: string;
  operadoraId?: number;
  pagina?: number;
  tamanho?: number;
}

export interface PendenciasMeta {
  pagina: number;
  tamanho: number;
  qtdPaginas: number;
  registros: number;
  /** Fim de M-2 — data de corte da regra, calculada no servidor a partir de "hoje". */
  cutoff: string;
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

/** Filtros que a aba Títulos salva numa view — sem paginação, que não é recorte. */
export interface TitulosViewFiltros {
  desde: string;
  ate: string;
  status: TituloStatus | '';
  operadoraId: string;
  busca: string;
}

/** Glosa lançada junto de uma baixa, no formato que `fat_registrar_baixa` espera
 *  (camelCase, não as colunas cruas de `Glosa`). */
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
  /** Top 8 motivos de glosa por valor, no período filtrado. `motivo` é texto
   *  livre normalizado no banco (lower/btrim) — o rótulo é o primeiro texto
   *  lançado daquele grupo, não um valor canônico. */
  porMotivo: {
    motivo: string;
    valor: number;
    quantidade: number;
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
  /** `fatinstituicao.IdInstituicao` no apLIS, como string — null enquanto a
   *  operadora não foi sincronizada. Usado por telas que filtram direto no MySQL
   *  do laboratório (ex.: aba Pendências), que não conhece o UUID do Supabase. */
  aplisId: string | null;
}

/** Tela dona do formato de filtro salvo numa `ViewSalva` — ver comentário de
 *  `fat_views_salvas.tela` na migration 20260810160000. */
export type ViewSalvaTela = 'dashboard' | 'titulos' | 'glosas';

/** Um conjunto de filtros salvo pelo usuário para reaplicar depois.
 *
 *  `filtros` é o que a própria tela gravou (`DashboardReceberFiltros`,
 *  `TitulosFiltros`, ...) — o banco nunca olha dentro dele, então o tipo aqui
 *  fica genérico e cada tela informa o parâmetro concreto ao usar o hook. */
export interface ViewSalva<TFiltros = Record<string, unknown>> {
  id: string;
  tela: ViewSalvaTela;
  nome: string;
  filtros: TFiltros;
  criadoEm: string;
  atualizadoEm: string;
}

// ============================================================================
// GLOSAS E RECURSOS — HISTÓRICO DO LEGADO (aba "Histórico (apLIS)")
// ============================================================================
// Contrato de GET /api/faturamento/glosas-legado e GET /api/faturamento/recursos-legado,
// que leem ao vivo o MySQL de backup do laboratório — nada é persistido no Supabase.
// Só consulta/histórico nesta entrega, sem ação de "adotar" para a tabela `glosas`
// nativa. Espelha api/_lib/faturamento/bdLab.ts; sincronizado à mão, mesmo motivo de
// LoteFaturamento/RequisicaoLote acima.
//
// Ver docs/plans/faturamento/glosas-recursos-legado-design.md.

/** Glosa lançada em fatrequisicaoprocedimento.IdMotivoGlosa — não a de
 *  fatdemonstrativoguiaprocedimento (fonte alternativa não escolhida). */
export interface GlosaRequisicaoLegado {
  idRequisicaoProcedimento: number;
  idRequisicao: number;
  codRequisicao: string | null;
  numGuiaConvenio: string | null;
  paciente: string | null;
  dtaSolicitacao: string | null;
  procedimentoCodigo: string | null;
  procedimentoDescricao: string | null;
  valor: number;
  idMotivoGlosa: number | null;
  /** Código oficial do catálogo `fatmotivoglosa` (ex.: código ANS). */
  motivoCodigo: number | null;
  /** Descrição do catálogo — complementar ao texto operacional `desMotivoGlosa`,
   *  não redundante (os dois textos divergem no legado). */
  motivoDescricao: string | null;
  /** Texto lançado na própria requisição. */
  desMotivoGlosa: string | null;
  fontePagadora: { id: number | null; nome: string | null };
}

export interface GlosasLegadoFiltros {
  /** YYYY-MM-DD — obrigatório: sem período a consulta varreria ~23 mil linhas. */
  periodoIni: string;
  periodoFim: string;
  fontePagadoraId?: number;
  pagina?: number;
  tamanho?: number;
  busca?: string;
}

/** Lote de recurso (fatloterecurso) já protocolado no legado. */
export interface LoteRecursoLegado {
  idLoteRecurso: number;
  /** Código cru de fatloterecurso.Status — sem tabela de label conhecida. */
  status: number;
  /** Derivado das colunas de data (Criado/Enviado/Finalizado/Cancelado), não do
   *  código cru — ver comentário em bdLab.ts. */
  statusLabel: string;
  dtaCriacao: string | null;
  dtaEnvio: string | null;
  dtaFinalizacao: string | null;
  dtaCancelamento: string | null;
  protocolo: string | null;
  protocoloRecursado: string | null;
  fontePagadora: { id: number | null; nome: string | null };
  valorTotal: number;
  qtdProcedimentos: number;
}

/** Procedimento dentro de um lote de recurso, carregado sob demanda ao expandir a linha. */
export interface ProcedimentoRecursoLegado {
  idProcedimento: number;
  idRequisicao: number;
  numGuia: string | null;
  valorRecurso: number;
  idMotivoGlosa: number | null;
  motivoDescricao: string | null;
  justificativa: string | null;
}

export interface RecursosLegadoFiltros {
  status?: number;
  fontePagadoraId?: number;
  busca?: string;
  pagina?: number;
  tamanho?: number;
}

/** Metadados de um documento digitalizado de requisicaoimagem — contrato de
 *  GET /api/faturamento/imagens-legado. Os bytes vêm à parte, sob demanda, por
 *  GET /api/faturamento/imagem-legado-arquivo. */
export interface ImagemRequisicaoLegado {
  id: number;
  nomeArquivo: string;
  extensao: string | null;
  tipo: number | null;
  /** Data em que o arquivo foi digitalizado — null enquanto `disponivel` é false. */
  data: string | null;
  /** false quando a linha existe no apLIS mas ainda não foi digitalizada. */
  disponivel: boolean;
}
