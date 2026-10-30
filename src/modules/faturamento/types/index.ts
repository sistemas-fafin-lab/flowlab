import type { GlosasTitulo } from '../../../../api/_lib/faturamento/recursoGlosa.js';

export type { GlosasTitulo };

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
  /** `protocolo` não vazio e repetido em outro lote, excluindo protocolo em
   *  formato de data (DDMMYYYY plausível) — issue 10 do feedback. */
  protocoloDuplicado: boolean;
  /** Em quantos lotes este protocolo aparece; null quando não duplicado. */
  protocoloDuplicadoContagem: number | null;
  /** `IdLote` dos OUTROS lotes com o mesmo protocolo (exclui o próprio); null
   *  quando não duplicado — issue 13 do feedback. */
  protocoloDuplicadoLotes: number[] | null;
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
  tituloNumero?: string | null;  /** Resumo do "Status Faturamento" (`eventofatur`, por REQUISIÇÃO) das
   *  requisições do lote, mais frequente primeiro — mesma forma de
   *  `LotePendencia.statusFaturamento`. */
  statusFaturamento: StatusFaturamentoResumo[];
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
  /** Descrição do catálogo `fatmotivoglosa` — `motivoGlosa` às vezes vem só com o
   *  código numérico (ex.: "1001"), sem texto; usar em tooltip para mostrar o
   *  motivo completo mesmo nesses casos. */
  motivoGlosaDescricao: string | null;
  /** Glosa com o código resolvido no servidor (demonstrativo do convênio →
   *  catálogo → texto), ou null quando não houve glosa de fato. Opcional: resposta
   *  de versão anterior da API não traz. */
  glosa?: {
    codigo: string | null;
    descricao: string | null;
    /** Valor glosado (demonstrativo do convênio; sem ele, cobrado − recebido após o
     *  retorno). null quando a operadora ainda não retornou. */
    valor?: number | null;
  } | null;
  /** `fatrequisicaoprocedimento.ValorRecebido` — 0 quando glosado integralmente. */
  valorRecebido: number;
  dtaRecebido: string | null;
  /** `valorRecebido < valor` — inclui glosa integral (valorRecebido = 0). */
  pendente: boolean;
  /** `valor - valorRecebido`, nunca negativo; 0 quando não pendente. */
  valorPendente: number;
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
  /** `requisicao.CodEventoFatur` — sinal auxiliar (tabela `eventofatur`; 5 = RECEBIDO,
   *  6 = GLOSADO ainda SEM RECURSO), alinhado à planilha do setor. */
  codEventoFatur: number | null;
  eventoFaturLabel: string | null;
  /** Algum procedimento com `pendente = true`. */
  pendente: boolean;
  /** Soma do `valorPendente` dos procedimentos. */
  valorPendente: number;
}

export interface LotesFiltros {
  /** YYYY-MM-DD */
  periodoIni: string;
  periodoFim: string;
  pagina?: number;
  tamanho?: number;
  /** Código STLOT. */
  statusLote?: number;
  /** Filtro exato por convênio (issue 02): só lotes com este `IdFontePagadora`.
   *  Diferente de `busca`, que casa por texto aproximado. */
  idFontePagadora?: number;
  /** Termo de busca textual (paciente, fonte pagadora, código da requisição, guia, lote). */
  busca?: string;
  /** Esconde os lotes que já pertencem a um título ativo. Usado pelo modal de
   *  criação; recorta a página, não o total (ver o handler). */
  somenteSemTitulo?: boolean;
  /** Só lotes com protocolo duplicado (ver `LoteFaturamento.protocoloDuplicado`). */
  somenteProtocoloDuplicado?: boolean;
  /** "Status Faturamento" (`eventofatur.CodEvento`): só lotes com ao menos uma
   *  requisição nesse status. */
  codEventoFatur?: number;
}

/** Lote da prévia do "Atualizar do apLIS" (GET /api/faturamento/titulos-aplis-previa). */
export interface LotePreviaAplis {
  lote: LoteFaturamento;
  /** Não vira título: "sem valor a faturar". */
  bloqueio: 'sem-valor' | null;
  /** STLOT Recebido / Recebido - parcial: a baixa ainda tem que ser registrada aqui. */
  jaRecebidoAplis: boolean;
  /** Sem NF-e no apLIS: a baixa vai exigir o número. */
  semNf: boolean;
  /** Último desvínculo do lote de um título; o lote vem desmarcado. */
  desvinculado: { idNota: string; numeroNota: string | null; em: string; motivo: string } | null;
}

/** Título existente sem número da nota cujo lote já tem NF-e no apLIS (issue 04). */
export interface NfAPreencherAplis {
  idNota: string;
  idsLote: number[];
  operadora: string;
  situacao: 'preenchivel' | 'divergente';
  nfeNumeros: string[];
}

export interface PreviaAplis {
  desde: string;
  lotes: LotePreviaAplis[];
  nfsAPreencher: NfAPreencherAplis[];
}

/** Tipos da conferência das baixas com o apLIS
 *  (.scratch/faturamento-conferencia-baixas-aplis), na ordem de exibição. */
export type TipoDivergenciaAplis = 'so-no-aplis' | 'aplis-maior' | 'sistema-maior' | 'lote-ausente';

/** Título divergente (GET /api/faturamento/titulos-conferencia-aplis). */
export interface DivergenciaAplis {
  idNota: string;
  numeroNota: string | null;
  operadora: string;
  status: string;
  dataEmissao: string | null;
  valorTotal: number;
  recebidoSistema: number;
  glosadoSistema: number;
  /** null quando algum lote não existe no MySQL (`lote-ausente`). */
  recebidoAplis: number | null;
  primeiroRecebimentoAplis: string | null;
  ultimoRecebimentoAplis: string | null;
  lotes: { aplisId: number; statusAplis: string | null; recebidoAplis: number | null }[];
  tipo: TipoDivergenciaAplis;
}

/** Título cujo lote foi refechado no apLIS depois da emissão
 *  (.scratch/faturamento-pendencias-e-refechamento). Quem edita aplica no "Atualizar". */
export interface RefechamentoAplis {
  idNota: string;
  operadora: string;
  lotes: number[];
  /** YYYY-MM-DD. */
  emissaoAtual: string;
  /** Fechamento mais recente entre os lotes no apLIS (YYYY-MM-DD). */
  emissaoNova: string;
}

/** Refechamento aplicado pelo "Atualizar" (RPC fat_aplicar_refechamentos). */
export interface RefechamentoAplicado {
  idNota: string;
  operadora: string;
  lotes: number[];
  /** YYYY-MM-DD. */
  emissaoAntiga: string;
  /** YYYY-MM-DD. */
  emissaoNova: string;
}

export interface ConferenciaAplis {
  /** Último dia que a réplica do apLIS tem (YYYY-MM-DD). */
  dadoAte: string | null;
  titulos: DivergenciaAplis[];
  refechamentos: RefechamentoAplis[];
}

/** Baixa a lançar a partir do apLIS: uma por data de recebimento lá. */
export interface BaixaSugeridaAplis {
  /** YYYY-MM-DD. */
  data: string;
  valor: number;
  observacoes: string;
}

/** Título da prévia "Aplicar baixas do apLIS"
 *  (GET /api/faturamento/titulos-baixas-aplis-previa). */
export interface TituloPreviaBaixasAplis {
  idNota: string;
  numeroNota: string | null;
  operadora: string;
  tipo: Extract<TipoDivergenciaAplis, 'so-no-aplis' | 'aplis-maior'>;
  recebidoSistema: number;
  recebidoAplis: number;
  baixas: BaixaSugeridaAplis[];
  /** Saldo do título depois das baixas sugeridas. */
  saldo: number;
}

export interface PreviaBaixasAplis {
  dadoAte: string | null;
  titulos: TituloPreviaBaixasAplis[];
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
  /** Busca por número de lote que já está num título (modal de criação). */
  loteBuscadoComTitulo?: { idLote: number; tituloNumero: string | null } | null;
}

// ============================================================================
// ENVIOS POR CONVÊNIO (aba Contas a Receber → Envios)
// ============================================================================
// Contrato de GET /api/faturamento/envios-por-convenio — uma linha por fonte
// pagadora com o total de lotes enviados a ela no período, já agregado no MySQL
// de backup (não paginado/somado no cliente). Regra completa em
// api/_lib/faturamento/bdLab.ts (listarEnviosPorConvenio).

export interface ConvenioEnvioResumo {
  fontePagadoraId: number | null;
  nome: string | null;
  razaoSocial: string | null;
  qtdLotes: number;
  qtdRequisicoes: number;
  valorTotal: number;
  /** Soma de fatrequisicaoprocedimento.ValorRecebido (NULL/não retornado conta como 0). */
  valorRecebido: number;
  /** Soma de GREATEST(ValorLiquido - ValorRecebido, 0) por procedimento, não
   *  valorTotal - valorRecebido (isso mascararia pendência quando outro procedimento
   *  do mesmo convênio foi pago a mais). */
  valorPendente: number;
}

/** "Enviados" — status default da aba Envios: Conciliação + Faturado. Espelha
 *  STATUS_ENVIADOS_PADRAO de api/_lib/faturamento/bdLab.ts. */
export const STATUS_ENVIADOS_PADRAO = [2, 3] as const;

export interface EnviosPorConvenioFiltros {
  /** YYYY-MM-DD, sobre `fatlote.DtaCriacao`. */
  periodoIni: string;
  periodoFim: string;
  /** Códigos STLOT a incluir; default do servidor é [2, 3] ("enviados": Conciliação + Faturado). */
  status?: number[];
}

export interface EnviosPorConvenioMeta {
  periodoIni: string;
  periodoFim: string;
  status: number[];
}

// ============================================================================
// PENDÊNCIAS (aba Contas a Receber → Pendências)
// ============================================================================
// Contrato de GET /api/faturamento/pendencias-nao-faturadas e
// GET /api/faturamento/pendencia-lote-detalhe — lotes do MySQL de backup sem NF/RPS
// vinculado e fora da janela normal de fechamento. Regra completa em
// api/_lib/faturamento/bdLab.ts (listarLotesPendentes).

/** Códigos STLOT que ainda podem virar uma NF — espelha STATUS_PENDENCIA de
 *  api/_lib/faturamento/bdLab.ts (listarLotesPendentes já filtra por eles; o
 *  filtro de status da tela só pode restringir dentro deste conjunto). */
export const STATUS_PENDENCIA = [1, 2, 3, 6, 7] as const;

/** Um valor de `eventofatur` — opção do filtro "Status Faturamento", lida de
 *  /api/faturamento/status-faturamento (config editável no apLIS, sem enum fixo). */
export interface EventoFaturamento {
  codigo: number;
  label: string;
  /** O apLIS esconde os inativos do <select>; o rótulo segue valendo para
   *  requisições antigas que o têm gravado. */
  inativo: boolean;
}

/** Um dos valores de `requisicao.CodEventoFatur` ("Status Faturamento" do apLIS,
 *  campo `autStatusFat` na tela de lá) presentes nas requisições do lote, com
 *  quantas requisições têm esse valor. */
export interface StatusFaturamentoResumo {
  codigo: number;
  label: string;
  qtd: number;
}

export interface LotePendencia {
  idLote: number;
  status: number;
  statusLabel: string;
  dtaCriacao: string | null;
  valor: number;
  qtdRequisicoes: number;
  fontePagadora: { id: number | null; nome: string | null; razaoSocial: string | null };
  /** Resumo do "Status Faturamento" (por REQUISIÇÃO — não confundir com `status`/
   *  `statusLabel` acima, que é o STLOT do LOTE) das requisições do lote, mais
   *  frequente primeiro. Um lote pendente comumente mistura valores. */
  statusFaturamento: StatusFaturamentoResumo[];
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
  /** "Status Faturamento" do apLIS (`autStatusFat`), por requisição. */
  codEventoFatur: number | null;
  eventoFaturLabel: string | null;
  /** Status da requisição no fluxo do laboratório (`requisicao.CodEvento`). */
  codEvento: number | null;
  eventoLabel: string | null;
  /** Tarefas do apLIS da requisição, concluídas ou não. */
  qtdTarefas: number;
  /** Tarefas do apLIS da requisição ainda não concluídas. */
  qtdTarefasAbertas: number;
  /** 'YYYY-MM-DD HH:MM' da primeira tarefa "Recebido no Faturamento"; nulo sem ela. */
  recebidoFaturamento: string | null;
}

export interface PendenciasFiltros {
  /** YYYY-MM-DD */
  desde?: string;
  /** YYYY-MM-DD — nunca ultrapassa o cutoff de M-1 devolvido em `PendenciasMeta`. */
  ate?: string;
  operadoraId?: number;
  /** Código STLOT — só os valores em STATUS_PENDENCIA (servidor) fazem sentido aqui. */
  status?: number;
  /** "Status Faturamento" (`eventofatur.CodEvento`) — mesmo filtro de `LotesFiltros`. */
  codEventoFatur?: number;
  pagina?: number;
  tamanho?: number;
}

export interface PendenciasMeta {
  pagina: number;
  tamanho: number;
  qtdPaginas: number;
  registros: number;
  /** Soma do valor de todos os lotes pendentes, não só a página atual. */
  valorTotal: number;
  /** Fim de M-1 — data de corte da regra, calculada no servidor a partir de "hoje". */
  cutoff: string;
  /** Requisições não faturáveis dentro desses lotes, fora de `valorTotal`. */
  naoFaturaveis: NaoFaturaveisResumo;
}

/** Requisições que ficaram fora do total de uma lista de Pendências por estarem
 *  num status que não pode ser faturado (cancelada, devolvida, aguardando
 *  devolução/retirada, descarte) — a "observação" dos widgets do Dashboard. */
export interface NaoFaturaveisResumo {
  qtdRequisicoes: number;
  valor: number;
  /** Por status da requisição (`requisicao.CodEvento`), maior valor primeiro. */
  porEvento: { codigo: number; label: string; qtd: number; valor: number }[];
}

// ============================================================================
// PENDÊNCIAS — PARTICULARES (aba Contas a Receber → Pendências → Particulares)
// ============================================================================
// Contrato de GET /api/faturamento/pendencias-particulares — requisições da
// fonte pagadora PARTICULAR (1102) sem NF, solicitadas até hoje, ao nível de
// requisição (não de lote — a maioria nunca entra num lote do apLIS). Regra
// completa em api/_lib/faturamento/bdLab.ts (listarParticularesPendentes).

export interface RequisicaoParticularPendencia {
  idRequisicao: number;
  codRequisicao: string | null;
  dtaSolicitacao: string | null;
  dtaFinalizacao: string | null;
  paciente: string | null;
  valor: number;
  codEvento: number;
  eventoLabel: string | null;
  /** Lote do apLIS, quando a requisição chegou a entrar num — a maioria não entra. */
  idLote: number | null;
  /** "Clínica": Local de Origem da requisição no apLIS (nome fantasia). */
  localOrigem: { id: number | null; nome: string | null };
  /** Local de origem marcado como "não emite NF". Só vem `true` com
   *  `incluirSemNf`; sem ele essas requisições nem aparecem. */
  clinicaSemNf: boolean;
  /** Tarefas do apLIS da requisição, concluídas ou não. */
  qtdTarefas: number;
  /** Tarefas do apLIS da requisição ainda não concluídas. */
  qtdTarefasAbertas: number;
  /** 'YYYY-MM-DD HH:MM' da primeira tarefa "Recebido no Faturamento"; nulo sem ela. */
  recebidoFaturamento: string | null;
}

export interface ParticularesPendentesFiltros {
  /** YYYY-MM-DD */
  desde?: string;
  ate?: string;
  pagina?: number;
  tamanho?: number;
  /** Traz de volta as requisições das clínicas sem NF (fora por padrão). */
  incluirSemNf?: boolean;
}

/** Linha de `clinicas_sem_nf` (Supabase): local de origem do apLIS para o qual
 *  o laboratório não emite NF. */
export interface ClinicaSemNf {
  aplisId: number;
  nome: string;
  marcadoEm: string;
}

/** Contrato de GET /api/faturamento/locais-origem (busca do modal "Clínicas sem NF"). */
export interface LocalOrigemBusca {
  id: number;
  nome: string | null;
  razaoSocial: string | null;
  inativo: boolean;
}

export interface ParticularesPendentesMeta {
  pagina: number;
  tamanho: number;
  qtdPaginas: number;
  registros: number;
  /** Soma do valor de todas as requisições pendentes, não só a página atual. */
  valorTotal: number;
  /** Hoje — limite superior da janela, calculado no servidor. Os dados vão de
   *  fato até D-1, porque a réplica do apLIS atrasa ~1 dia. */
  limite: string;
  /** Requisições não faturáveis no mesmo recorte, fora de `valorTotal`. */
  naoFaturaveis: NaoFaturaveisResumo;
}

// ============================================================================
// PENDÊNCIAS — SEM LOTE (aba Contas a Receber → Pendências → Sem lote)
// ============================================================================
// Contrato de GET /api/faturamento/pendencias-sem-lote — requisições de convênio
// (excluindo Particular/Cortesia) com `requisicao.Lote IS NULL`, solicitadas
// até hoje, ao nível de requisição. Regra completa em
// api/_lib/faturamento/bdLab.ts (listarRequisicoesSemLote) — issue 21 do feedback.

export interface RequisicaoSemLotePendencia {
  idRequisicao: number;
  codRequisicao: string | null;
  dtaSolicitacao: string | null;
  dtaFinalizacao: string | null;
  paciente: string | null;
  valor: number;
  fontePagadora: { id: number | null; nome: string | null; razaoSocial: string | null };
  /** Status da requisição no fluxo do laboratório (`requisicao.CodEvento`). */
  codEvento: number | null;
  eventoLabel: string | null;
  /** Clínica: Local de Origem da requisição — onde a guia está parada. */
  localOrigem: { id: number | null; nome: string | null };
  /** Tarefas do apLIS da requisição, concluídas ou não. */
  qtdTarefas: number;
  /** Tarefas do apLIS da requisição ainda não concluídas. */
  qtdTarefasAbertas: number;
  /** 'YYYY-MM-DD HH:MM' da primeira tarefa "Recebido no Faturamento"; nulo sem ela. */
  recebidoFaturamento: string | null;
}

/** Clínica com guias sem lote no recorte — opção do filtro "Clínica". */
export interface ClinicaSemLoteResumo {
  /** null = requisição sem local de origem. */
  id: number | null;
  nome: string | null;
  qtd: number;
  valor: number;
}

export interface RequisicoesSemLoteFiltros {
  /** YYYY-MM-DD */
  desde?: string;
  ate?: string;
  operadoraId?: number;
  /** Local de origem (clínica); 0 = requisições sem local de origem. */
  localOrigemId?: number;
  pagina?: number;
  tamanho?: number;
}

export interface RequisicoesSemLoteMeta {
  pagina: number;
  tamanho: number;
  qtdPaginas: number;
  registros: number;
  /** Soma do valor de todas as requisições pendentes, não só a página atual. */
  valorTotal: number;
  /** Hoje — limite superior da janela, calculado no servidor. Os dados vão de
   *  fato até D-1, porque a réplica do apLIS atrasa ~1 dia. */
  limite: string;
  /** Clínicas com guias no recorte, ignorando o filtro de clínica — mais guias primeiro. */
  clinicas: ClinicaSemLoteResumo[];
}

/** Sub-aba da aba "Pendências", compartilhada entre ContasReceberPage (dono do
 *  estado) e ContasReceberDashboard (widgets-resumo que navegam até ela). */
export type SubAbaPendencias = 'lotes' | 'particulares' | 'semLote';

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

/** Os dois status que representam "falta receber" — preset do atalho "Somente
 *  pendentes" da aba Títulos (issue 38). */
export const STATUS_TITULOS_PENDENTES: readonly TituloStatus[] = ['aberta', 'parcialmente_recebida'];

/** Glosas ainda em disputa — o recorte `aberta` do filtro "Glosa" da aba Títulos. */
export const STATUS_GLOSA_EM_DISPUTA: readonly GlosaStatus[] = ['aberta', 'em_recurso'];

/** Guia congelada dentro de um lote do título. Base do rateio de baixa e glosa. */
export interface TituloGuia {
  id: string;
  numeroGuia: string;
  /** CodRequisicao do apLIS. Null em títulos criados antes dessa coluna existir. */
  codigoRequisicao: string | null;
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
  /** Protocolo do lote na operadora (`lotes.protocolo`, cópia do apLIS); null se não informado. */
  protocolo: string | null;
  valorTotal: number;
  qtdRequisicoes: number;
  /** Quem fechou o lote no apLIS (`lotes.responsavel_fechamento`); null se não registrado. */
  responsavelFechamento: string | null;
  guias?: TituloGuia[];
}

/** Uma baixa (linha de `recebimentos`) do título — issue 39: histórico de baixas. */
export interface TituloBaixa {
  id: string;
  /** Data em que o valor entrou, YYYY-MM-DD. Null nas linhas legadas nunca baixadas. */
  dataReceb: string | null;
  valorRecebido: number;
  /** Nome do usuário que registrou (`user_profiles.name`), null se não resolvido. */
  registradoPorNome: string | null;
  createdAt: string;
}

/** Glosa do apLIS de um título, uma por requisição, como a linha expandida
 *  mostra (GET /api/faturamento/titulo-glosas-aplis). */
export interface GlosaAplisTitulo {
  idRequisicao: number;
  codRequisicao: string | null;
  numGuia: string | null;
  paciente: string | null;
  /** `aplis_id` do lote de faturamento do título. */
  idLoteFaturamento: number;
  /** Evento de faturamento do apLIS. */
  statusAplis: number | null;
  /** Motivos do catálogo do apLIS ('código descrição'). */
  motivos: string[];
  /** Glosa fixada; null no deferido total sem lote de recurso. */
  valorGlosado: number | null;
  /** Líquido − recebido nos status 18 e 8: o que sai do saldo do título; null nos demais. */
  glosaAcatada: number | null;
  /** null: fora dos quatro status (por exemplo, em tratativas sem nada recebido). */
  status: StatusGlosaDashboard | null;
}

export interface TituloReceber {
  id: string;
  /** Pode ser null: operadoras nf_apos_pagamento criam o título antes de ter o número (issue 32). */
  numeroNota: string | null;
  operadoraId: string;
  operadoraNome: string | null;
  dataEmissao: string;
  dataVencimento: string | null;
  competencia: string | null;
  valorTotal: number;
  valorRecebido: number;
  /** Derivada no banco: total − recebido − glosa acatada do apLIS
   *  (.scratch/glosas-recursos-dashboard, issue 13). */
  valorSaldo: number;
  /** Glosado, Glosa recebida e Glosa acatada da foto de Glosas e Recursos, somados
   *  nos lotes do título (.scratch/glosas-recursos-dashboard, issue 12). null:
   *  a leitura falhou — a tela mostra "—". */
  glosasAplis: GlosasTitulo | null;
  status: TituloStatus;
  observacoes: string | null;
  /** Dias corridos de atraso; negativo = ainda a vencer, null = sem vencimento. */
  diasAtraso: number | null;
  /** `notas.updated_at` — quando o status atual foi atingido (baixa/glosa que o recalculou). */
  statusAtualizadoEm: string;
  lotes: TituloLote[];
  /** Números de NFs canceladas do título que casaram com a busca da lista
   *  (.scratch/faturamento-nf-cancelada, issue 03). Ausente fora da busca. */
  nfsCanceladasBuscadas?: string[];
}

export interface TitulosFiltros {
  /** YYYY-MM-DD, sobre a data de vencimento (issue 40 — antes era emissão). */
  desde: string;
  ate: string;
  status?: TituloStatus | '';
  operadoraId?: string;
  /** Número da nota (busca parcial). */
  busca?: string;
  /** Issue 16: some da lista os títulos de operadoras marcadas `is_clinica_parceira`. */
  ocultarParceiras?: boolean;
  /** Issue 38: atalho "Somente pendentes" — filtra por STATUS_TITULOS_PENDENTES quando
   *  `status` manual está vazio. Preset em cima do filtro de Status, não substituto. */
  somentePendentes?: boolean;
  /** Recorte por glosa lançada no título (tabela `glosas`). Vazio = sem recorte. */
  glosa?: FiltroGlosaTitulo;
  /** Só os títulos que divergem do apLIS (.scratch/faturamento-conferencia-baixas-aplis). */
  divergenteAplis?: boolean;
  /** Ids da conferência com o apLIS, quando `divergenteAplis` está ligado.
   *  null = a conferência ainda não chegou ou falhou: a lista fica vazia em vez
   *  de mostrar títulos que talvez não divirjam. */
  idsDivergentesAplis?: string[] | null;
  pagina?: number;
  tamanho?: number;
}

/**
 * Filtro "Glosa" da aba Títulos, sobre as linhas de `glosas` do título:
 * - `com`: tem ou já teve glosa, em qualquer status (inclusive revertida);
 * - `aberta`: tem glosa ainda em disputa (aberta ou em recurso);
 * - `sem`: nunca teve glosa lançada.
 */
export type FiltroGlosaTitulo = '' | 'com' | 'aberta' | 'sem';

/** Filtros que a aba Títulos salva numa view — sem paginação, que não é recorte. */
export interface TitulosViewFiltros {
  desde: string;
  ate: string;
  status: TituloStatus | '';
  operadoraId: string;
  busca: string;
  ocultarParceiras: boolean;
  somentePendentes: boolean;
  glosa: FiltroGlosaTitulo;
  divergenteAplis: boolean;
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

/** Faixa de dias de atraso do aging da carteira — mesmas chaves de
 *  `DashboardReceber.aging`/`agingPorOperadora`. Usada pelo modal de
 *  drill-down (issue 41) para traduzir a faixa clicada num range sobre
 *  `data_vencimento`. */
export type AgingBucket = 'a_vencer' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_mais';

/** Faixa clicada no gráfico "Aging da carteira" (issue 41) — estado
 *  compartilhado entre `ContasReceberDashboard` (dono do clique) e
 *  `AgingDetalheModal` (Props). O clique sempre abre a faixa inteira, com
 *  todas as operadoras — a barra é empilhada por operadora só para dar
 *  contexto visual. */
export interface AgingSelecao {
  bucket: AgingBucket;
  /** Rótulo já formatado da faixa (ex. "31–60 dias"), o mesmo do eixo do gráfico. */
  rotulo: string;
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
  /** O mesmo aging acima, quebrado por operadora — carteira inteira (não só o
   *  período filtrado), ordenada pelo maior saldo total (`total` = soma dos 5
   *  buckets). Quantas entram no gráfico é decisão do frontend. */
  agingPorOperadora: {
    operadoraId: string;
    nome: string;
    a_vencer: number;
    d1_30: number;
    d31_60: number;
    d61_90: number;
    d90_mais: number;
    total: number;
  }[];
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

/** Meta mensal de faturamento (issue 43) — valor único global por mês/ano,
 *  restrito às fontes marcadas `is_considerada_meta` (issue 36). Contrato de
 *  `metas_faturamento` + `fat_meta_mensal_faturado`. */
export interface MetaMensal {
  ano: number;
  mes: number;
  /** "YYYY-MM" de `ano`/`mes` — mesmo formato de `TituloReceber.competencia`, pronto para `formatCompetencia`. */
  competencia: string;
  /** null = meta não cadastrada para este mês/ano — não repete o valor do mês anterior. */
  valorMeta: number | null;
  /** Soma de `valor_total` dos títulos emitidos no mês/ano, restrita à whitelist. */
  faturado: number;
  /** `max(valorMeta - faturado, 0)`; 0 também quando a meta não está definida. */
  quantoFalta: number;
  /** `faturado >= valorMeta`; sempre false quando a meta não está definida. */
  metaBatida: boolean;
  qtdTitulos: number;
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
  /** Issue 16: é clínica parceira (lab que envia exame pra este processar),
   *  não convênio de saúde — o apLIS não distingue isso. */
  isClinicaParceira: boolean;
  /** Issue 31: só permite emitir a NF depois do pagamento — inverso do padrão
   *  do módulo (NF libera o pagamento). O apLIS não tem essa distinção. */
  nfAposPagamento: boolean;
  /** Whitelist de negócio (lista fechada passada pelo setor de faturamento,
   *  03/09): só fontes pagadoras marcadas aqui contam nas tabelas e no
   *  dashboard do módulo Faturamento. Default false — fonte nova/desconhecida
   *  fica de fora até alguém marcar. */
  consideradaMeta: boolean;
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
// GLOSAS E RECURSOS — FOTO DO apLIS
// ============================================================================
// Contrato de POST /api/faturamento/glosas-recursos-sincronizar e
// GET /api/faturamento/glosas-recursos-lotes (.scratch/glosas-recursos-dashboard/).
// A foto mora no Supabase; a sincronização a grava a partir do apLIS.

/** Rótulo do lote de recurso, derivado das datas do apLIS. */
export type StatusLoteRecurso = 'Criado' | 'Enviado' | 'Finalizado' | 'Cancelado';

/** Selo de atraso do lote; 'sem-regra' é o "—" (convênio sem regra de análise). */
export type SeloAtrasoLote = 'no-prazo' | 'vence-hoje' | 'atrasado' | 'sem-regra';

/** Lote de recurso na sub-aba "Lotes de recurso", somado no mês de faturamento. */
export interface LoteRecursoFoto {
  idLoteRecurso: number;
  statusLabel: StatusLoteRecurso;
  /** Protocolo do recurso na operadora. */
  protocolo: string | null;
  /** Protocolo do faturamento recorrido. */
  protocoloFaturamento: string | null;
  fontePagadora: { id: number | null; nome: string | null };
  dataCriacao: string | null;
  /** A que vale: a editada pelo lápis ou a do apLIS. */
  dataEnvio: string | null;
  dataEnvioAplis: string | null;
  /** A data de envio foi corrigida pelo lápis. */
  dataEnvioEditada: boolean;
  /** Retorno real da operadora, registrado pelo lápis: encerra o selo. */
  dataRetornoReal: string | null;
  /** Pagamento real do recurso, registrado pelo lápis. */
  dataPagamentoReal: string | null;
  qtdRequisicoes: number;
  /** Σ glosa fixada das requisições do lote no mês. */
  valorGlosado: number;
  /** Σ valor recursado das requisições do lote no mês. */
  valorRecorrido: number;
  /** Envio + regra Glosa – Análise do convênio; null sem envio ou sem regra. */
  dataRetornoPrevista: string | null;
  /** Retorno (real ou previsto) + regra Glosa – Pagamento; null sem base ou sem regra. */
  dataPagamentoPrevista: string | null;
  /** null: não conta (lote não enviado, com retorno real ou classificação final). */
  selo: SeloAtrasoLote | null;
}

/** Requisição na sub-aba "Recursos fora de lote" (GET glosas-recursos-fora-de-lote). */
export interface RecursoForaDeLote {
  idRequisicao: number;
  codRequisicao: string | null;
  numGuia: string | null;
  paciente: string | null;
  /** YYYY-MM do lote de faturamento original. */
  competencia: string;
  fontePagadora: { id: number | null; nome: string | null };
  /** 6: glosado sem recurso; 7 ou 16: em recurso sem lote. */
  status: number;
  /** Data de recebimento da requisição; null sem retorno do convênio. */
  dataGlosa: string | null;
  /** Procedimentos glosados ('código descrição'). */
  procedimentos: string[];
  /** Motivos do catálogo do apLIS ('código descrição'). */
  motivos: string[];
  /** Glosa fixada. */
  valorGlosado: number | null;
  valorInicialEstimado: boolean;
  /** Recebimento + regra Glosa – Recurso; null sem regra ou sem recebimento. */
  prazoRecorrer: string | null;
  /** 'sem-regra' é o "—": não há prazo para comparar. */
  selo: SeloAtrasoLote;
}

/** Filtros das listas de requisições (Recursos fora de lote, Glosas recentes). */
export interface ListaRequisicoesGlosasFiltros extends RecorteGlosas {
  busca?: string;
  pagina: number;
  tamanho: number;
}

/** Status da glosa como no Dashboard (spec, "Status do Dashboard"). */
export type StatusGlosaDashboard = 'aberta' | 'em-recurso' | 'revertida' | 'definitiva';

/** Glosa na aba "Glosas recentes" (GET glosas-recursos-recentes). */
export interface GlosaRecente {
  idRequisicao: number;
  codRequisicao: string | null;
  numGuia: string | null;
  paciente: string | null;
  /** YYYY-MM do lote de faturamento original. */
  competencia: string;
  fontePagadora: { id: number | null; nome: string | null };
  /** Evento de faturamento do apLIS. */
  statusAplis: number | null;
  /** Data de recebimento da requisição; null sem retorno do convênio. */
  dataGlosa: string | null;
  /** Procedimentos glosados ('código descrição'). */
  procedimentos: string[];
  /** Motivos do catálogo do apLIS ('código descrição'). */
  motivos: string[];
  /** Glosa fixada. */
  valorGlosado: number | null;
  valorInicialEstimado: boolean;
  /** null: fora dos quatro status (por exemplo, em tratativas sem nada recebido). */
  status: StatusGlosaDashboard | null;
}

/** Requisição da foto no card "Detalhes do recurso" (GET glosas-recursos-detalhe). */
export interface RequisicaoRecursoFoto {
  idRequisicao: number;
  codRequisicao: string | null;
  numGuia: string | null;
  paciente: string | null;
  /** YYYY-MM do lote de faturamento original. */
  competencia: string;
  fontePagadora: { id: number | null; nome: string | null };
  idLoteRecurso: number | null;
  /** `requisicao.CodEventoFatur`. */
  statusAplis: number | null;
  glosaFixada: number | null;
  valorRecursado: number | null;
  /** ΔRec: o que entrou de recebido desde a fixação; null sem base. */
  valorRecebidoGlosa: number | null;
  /** Valores corrigidos pelo lápis (valem acima do apLIS). */
  editados: { valorRecursado: boolean; valorRecebidoGlosa: boolean };
  valorInicialEstimado: boolean;
}

/** Campos que o lápis corrige — contrato de POST /api/faturamento/glosas-recursos-editar. */
export type CampoEdicaoLoteRecurso = 'dataEnvio' | 'dataRetornoReal' | 'dataPagamentoReal';
export type CampoEdicaoRequisicaoRecurso = 'valorRecursado' | 'valorRecebidoGlosa';

/** Uma edição manual; `valor` null remove a edição e volta a valer o apLIS. */
export type EdicaoRecurso =
  | { idLoteRecurso: number; campo: CampoEdicaoLoteRecurso; valor: string | null }
  | { idRequisicao: number; campo: CampoEdicaoRequisicaoRecurso; valor: number | null };

/** Procedimento da requisição no lote de recurso, com o que foi argumentado. */
export interface JustificativaRecurso {
  idProcedimento: number;
  procedimento: string | null;
  valorRecurso: number;
  motivoGlosa: string | null;
  justificativa: string | null;
}

/** Tarefa do apLIS de uma requisição, de qualquer setor, em texto puro
 *  (GET /api/faturamento/tarefas-requisicao). */
export interface TarefaRequisicao {
  codTarefa: number;
  /** 'YYYY-MM-DD HH:MM' no horário do laboratório. */
  data: string | null;
  tipo: string | null;
  remetente: string | null;
  /** Setor de destino ou, sem setor, o usuário destinatário. */
  destino: string | null;
  mensagem: string | null;
  concluida: boolean;
  /** 'YYYY-MM-DD HH:MM'. */
  dataConclusao: string | null;
  obsConclusao: string | null;
}

/** Tarefa do apLIS da requisição para o setor GLOSA - FATURAMENTO. */
export interface ObservacaoRecurso {
  codTarefa: number;
  /** 'YYYY-MM-DD HH:MM' no horário do laboratório. */
  data: string | null;
  tipo: string | null;
  remetente: string | null;
  mensagem: string | null;
  concluida: boolean;
  obsConclusao: string | null;
}

export type TipoEventoHistoricoRecurso =
  | 'inicio_acompanhamento'
  | 'entrada_lote_recurso'
  | 'mudanca_status'
  | 'mudanca_recebido'
  | 'envio_lote'
  | 'edicao_manual';

/** Evento da aba Histórico (glosa_recurso_historico): da requisição ou do lote dela. */
export interface EventoHistoricoRecurso {
  id: string;
  idLoteRecurso: number | null;
  /** ISO: quando a sincronização viu a mudança (ou a edição foi feita). */
  ocorridoEm: string;
  tipo: TipoEventoHistoricoRecurso;
  valorAnterior: string | null;
  valorNovo: string | null;
  descricao: string;
  /** Preenchido nas edições manuais; null nos eventos da sincronização. */
  usuarioId: string | null;
  usuarioNome: string | null;
}

export interface DetalheRequisicaoRecurso {
  requisicao: RequisicaoRecursoFoto;
  justificativas: JustificativaRecurso[];
  observacoes: ObservacaoRecurso[];
  /** Do mais antigo ao mais novo. */
  historico: EventoHistoricoRecurso[];
}

export interface UltimaSincronizacaoGlosas {
  sincronizadoEm: string;
  /** Data do dado mais recente da réplica do apLIS (~1 dia de atraso). */
  dadoAte: string | null;
}

export interface LotesRecursoMeta {
  pagina: number;
  tamanho: number;
  qtdPaginas: number;
  registros: number;
}

/** Recorte comum às três abas: mês do lote de faturamento original e convênio. */
export interface RecorteGlosas {
  /** YYYY-MM. */
  competencia: string;
  /** `fatinstituicao.IdInstituicao`; null = todos. */
  fontePagadoraId: number | null;
}

export interface LotesRecursoFiltros extends RecorteGlosas {
  status?: StatusLoteRecurso;
  busca?: string;
  pagina: number;
  tamanho: number;
}

/** Card do Acompanhamento: percentual da quantidade sobre o total de recursos. */
export interface CardRecursos {
  quantidade: number;
  valor: number;
  percentual: number;
}

/** Cards do Acompanhamento dos recursos — contrato de GET /api/faturamento/glosas-recursos-resumo. */
export interface ResumoAcompanhamentoRecursos {
  /** Requisições em lote de recurso; valor = Σ recursado. */
  total: {
    quantidade: number;
    valor: number;
    /** % sobre o mês de faturamento anterior; null sem recursos nele. */
    variacao: number | null;
  };
  emAnalise: CardRecursos;
  /** Valor = o que voltou do recurso. */
  deferidos: CardRecursos;
  indeferidos: CardRecursos;
  /** Em tratativa: valor recebido e o que falta a operadora pagar. */
  deferidoParcial: { quantidade: number; valor: number; pendente: number };
  /** Saldo negativo das requisições em 18 ou 8, com ou sem recurso. */
  acatada: { quantidade: number; valor: number };
}

/** Card do Dashboard: variação do valor sobre o mês de faturamento anterior (null sem valor nele). */
export interface CardDashboardGlosas {
  quantidade: number;
  valor: number;
  variacao: number | null;
}

/** Linha de ranking do Dashboard (procedimento, convênio, motivo). */
export interface ItemRankingGlosa {
  nome: string;
  /** Glosa fixada; a de uma requisição se divide entre os itens dela. */
  valor: number;
  /** Requisições em que o item aparece. */
  quantidade: number;
  percentual: number;
}

/** Aba Dashboard de Glosas e Recursos — contrato de GET /api/faturamento/glosas-recursos-dashboard. */
export interface DashboardGlosas {
  /** Revertidas: valor deferido; os outros: glosa fixada. */
  cards: Record<StatusGlosaDashboard, CardDashboardGlosas>;
  /** Os 6 meses até o período, do mais antigo ao filtrado. */
  evolucao: { competencia: string; aberta: number; emRecurso: number; revertida: number }[];
  /** Total = requisições nos quatro status; percentual da quantidade. */
  distribuicao: {
    total: number;
    status: { status: StatusGlosaDashboard; quantidade: number; valor: number; percentual: number }[];
  };
  /** Percentual: do total glosado (por valor) ou das ocorrências (por ocorrências). */
  procedimentos: { porValor: ItemRankingGlosa[]; porOcorrencias: ItemRankingGlosa[] };
  /** Percentual do total glosado. */
  convenios: ItemRankingGlosa[];
  /** Por ocorrências, os menores em "Outros"; percentual das ocorrências. */
  motivos: ItemRankingGlosa[];
}

/** Metadados de um documento digitalizado de requisicaoimagem — contrato de
 *  GET /api/faturamento/imagens-legado. Os bytes vêm à parte, sob demanda, por
 *  GET /api/faturamento/imagem-legado-arquivo. */
export interface ImagemRequisicaoLegado {
  id: number;
  nomeArquivo: string;
  extensao: string | null;
  tipo: number | null;
  /** Data em que o arquivo foi digitalizado — a réplica só a tem para o tipo 10. */
  data: string | null;
  /** false quando o arquivo não está na réplica e o S3 do apLIS não está configurado. */
  disponivel: boolean;
}

// ============================================================================
// CORREÇÃO DE LANÇAMENTOS (.scratch/titulos-edicao-lancamentos)
// ============================================================================

/** Campos digitados de uma baixa — os que a correção pode alterar. */
export interface BaixaCampos {
  valorRecebido: number;
  /** YYYY-MM-DD. */
  dataReceb: string | null;
  formaRecebimento: string | null;
  bancoNome: string | null;
  bancoConta: string | null;
  observacoes: string | null;
}

/** Campos digitados de uma glosa que a correção pode alterar. O status fica
 *  de fora de propósito: tem fluxo próprio em Glosas & Recursos. */
export interface GlosaCampos {
  valor: number;
  motivo: string;
  requisicaoId: string | null;
  loteId: string | null;
}

export interface GlosaLancada extends GlosaCampos {
  id: string;
  status: GlosaStatus;
}

/** Uma baixa do título com as glosas lançadas junto dela. */
export interface BaixaLancada extends BaixaCampos {
  id: string;
  registradoPorNome: string | null;
  glosas: GlosaLancada[];
}

/** Tudo o que foi lançado à mão num título: as baixas (com suas glosas) e as
 *  glosas sem baixa ("Lançar glosa" e backfill). */
export interface LancamentosTitulo {
  baixas: BaixaLancada[];
  glosasSemBaixa: GlosaLancada[];
}

/** Troca do número da nota com a NF anterior cancelada no portal da prefeitura
 *  (.scratch/faturamento-nf-cancelada). Ausente = correção de digitação ou
 *  primeiro preenchimento: nada entra no histórico de NFs canceladas. */
export interface CancelamentoNfAnterior {
  motivo: string;
  /** YYYY-MM-DD. */
  dataCancelamento: string;
}

/** Uma NF anterior do título, cancelada no portal da prefeitura
 *  (`fat_nfs_canceladas`). Não confundir com título cancelado. */
export interface NfCancelada extends CancelamentoNfAnterior {
  id: string;
  numeroNota: string;
  registradoPorNome: string;
}

/** NF cancelada sem título (importada da planilha sem candidato único), achada
 *  pela busca da lista de títulos como resultado próprio. */
export interface NfCanceladaSemTitulo extends CancelamentoNfAnterior {
  id: string;
  numeroNota: string;
  operadoraNome: string | null;
  valor: number | null;
  /** YYYY-MM-DD. */
  dataEmissao: string | null;
}

/** Corpo de `fat_corrigir_lancamento`. `recebimentoId` null = grupo das glosas
 *  sem baixa do título (aí `baixa` nunca vem). */
export interface CorrecaoLancamentoPayload {
  notaId: string;
  recebimentoId: string | null;
  motivo: string;
  /** Presente só quando algum campo da baixa mudou — e então completo. */
  baixa?: BaixaCampos;
  glosasAlteradas: (GlosaCampos & { id: string })[];
  glosasNovas: (GlosaCampos & { status: GlosaStatus })[];
  glosasExcluidas: string[];
}

/** Linha de `notas_lancamentos_audit_logs`, para a seção "Alterações". */
export interface AlteracaoLancamento {
  id: string;
  entidade: 'baixa' | 'glosa';
  acao: 'alteracao' | 'inclusao' | 'exclusao';
  campo: string | null;
  valorAnterior: string | null;
  valorNovo: string | null;
  motivo: string;
  feitoPorNome: string;
  feitoEm: string;
}

// ============================================================================
// INDICADORES DE FATURAMENTO (.scratch/faturamento-indicadores/)
// ============================================================================

/** Um card: valor da janela atual, da anterior e a variação (% com uma casa;
 *  null quando a anterior é zero). */
export interface CardIndicadorFaturamento {
  atual: number;
  anterior: number;
  variacao: number | null;
}

/** Uma barra de ranking, com as duas métricas (a não escolhida vai no tooltip). */
export interface ItemRankingIndicadores {
  nome: string;
  valor: number;
  quantidade: number;
  /** Lotes distintos do grupo; só no ranking de faturistas. */
  lotes?: number;
}

/** Top 10 já calculado nas duas ordens; o botão R$/Qtd escolhe qual mostrar. */
export interface RankingIndicadores {
  porValor: ItemRankingIndicadores[];
  porQuantidade: ItemRankingIndicadores[];
}

/** Contrato de GET /api/faturamento/indicadores. */
export interface IndicadoresFaturamento {
  cards: {
    totalFaturado: CardIndicadorFaturamento;
    requisicoes: CardIndicadorFaturamento;
    exames: CardIndicadorFaturamento;
  };
  rankings: {
    /** Fonte pagadora do lote; quantidade = exames faturados. */
    convenios: RankingIndicadores;
    /** Código do procedimento; nome = código e a descrição mais usada dele. */
    exames: RankingIndicadores;
    /** Local de Origem da requisição; quantidade = requisições distintas. */
    clinicas: RankingIndicadores;
    /** Quem abriu o lote; quantidade = requisições distintas, com o nº de lotes. */
    faturistas: RankingIndicadores;
  };
}

/** Período pedido a GET /api/faturamento/indicadores; o fim do modo Período é inclusivo. */
export type PeriodoIndicadoresFaturamento =
  | { modo: 'mes'; mes: string }
  | { modo: 'periodo'; inicio: string; fim: string };

/** Janela de datas 'YYYY-MM-DD', as duas pontas inclusivas. */
export interface JanelaIndicadoresFaturamento {
  inicio: string;
  fim: string;
}

export interface IndicadoresFaturamentoMeta {
  /** Criação do lote mais recente do backup, 'YYYY-MM-DD HH:MM' (hora do banco). */
  dadoAte: string | null;
  /** Janela pedida e a anterior, com que os cards comparam. */
  janelas: { atual: JanelaIndicadoresFaturamento; anterior: JanelaIndicadoresFaturamento };
}

// ============================================================================
// PONTUAÇÃO DO SETOR (.scratch/faturamento-pontuacao/)
// ============================================================================

export type FrentePontuacao = 'faturamento' | 'recursoGlosa';

/** Meta × faturado (por emissão) × % atingido; meta e % nulos sem meta cadastrada. */
export interface DetalheMetaPontuacao {
  tipo: 'meta';
  meta: number | null;
  faturado: number;
  percentual: number | null;
}

/** Tarefas do apLIS abertas no fim do mês, por membro da Frente e do setor GLOSA – FATURAMENTO. */
export interface DetalheTarefasPontuacao {
  tipo: 'tarefas';
  pessoas: { idUsuarioAplis: number; nome: string; pendencias: number }[];
  setor: number;
}

export interface ConvenioSemLotePontuacao {
  idFontePagadora: number;
  nome: string;
  pendentes: number;
}

/** Convênios com requisição solicitada no mês anterior, com e sem requisição sem lote. */
export interface DetalheGuiasSemLotePontuacao {
  tipo: 'guiasSemLote';
  semPendencia: Omit<ConvenioSemLotePontuacao, 'pendentes'>[];
  comPendencia: ConvenioSemLotePontuacao[];
}

export interface ConvenioRecebidoPontuacao {
  idFontePagadora: number;
  nome: string;
  recebidas: number;
  glosadas: number;
}

/** Convênios com recebimento no mês, sem e com requisição glosada. */
export interface DetalheZeroGlosaPontuacao {
  tipo: 'zeroGlosa';
  semGlosa: Omit<ConvenioRecebidoPontuacao, 'glosadas'>[];
  comGlosa: ConvenioRecebidoPontuacao[];
}

export type DetalheCriterioPontuacao =
  | DetalheMetaPontuacao
  | DetalheTarefasPontuacao
  | DetalheGuiasSemLotePontuacao
  | DetalheZeroGlosaPontuacao;

export interface CriterioPontuacao {
  chave: string;
  rotulo: string;
  tipo: 'automatico' | 'manual';
  pontosBase: number;
  /** Pontos base valem por convênio. */
  porConvenio?: true;
  pontosAtingidos: number;
  observacao: string;
  detalhe: DetalheCriterioPontuacao | null;
  /** Só nos critérios manuais: quem lançou e quando (ISO); null quando não lançado. */
  lancamento?: { por: string | null; em: string } | null;
}

/** Contrato de POST /api/faturamento/pontuacao: lança ou altera um critério manual. */
export interface LancamentoPontuacao {
  mes: string;
  frente: FrentePontuacao;
  chave: string;
  pontos: number;
  observacao: string;
}

/** Membro de uma Frente na tela "Membros": o usuário do apLIS e se ainda conta. */
export interface MembroPontuacao {
  frente: FrentePontuacao;
  idUsuarioAplis: number;
  nome: string;
  ativo: boolean;
}

/** Usuário ativo do apLIS devolvido pela busca da tela "Membros". */
export interface UsuarioAplisPontuacao {
  idUsuarioAplis: number;
  nome: string;
}

/** Critério na tela "Pontos base": o padrão do código e o valor em vigor. */
export interface PontoBasePontuacao {
  frente: FrentePontuacao;
  chave: string;
  rotulo: string;
  tipo: 'automatico' | 'manual';
  /** Pontos base valem por convênio. */
  porConvenio?: true;
  padrao: number;
  pontosBase: number;
  /** Quem alterou por último e quando (ISO); null quando nunca foi alterado. */
  alteradoPor: string | null;
  alteradoEm: string | null;
}

export interface FrentePontuada {
  frente: FrentePontuacao;
  rotulo: string;
  criterios: CriterioPontuacao[];
  total: number;
}

/** Contrato de GET /api/faturamento/pontuacao. */
export interface PontuacaoSetor {
  mes: string;
  frentes: FrentePontuada[];
}

export type PontuacaoSetorMeta =
  | {
      situacao: 'previa';
      /** Dado do apLIS mais recente usado, 'YYYY-MM-DD HH:MM'; null sem fato do apLIS. */
      dadoAte: string | null;
    }
  | {
      /** Fechamento da pontuação: os números congelados (issue 06). */
      situacao: 'fechado';
      /** "Dados até" usado no fechamento, 'YYYY-MM-DD HH:MM'. */
      dadoAte: string;
      fechadoPor: string | null;
      /** ISO. */
      fechadoEm: string;
    };

// ─── Calendário de envios (.scratch/faturamento-calendario-envios/) ────────────

/** Janela da Regra de envio; espelha JanelaEnvio de api/_lib/faturamento/calendarioEnvios.ts. */
export type JanelaEnvio =
  | { tipo: 'dias_corridos'; de: number; ate: number }
  | { tipo: 'dias_uteis'; de: number; ate: number }
  | { tipo: 'dias_fixos'; dias: number[] }
  | { tipo: 'ultimo_dia_util' }
  | { tipo: 'todos_os_dias' }
  | { tipo: 'calendario_convenio' };

export interface RegraEnvio {
  id: string;
  convenio: string;
  /** Convênios cobertos pelos agrupadores (AMHPDF); null nos demais. */
  membros: string | null;
  /** `fatinstituicao.IdInstituicao` das fontes pagadoras do apLIS do convênio. */
  fontesPagadoras: number[];
  /** `fatconvenio.IdConvenio` dos convênios membros (agrupadores AMHPDF): a confirmação automática casa por eles. */
  conveniosAplis: number[];
  janelas: JanelaEnvio[];
  /** Só nas regras de "todos os dias": quantos envios a sugestão espalha no mês. */
  enviosSugeridosMes: number | null;
  observacao: string | null;
  ativo: boolean;
  alteradoPorNome: string | null;
  /** ISO. */
  alteradoEm: string;
}

/** O que o cadastro de Regras de envio grava (POST salvarRegra); `id` nulo cria. */
export type DadosRegraEnvio = Omit<RegraEnvio, 'id' | 'conveniosAplis' | 'alteradoPorNome' | 'alteradoEm'> & { id: string | null };

/** Espelha StatusAgendamento de api/_lib/faturamento/calendarioEnvios.ts. */
export type StatusAgendamento = 'pendente' | 'enviado' | 'atrasado' | 'fora_do_prazo';

export interface AgendamentoEnvio {
  id: string;
  regraId: string;
  /** 'YYYY-MM-DD'. */
  dataPrevista: string;
  /** Índice em RegraEnvio.janelas; null fora de todas as janelas. */
  janelaIndice: number | null;
  origem: 'sugestao' | 'manual';
  editado: boolean;
  /** 'YYYY-MM-DD'; null enquanto não foi enviado. */
  dataEnvio: string | null;
  marcadoPorNome: string | null;
  /** ISO. */
  marcadoEm: string | null;
  /** Lote do backup do apLIS que confirmou o envio: o selo "confirmado no apLIS". */
  loteAplisConfirmado: number | null;
  /** Classificado pelo servidor em `hoje`; a tela não recalcula. */
  status: StatusAgendamento;
  /** Selo cinza informativo: a data prevista ou a de envio cai fora das janelas da regra no mês. */
  foraDaJanela: boolean;
}

export interface FeriadoEnvio {
  id: string;
  data: string;
  descricao: string;
  abrangencia: 'nacional' | 'DF';
  /** Null nos feriados da carga inicial. */
  alteradoPorNome: string | null;
  /** ISO; null nos feriados da carga inicial. */
  alteradoEm: string | null;
}

/** O que o cadastro de feriados grava (POST salvarFeriado); `id` nulo cria. */
export type DadosFeriadoEnvio = Pick<FeriadoEnvio, 'data' | 'descricao' | 'abrangencia'> & { id: string | null };

/** Contrato de GET /api/faturamento/calendario-envios. */
export interface CalendarioEnvios {
  /** 'YYYY-MM-DD' em America/Sao_Paulo. */
  hoje: string;
  /** O próximo dia útil depois de hoje. */
  amanha: string;
  /** 'YYYY-MM' da grade. */
  mes: string;
  regras: RegraEnvio[];
  /** Ids das regras ativas de "todos os dias": a lista lateral "Pode enviar qualquer dia". */
  podeEnviarQualquerDia: string[];
  feriados: FeriadoEnvio[];
  /** Os do mês e os de hoje e amanhã. */
  agendamentos: AgendamentoEnvio[];
  /** Atrasados e fora do prazo de qualquer mês, fora do prazo primeiro. */
  atrasados: AgendamentoEnvio[];
  sugestao: SituacaoSugestaoEnvios;
  confirmacaoAplis: ConfirmacaoAplisEnvios;
}

/** Um lote do backup do apLIS enviado no mês que não casou com nenhum agendamento. */
export interface EnvioNaoPlanejado {
  idLote: number;
  nomeFontePagadora: string | null;
  /** Os convênios das requisições do lote (o membro, nos lotes do AMHP-DF). */
  nomesConvenios: string | null;
  /** 'YYYY-MM-DD'. */
  dataEnvio: string;
}

/** A confirmação automática do mês pelo backup do apLIS (D+1). */
export interface ConfirmacaoAplisEnvios {
  /** Calculados na hora; não ficam gravados. */
  naoPlanejados: EnvioNaoPlanejado[];
  /** Quando o backup ou a gravação falhou: o calendário vem sem as confirmações novas. */
  aviso: string | null;
}

/** A sugestão do mês seguinte e a regeração do corrente (GET /api/faturamento/calendario-envios). */
export interface SituacaoSugestaoEnvios {
  /** 'YYYY-MM'. */
  mesSeguinte: string;
  /** A partir do dia 15 do mês corrente, a sugestão do mês seguinte pode ser gerada. */
  liberada: boolean;
  /** O mês seguinte já tem agendamentos da sugestão. */
  mesSeguintePlanejado: boolean;
  /** Sugeridos pendentes e não editados do mês corrente: o que regerá-lo pode refazer. */
  sugeridosPendentesMesAtual: number;
}

/** O que POST gerarSugestao gravou (ou, ao simular, gravaria). */
export interface ResultadoSugestaoEnvios {
  mes: string;
  criados: number;
  removidos: number;
}

/** Espelha AcaoHistorico de api/_lib/faturamento/dadosCalendarioEnvios.ts. */
export type AcaoHistoricoAgendamento = 'criou' | 'moveu' | 'marcou' | 'desmarcou' | 'confirmou_aplis' | 'removeu';

/** Uma linha do histórico de um Agendamento de envio (GET ?historico=<id>). */
export interface EventoHistoricoAgendamento {
  acao: AcaoHistoricoAgendamento;
  /** Só os campos que mudaram (data_prevista, data_envio, origem, lote_aplis_confirmado); no "removeu" da sugestão, depois = { pela_sugestao: true }. */
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  /** Null na confirmação automática, que roda sem usuário. */
  porNome: string | null;
  /** ISO. */
  em: string;
}
