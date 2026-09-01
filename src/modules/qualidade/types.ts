// Tipos do módulo Qualidade — consolidados de packages/shared/src/{periodo,proveniencia,ocorrencias,cortesias,ihq,cancer}.ts
// (flowlab-qualidade, Fase 1) em um único arquivo, já que flowlab-main não tem o pacote @flowlab/shared.
// Portado verbatim na Fase 2 (openspec/changes/fase-2-integrar-flowlab-main) — não editar o SIGNIFICADO,
// só a localização.

// ─── de packages/shared/src/periodo.ts ──────────────────────────────────────────
/**
 * Recorte temporal de uma apuração. Sempre passado como argumento explícito
 * às regras de negócio — nenhuma regra chama `new Date()`/`NOW()` (P4).
 *
 * Trimestre é apresentação, não armazenamento: quem precisa agrupar por
 * trimestre converte para `{ inicio, fim }` antes de consultar o LIS.
 */
export type Periodo = { inicio: string; fim: string } | { ano: number; trimestre: 1 | 2 | 3 | 4 };

export function periodoParaIntervalo(periodo: Periodo): { inicio: string; fim: string } {
  if ('inicio' in periodo) {
    return periodo;
  }

  const primeiroMesDoTrimestre = (periodo.trimestre - 1) * 3 + 1;
  const inicio = `${periodo.ano}-${String(primeiroMesDoTrimestre).padStart(2, '0')}-01`;
  const ultimoMesDoTrimestre = primeiroMesDoTrimestre + 2;
  const ultimoDia = new Date(Date.UTC(periodo.ano, ultimoMesDoTrimestre, 0)).getUTCDate();
  const fim = `${periodo.ano}-${String(ultimoMesDoTrimestre).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

  return { inicio, fim };
}

// ─── de packages/shared/src/proveniencia.ts ──────────────────────────────────────────
/**
 * P1 — proveniência é obrigatória, nunca implícita. Todo campo sensível a
 * confiança carrega de onde veio, não só o valor.
 */
export type Proveniencia =
  | 'lis'
  | 'derivado'
  | 'heuristica'
  | 'texto_livre'
  | 'fixo'
  | 'curadoria';

export type NivelConfianca = 'alta' | 'media' | 'baixa' | 'nenhuma';

export interface CampoRastreado<T> {
  valor: T | null;
  proveniencia: Proveniencia;
  /** Só se aplica quando `proveniencia === 'heuristica'`. */
  confianca?: NivelConfianca;
  /** Só se aplica quando `proveniencia === 'texto_livre'` — nunca descartar (P9). */
  textoOriginal?: string;
  confirmadoPor?: string;
  confirmadoEm?: string;
}

// ─── de packages/shared/src/ocorrencias.ts ──────────────────────────────────────────
export type StatusCuradoriaOcorrencia = 'pendente' | 'concluida';

/**
 * DTO que chega ao frontend. Nenhum campo `Cod*`/`Id*` do LIS aparece com
 * esse nome (architecture.md § Contratos entre camadas) — exceção
 * deliberada para `codRequisicao`, que a equipe usa para conferir no LIS.
 */
export interface OcorrenciaDTO {
  id: string;
  dtaOcorrencia: string;
  numCod: number | null;
  codRequisicao: string | null;
  descricaoLis: string | null;
  acaoImediataLis: string | null;
  cauDescricaoLis: string | null;
  categoriaOrigemDescricao: string | null;
  categoriaOrigemGenerica: boolean;
  colaboradorId: string | null;
  colaboradorNome: string | null;
  setorErroId: string | null;
  setorErroNome: string | null;
  motivoId: string | null;
  motivoNome: string | null;
  resumoCurado: string | null;
  acaoCurada: string | null;
  statusCuradoria: StatusCuradoriaOcorrencia;
  revisaoPendente: boolean;
  curadoPor: string | null;
  curadoEm: string | null;
}

export interface OcorrenciaFiltro {
  inicio: string;
  fim: string;
  setorErroId?: string;
  motivoId?: string;
  colaboradorId?: string;
  status?: StatusCuradoriaOcorrencia;
}

export interface CuradoriaOcorrenciaInput {
  colaboradorId?: string | null;
  setorErroId?: string | null;
  motivoId?: string | null;
  resumoCurado?: string | null;
  acaoCurada?: string | null;
}

export interface IndicadorOcorrenciasResposta {
  periodo: { inicio: string; fim: string };
  /** Pendentes/em análise no período — nunca somado às agregações abaixo (R5/R6). */
  aClassificar: number;
  porMotivo: { motivoId: string; motivoNome: string; total: number }[];
  porSetor: { setorId: string; setorNome: string; total: number }[];
  porColaborador: { colaboradorId: string; colaboradorNome: string; total: number }[];
  /** Chave `'YYYY-MM'`. */
  serieMensal: { mes: string; total: number }[];
  /** Chave `'YYYY-QN'`. */
  serieTrimestral: { trimestre: string; total: number }[];
}

// ─── de packages/shared/src/cortesias.ts ──────────────────────────────────────────
export type StatusCuradoriaCortesia = 'pendente' | 'em_analise' | 'concluida' | 'descartada';
export type SituacaoPrazoCortesia = 'dentro_prazo' | 'fora_prazo' | 'sem_autorizacao' | 'nao_autorizada';
export type RecortePeriodoCortesia = 'solicitacao' | 'autorizacao';
export type EstadoCota = 'normal' | 'atencao' | 'excedido';

export interface CortesiaDTO {
  id: string;
  codRequisicao: string;
  /** PII (P10) — nunca persistido em `qa_cortesias`; lido do LIS sob demanda a cada requisição (listagem em lote, detalhe por período do dia). */
  nomePacienteLis: string | null;
  dtaSolicitacao: string;
  dtaAutorizacao: string | null;
  clinicaNome: string | null;
  exameNome: string | null;
  valorParticular: number | null;
  /** Curadoria: valor particular preenchido manualmente quando o LIS não tem o dado. Ganha de `valorParticular` na exibição quando presente. */
  valorParticularCorrigido: number | null;
  valorCobrado: number | null;
  /** `null` ≠ `0` — preço não cadastrado (R4). Nunca renderizar como "R$ 0,00". */
  valorConcedido: number | null;
  /** Curadoria: ajuste manual quando o LIS não tem o preço cadastrado. Ganha de `valorConcedido` na exibição quando presente. */
  valorConcedidoCorrigido: number | null;
  autorizadoPorLis: string | null;
  observacoesLis: string | null;
  parsingFalhou: boolean;
  diasAteAutorizacao: number | null;
  situacaoPrazo: SituacaoPrazoCortesia;
  aprovadaForaDoPrazo: boolean;
  divergenciaValores: boolean;
  precoCortesiaNaoCadastrado: boolean;
  motivoId: string | null;
  motivoNome: string | null;
  classificacaoId: string | null;
  classificacaoNome: string | null;
  autorizadoPorCorrigidoId: string | null;
  autorizadoPorCorrigidoNome: string | null;
  observacoesCuradas: string | null;
  statusCuradoria: StatusCuradoriaCortesia;
  revisaoPendente: boolean;
  curadoPor: string | null;
  curadoEm: string | null;
}

export interface CortesiaFiltro {
  inicio: string;
  fim: string;
  recorte?: RecortePeriodoCortesia;
  clinicaIdLis?: number;
  situacaoPrazo?: SituacaoPrazoCortesia;
  status?: StatusCuradoriaCortesia;
}

export interface CuradoriaCortesiaInput {
  motivoId?: string | null;
  classificacaoId?: string | null;
  autorizadoPorCorrigidoId?: string | null;
  observacoesCuradas?: string | null;
  valorParticularCorrigido?: number | null;
  valorConcedidoCorrigido?: number | null;
  status: StatusCuradoriaCortesia;
}

export interface CotaCortesiaDTO {
  id: string;
  clinicaIdLis: number;
  clinicaNome: string | null;
  cotaMensal: number;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  observacoes: string | null;
  realizadoPeriodo: number;
  estado: EstadoCota;
}

export interface NotificacaoCortesiaDTO {
  id: string;
  codRequisicao: string;
  clinicaNome: string | null;
  exameNome: string | null;
  autorizadoPor: string | null;
  dtaSolicitacao: string;
  sincronizadoEm: string;
}

export interface CotaCortesiaInput {
  clinicaIdLis: number;
  cotaMensal: number;
  vigenciaInicio: string;
  vigenciaFim?: string | null;
  observacoes?: string | null;
}

/** Um dos 4 autorizadores acompanhados no painel — nome canônico, cor fixa por pessoa (ver dashboard). */
export type AutorizadorAcompanhado = 'Eduarda Fabri' | 'Mario Gorini' | 'Cristiane Madeiro' | 'Luis Felipe';

export interface IndicadorCortesiasResposta {
  periodo: { inicio: string; fim: string };
  recorte: RecortePeriodoCortesia;
  totalCortesias: number;
  totalConcedido: number;
  precoNaoCadastradoContagem: number;
  aprovadasForaDoPrazo: number;
  cotasExcedidas: number;
  porClinica: { clinicaIdLis: number; clinicaNome: string | null; total: number }[];
  porClassificacao: { classificacaoId: string | null; classificacaoNome: string | null; total: number }[];
  /** Chave `'YYYY-MM'` — só os 4 autorizadores acompanhados (identidade, não ranking, ver dashboard). */
  porAutorizadorMensal: { mes: string; autorizador: AutorizadorAcompanhado; total: number }[];
  /** Cortesias cujo autorizador (curado ou texto do LIS) não casa com nenhum dos 4 acompanhados — linha "Outros" do gráfico. */
  outrosAutorizadoresMensal: { mes: string; total: number }[];
}

// ─── de packages/shared/src/ihq.ts ──────────────────────────────────────────
// (NivelConfianca já definido acima, em proveniencia.ts — mesmo arquivo agora.)

export type StatusCuradoriaIhq = 'pendente' | 'em_analise' | 'concluida' | 'descartada';
export type StatusLisIhq = 'concluido' | 'cancelado' | 'em_andamento';

export interface CandidataVinculoIhq {
  codRequisicaoOriginal: string;
  dtaSolicitacao: string;
  temPeca: boolean;
}

/**
 * DTO que chega ao frontend. `candidatas` é recalculada na leitura a
 * partir do LIS (não persistida — mesmo padrão da sugestão de colaborador
 * em Ocorrências), então só vem preenchida em `GET /:id`, nunca na listagem.
 */
export interface IhqDTO {
  id: string;
  codRequisicaoIhq: string;
  /** PII (P10) — só vem preenchido em `GET /:id`, recomputado do LIS; sempre `null` na listagem. */
  nomePacienteLis: string | null;
  idTarefaBloco: number | null;
  dtaAdmissao: string | null;
  dtaSolicitacaoBloco: string | null;
  medicoSolicitante: string | null;
  statusLis: StatusLisIhq | null;
  codRequisicaoOriginal: string | null;
  vinculoProveniencia: 'heuristica' | 'manual';
  vinculoConfianca: NivelConfianca | null;
  materialLis: string | null;
  patologistaLis: string | null;
  candidatas: CandidataVinculoIhq[] | null;
  dtaEnvioBloco: string | null;
  dtaEnvioProveniencia: 'texto_livre' | 'curadoria' | null;
  dtaEnvioTextoOriginal: string | null;
  /** R4 — padrão não validado contra dado real, exibir sempre com ressalva. */
  dtaRetornoBloco: string | null;
  blocoRetornou: boolean | null;
  laminaEnviada: boolean | null;
  observacoes: string | null;
  statusCuradoria: StatusCuradoriaIhq;
  revisaoPendente: boolean;
  curadoPor: string | null;
  curadoEm: string | null;
}

export interface IhqFiltro {
  inicio: string;
  fim: string;
  vinculoConfianca?: NivelConfianca;
  /** Aditivo: `baixa`/`nenhuma` E ainda não confirmado manualmente. */
  vinculoAConfirmar?: boolean;
  status?: StatusCuradoriaIhq;
}

export interface ConfirmarVinculoInput {
  codRequisicaoOriginal: string;
}

export interface CuradoriaIhqInput {
  laminaEnviada?: boolean | null;
  observacoes?: string | null;
  dtaEnvioBlocoCorrigida?: string | null;
  status: StatusCuradoriaIhq;
}

export interface IndicadorIhqResposta {
  periodo: { inicio: string; fim: string };
  dataReferencia: string;
  emAberto: number;
  atrasados: number;
  /** Informativo — R4 nunca vira indicador crítico. */
  retornados: number;
}

// ─── de packages/shared/src/cancer.ts ──────────────────────────────────────────
export type TriagemCancer = 'pendente' | 'cancer_confirmado' | 'nao_cancer' | 'inconclusivo';
export type TipoCido = 'topografia' | 'morfologia';

/**
 * Sugestão de candidatura a câncer baseada em `diagnostico.CodInternacional`
 * e/ou em descrições da lista CID-O carregada em `qa_cido_catalogo`.
 *
 * ⚠️ Heurística, nunca decisão (R2/P1). O campo existe apenas para destacar
 * casos que merecem atenção na triagem; todos os positivos continuam visíveis,
 * e a decisão final continua sendo humana.
 */
export interface CandidaturaCancerDTO {
  candidato: boolean;
  /** `alta` = bateu código CID-O; `media` = bateu descrição; `null` = sem indício. */
  confianca: 'alta' | 'media' | null;
  /** Indicadores legíveis para tooltip/auditoria (ex.: "codigo_cid_o:M-80903"). */
  indicadores: string[];
}

/**
 * Sugestão de topografia/morfologia CID-O pré-preenchida a partir de dados
 * já estruturados do LIS (`diagnostico.CodInternacional` para morfologia,
 * `topografia.DesTopografia` do fragmento para topografia) — nunca de
 * palavra-chave no texto livre do laudo.
 *
 * ⚠️ Sempre precisa de confirmação humana (R2/P3) — nunca é gravada em
 * `qa_cancer_casos` sozinha; só aparece quando o campo correspondente ainda
 * não foi classificado.
 */
export interface SugestaoClassificacaoCancerDTO {
  codigo: string;
  descricao: string;
}

/**
 * Resumo do caso — usado na listagem do funil. Nome/sexo/CPF são lidos do
 * LIS em lote a cada requisição (nunca persistidos em `qa_cancer_casos`,
 * P10) — desvio explícito da decisão original de deixar PII fora da
 * listagem (design.md D1/D7): o próprio usuário do módulo pediu essas
 * colunas na worklist, não só no drawer de 1 caso. Nome da mãe e data de
 * nascimento continuam fora daqui — só em `CancerCasoDetalheDTO`.
 */
export interface CancerCasoResumoDTO {
  id: string;
  codRequisicao: string;
  dtaDiagnostico: string;
  dtaColeta: string | null;
  dtaColetaDivergente: boolean;
  triagem: TriagemCancer;
  cidoTopografiaCodigo: string | null;
  cidoTopografiaDescricao: string | null;
  cidoMorfologiaCodigo: string | null;
  cidoMorfologiaDescricao: string | null;
  observacoes: string | null;
  exportacaoId: string | null;
  revisaoPendente: boolean;
  /** PII (P10) — lida do LIS em lote a cada requisição, nunca persistida. */
  nomePacienteLis: string;
  sexoLis: number | null;
  cpfLis: string | null;
  /** Preenchido só quando o caso já foi exportado (via `exportacaoId`) — curadoria informada na hora da exportação, não um campo por caso. */
  registrador: string | null;
  /** Sugestão de candidatura a câncer (heurística, nunca decisão). */
  candidatura: CandidaturaCancerDTO;
  /** `null` quando já classificado, ou quando não há correspondência confiável no LIS. */
  sugestaoTopografia: SugestaoClassificacaoCancerDTO | null;
  sugestaoMorfologia: SugestaoClassificacaoCancerDTO | null;
}

/**
 * Campos fixos do layout RHC (CNES, Fonte, Cor "ignorado" etc.) — mesmo
 * valor para todos os casos do lote, carregado uma vez por período em vez
 * de repetido por linha. Ver `docs/Planing/data-dictionaries/Positivos_Cancer.md`.
 */
export interface ParametrosFixosCancerDTO {
  cnes: string;
  fonte: string;
  regiaoAdministrativa: string;
  municipio: string;
  estado: string;
  naturalidadeFixa: string;
  nacionalidadeFixa: string;
  corIgnorado: string;
  enderecoCodigo: string;
  profissaoCodigo: string;
  meioDiagnostico: string;
  extensao: string;
  casoRaro: string;
  estadoCivilIgnorado: string;
  escolaridadeIgnorado: string;
}

/** Detalhe de 1 caso, com PII lida do LIS sob demanda — nunca persistida (P10). */
export interface CancerCasoDetalheDTO extends CancerCasoResumoDTO {
  nomePacienteLis: string;
  sexoLis: number | null;
  cpfLis: string | null;
  nomeMaeLis: string | null;
  dataNascimentoLis: string | null;
  patologistaLaudoLis: string | null;
  textoLaudo: string | null;
  triagemJustificativa: string | null;
  triadoPor: string | null;
  triadoEm: string | null;
  classificadoPor: string | null;
  classificadoEm: string | null;
}

export interface FunilCancerResposta {
  periodo: { inicio: string; fim: string };
  universo: number;
  triados: number;
  confirmados: number;
  classificados: number;
  exportados: number;
  /** R8 — retificação de laudo pós-exportação, contada à parte (nunca some dentro das 5 contagens normais). */
  retificacaoPendente: number;
  casos: CancerCasoResumoDTO[];
  parametrosFixos: ParametrosFixosCancerDTO;
}

export interface TriagemCancerInput {
  triagem: Exclude<TriagemCancer, 'pendente'>;
  justificativa: string;
}

export interface ClassificacaoCancerInput {
  cidoTopografiaCodigo: string;
  cidoMorfologiaCodigo: string;
}

export interface CidoEntradaDTO {
  codigo: string;
  tipo: TipoCido;
  descricao: string;
}

export interface ExportacaoRhcDTO {
  id: string;
  ano: number;
  trimestre: 1 | 2 | 3 | 4;
  hashArquivo: string;
  totalCasos: number;
  registrador: string;
  geradoPor: string;
  geradoEm: string;
}

export interface GerarExportacaoInput {
  ano: number;
  trimestre: 1 | 2 | 3 | 4;
  registrador: string;
}

/**
 * Chaves editáveis de `ParametrosFixosCancerDTO` (`qa_parametros`, módulo
 * `cancer`) — "raramente variam" (Fonte, Cor etc.), mas não são hardcoded
 * (P5), e o usuário pediu que fiquem editáveis a partir do drawer de 1 caso,
 * com confirmação. `cnes` também mantém sua própria coluna na tabela — só
 * passou a entrar aqui porque não havia NENHUM outro lugar no app pra
 * configurá-lo (achado ao investigar o relato de CNES sempre vazio: a
 * migration nunca semeou `qa_parametros`, e `atualizarParametroFixoCancer`
 * recusa criar chave nova, então sem seed nem sem entrar neste conjunto
 * editável, `cnes` ficaria travado pra sempre).
 */
export const CHAVES_PARAMETRO_FIXO_CANCER = [
  'cnes',
  'fonte',
  'cor_ignorado',
  'endereco_codigo',
  'regiao_administrativa',
  'municipio',
  'estado',
  'naturalidade_fixa',
  'nacionalidade_fixa',
  'profissao_codigo',
  'meio_diagnostico',
  'extensao',
  'caso_raro',
  'estado_civil_ignorado',
  'escolaridade_ignorado',
] as const;

export type ChaveParametroFixoCancer = (typeof CHAVES_PARAMETRO_FIXO_CANCER)[number];

export interface AtualizarParametroFixoCancerInput {
  chave: ChaveParametroFixoCancer;
  valor: string;
}

// ─── Riscos — .scratch/qualidade-riscos-indicadores/issues/01-riscos-cadastro-matriz-origem.md ──
/**
 * `qa_riscos` não espelha o LIS (diferente de Ocorrências/Cortesias/IHQ/Câncer)
 * — é dado nativo do Supabase, sem distinção espelho × curadoria.
 */
export type OrigemRisco =
  | 'nao_conformidade'
  | 'ocorrencia'
  | 'auditoria'
  | 'indicador'
  | 'reclamacao'
  | 'analise_preventiva'
  | 'falha_equipamento'
  | 'mudanca_processo'
  | 'fornecedor_parceiro'
  | 'controle_qualidade'
  | 'outro';

/** Resolvido por `domain/riscosClassificacao.ts` a partir do score e das faixas configuráveis (`qa_parametros`) — nunca fixo no código. */
export type NivelClassificacaoRisco = 'baixo' | 'medio' | 'alto' | 'critico';

/** Uma faixa de `riscos.faixas_classificacao` (`qa_parametros`, módulo `riscos`) — configurável, não fixa no código. */
export interface FaixaClassificacaoRisco {
  min: number;
  max: number;
  nivel: NivelClassificacaoRisco;
}

export interface RiscoDTO {
  id: string;
  setorId: string;
  setorNome: string | null;
  processo: string;
  riscoIdentificado: string;
  causa: string | null;
  consequencia: string | null;
  controleExistente: string | null;
  origemRisco: OrigemRisco;
  ocorrenciaOrigemId: string | null;
  probabilidade: number | null;
  severidade: number | null;
  score: number | null;
  /** Resolvido no client de dados a partir do score + faixas configuradas — `null` enquanto P/S não forem informados. */
  nivel: NivelClassificacaoRisco | null;
  /** Aceitar/Monitorar/Reduzir/Eliminar/Transferir — `null` até a decisão de tratamento ser tomada (issue 02). */
  tratamento: TratamentoRisco | null;
  criadoPor: string;
  criadoEm: string;
}

export interface RiscoFiltro {
  setorId?: string;
  processo?: string;
  nivel?: NivelClassificacaoRisco;
  tratamento?: TratamentoRisco;
  /** Riscos com ao menos um plano de ação atribuído a este responsável. */
  responsavelId?: string;
  /** Filtra por `criadoEm` do risco. */
  inicio?: string;
  fim?: string;
}

export interface NovoRiscoInput {
  setorId: string;
  processo: string;
  riscoIdentificado: string;
  causa?: string | null;
  consequencia?: string | null;
  controleExistente?: string | null;
  origemRisco: OrigemRisco;
  ocorrenciaOrigemId?: string | null;
  probabilidade?: number | null;
  severidade?: number | null;
}

// ─── Riscos: gerenciamento — .scratch/qualidade-riscos-indicadores/issues/02-riscos-gerenciamento.md ──

export type TratamentoRisco = 'aceitar' | 'monitorar' | 'reduzir' | 'eliminar' | 'transferir';

export type StatusPlanoAcao = 'planejado' | 'em_andamento' | 'concluido';

/** Um anexo de evidência — `path` aponta para o bucket `qa-riscos-evidencias` (privado, lido via signed URL). */
export interface EvidenciaPlanoAcao {
  path: string;
  nome: string;
  tamanho: number;
}

/**
 * Reavaliação (risco residual) — histórico imutável, nunca sobrescreve
 * `qa_riscos.probabilidade`/`severidade` (risco inicial).
 */
export interface ReavaliacaoRiscoDTO {
  id: string;
  riscoId: string;
  probabilidade: number;
  severidade: number;
  score: number;
  observacao: string | null;
  reavaliadoPor: string;
  reavaliadoEm: string;
}

export interface NovaReavaliacaoInput {
  riscoId: string;
  probabilidade: number;
  severidade: number;
  observacao?: string | null;
}

/**
 * Um risco pode ter N planos de ação. Eficácia vive como colunas do próprio
 * plano (`eficaz`/`avaliadoEm`/`avaliadoPor`/`observacaoEficacia`) — sempre
 * 1:1 com este registro, não uma tabela à parte. `planoAnteriorId` encadeia
 * o próximo plano quando este foi marcado como não eficaz.
 */
export interface PlanoAcaoDTO {
  id: string;
  riscoId: string;
  acao: string;
  responsavelId: string;
  responsavelNome: string | null;
  dataPrevista: string | null;
  dataConclusao: string | null;
  status: StatusPlanoAcao;
  evidencias: EvidenciaPlanoAcao[];
  eficaz: boolean | null;
  avaliadoEm: string | null;
  avaliadoPor: string | null;
  observacaoEficacia: string | null;
  planoAnteriorId: string | null;
  criadoPor: string;
  criadoEm: string;
}

export interface NovoPlanoAcaoInput {
  riscoId: string;
  acao: string;
  responsavelId: string;
  dataPrevista?: string | null;
  status?: StatusPlanoAcao;
  /** Preenchido quando este plano nasce de um ciclo anterior marcado como não eficaz. */
  planoAnteriorId?: string | null;
}

export interface AtualizarPlanoAcaoInput {
  acao?: string;
  responsavelId?: string;
  dataPrevista?: string | null;
  dataConclusao?: string | null;
  status?: StatusPlanoAcao;
}

export interface AvaliarEficaciaPlanoAcaoInput {
  eficaz: boolean;
  observacaoEficacia?: string | null;
}

// ─── Riscos: contingência — .scratch/qualidade-riscos-indicadores/issues/03-riscos-contingencia.md ──
/**
 * Plano de contingência é independente de risco — `qa_planos_contingencia`
 * não tem FK para `qa_riscos` (requisito do cliente original: "são duas
 * coisas relacionadas, mas diferentes").
 */
export type StatusPlanoContingencia = 'ativo' | 'em_revisao' | 'inativo';

export type ResultadoTesteContingencia = 'aprovado' | 'aprovado_com_ressalvas' | 'reprovado';

/** Documento do plano — `path` aponta para o bucket `qa-contingencia-documentos` (privado, lido via signed URL). */
export interface DocumentoPlanoContingencia {
  path: string;
  nome: string;
  tamanho: number;
}

export interface PlanoContingenciaDTO {
  id: string;
  codigo: string;
  setorId: string;
  setorNome: string | null;
  evento: string;
  cenario: string;
  impactos: string | null;
  gatilhoAcionamento: string;
  acoesImediatas: string;
  responsaveis: string | null;
  comunicacao: string | null;
  materiais: string | null;
  fornecedorAlternativo: string | null;
  prazoMaximoInterrupcao: string | null;
  status: StatusPlanoContingencia;
  documento: DocumentoPlanoContingencia | null;
  criadoPor: string;
  criadoEm: string;
  atualizadoPor: string | null;
  atualizadoEm: string | null;
}

export interface PlanoContingenciaFiltro {
  setorId?: string;
}

export interface NovoPlanoContingenciaInput {
  codigo: string;
  setorId: string;
  evento: string;
  cenario: string;
  impactos?: string | null;
  gatilhoAcionamento: string;
  acoesImediatas: string;
  responsaveis?: string | null;
  comunicacao?: string | null;
  materiais?: string | null;
  fornecedorAlternativo?: string | null;
  prazoMaximoInterrupcao?: string | null;
  status?: StatusPlanoContingencia;
}

export interface AtualizarPlanoContingenciaInput {
  status?: StatusPlanoContingencia;
}

/**
 * Histórico de testes — nunca sobrescreve um teste anterior, cada teste é
 * uma linha nova em `qa_testes_contingencia` (imutável, sem UPDATE/DELETE).
 */
export interface TesteContingenciaDTO {
  id: string;
  planoId: string;
  dataTeste: string;
  resultado: ResultadoTesteContingencia;
  necessidadeMelhoria: boolean;
  descricaoMelhoria: string | null;
  proximaDataPrevista: string | null;
  observacoes: string | null;
  registradoPor: string;
  registradoEm: string;
}

export interface NovoTesteContingenciaInput {
  planoId: string;
  dataTeste: string;
  resultado: ResultadoTesteContingencia;
  necessidadeMelhoria: boolean;
  descricaoMelhoria?: string | null;
  proximaDataPrevista?: string | null;
  observacoes?: string | null;
}

// ─── Riscos: dashboard, mapa por setor e alertas — .scratch/qualidade-riscos-indicadores/issues/04-riscos-dashboard-mapa-alertas.md ──

export type TipoAlertaRisco = 'critico_sem_plano' | 'acao_vencida' | 'aguardando_reavaliacao' | 'contingencia_a_vencer';

/**
 * Um alerta calculado na leitura por `domain/riscosAlertas.ts` — não existe
 * motor de notificação (email/push) nem tabela própria, só os cards/consultas
 * do dashboard.
 */
export interface AlertaRiscoDTO {
  tipo: TipoAlertaRisco;
  riscoId: string | null;
  planoAcaoId: string | null;
  planoContingenciaId: string | null;
  mensagem: string;
}

export interface IndicadorRiscoPorNivel {
  nivel: NivelClassificacaoRisco;
  total: number;
}

export interface IndicadorRiscoPorSetor {
  setorId: string;
  setorNome: string;
  total: number;
}

export interface IndicadoresRiscosDTO {
  totalRiscos: number;
  porNivel: IndicadorRiscoPorNivel[];
  porSetor: IndicadorRiscoPorSetor[];
  planosAcaoPendentes: number;
  planosAcaoVencidos: number;
  aguardandoReavaliacao: number;
  contingenciasAtivas: number;
  alertas: AlertaRiscoDTO[];
}

/** Uma linha do mapa de riscos por setor (visão de auditoria): Processo | Risco | P | S | Nível | Status. */
export interface MapaRiscoLinhaDTO {
  riscoId: string;
  processo: string;
  riscoIdentificado: string;
  probabilidade: number | null;
  severidade: number | null;
  nivel: NivelClassificacaoRisco | null;
  tratamento: TratamentoRisco | null;
}

// ─── Riscos: correlação N:N com Ocorrências — .scratch/qualidade-riscos-indicadores/issues/05-riscos-correlacao-ocorrencias.md ──
/**
 * Mecanismo separado do vínculo de origem 1:N (`RiscoDTO.ocorrenciaOrigemId`,
 * imutável): aqui um usuário vincula/desvincula livremente, a qualquer
 * momento. `qa_riscos_ocorrencias` guarda só o vínculo N:N — a origem
 * continua vivendo em `qa_riscos.ocorrencia_origem_id`. `ehOrigem` é
 * calculado na leitura (`domain/riscosCorrelacao.ts`), mesclando os dois sem
 * duplicar quando o mesmo par risco/ocorrência é as duas coisas ao mesmo
 * tempo (ex.: nascido via "Gerar risco a partir desta ocorrência").
 */

/** Resumo mínimo de uma ocorrência — usado tanto na seção do risco quanto nos cards da aba Correlação. */
export interface OcorrenciaVinculoDTO {
  id: string;
  dtaOcorrencia: string;
  resumo: string;
}

/** Ocorrência vinculada a 1 risco (seção "Correlação" do detalhe do risco). */
export interface OcorrenciaVinculadaRiscoDTO extends OcorrenciaVinculoDTO {
  /** `null` quando o vínculo é só a origem 1:N (ainda sem linha em `qa_riscos_ocorrencias`) — nesse caso não há o que desvincular. */
  vinculoId: string | null;
  ehOrigem: boolean;
}

/** Risco vinculado a 1 ocorrência (seção "Riscos vinculados" do detalhe da ocorrência). */
export interface RiscoVinculadoOcorrenciaDTO {
  id: string;
  /** `null` quando o vínculo é só a origem 1:N (ainda sem linha em `qa_riscos_ocorrencias`) — nesse caso não há o que desvincular. */
  vinculoId: string | null;
  riscoIdentificado: string;
  processo: string;
  score: number | null;
  ehOrigem: boolean;
}

/** Um card da sub-aba Correlação — só riscos com ao menos 1 vínculo N:N entram aqui (origem sozinha não conta). */
export interface CardCorrelacaoRiscoDTO {
  riscoId: string;
  riscoIdentificado: string;
  processo: string;
  setorNome: string | null;
  ocorrencias: OcorrenciaVinculoDTO[];
}

/** Candidato retornado pela busca de ocorrências ao vincular a partir do detalhe de 1 risco. */
export interface OcorrenciaCandidataVinculoDTO {
  id: string;
  dtaOcorrencia: string;
  resumo: string;
  codRequisicao: string | null;
}

/** Candidato retornado pela busca de riscos ao vincular a partir do detalhe de 1 ocorrência. */
export interface RiscoCandidatoVinculoDTO {
  id: string;
  riscoIdentificado: string;
  processo: string;
}

// ─── Indicadores: Requisições — .scratch/qualidade-riscos-indicadores/issues/06-indicadores-requisicoes.md ──
// Módulo independente de Riscos — schema próprio (qa_requisicoes), sem FK
// para qa_riscos. "Não Conformidades por Setor" reaproveita o indicador já
// existente de Ocorrências (IndicadorOcorrenciasResposta.porSetor), por isso
// não tem uma linha própria de espelho aqui.

/** Derivada de `exame.CodExameTipo` do LIS pelo handler de sync — ver bdLabQualidade.ts. */
export type SecaoRequisicao = 'biologia_molecular' | 'patologia_ap' | 'histologia_citologia' | 'ihq_parceiro';

export type StatusCuradoriaRetificacao = 'pendente' | 'concluida';

export interface IndicadorPorSetor {
  setorId: string;
  setorNome: string;
  total: number;
}

export interface IndicadoresGeraisLaboratorioResposta {
  periodo: { inicio: string; fim: string };
  amostrasRecebidas: number;
  laudosLiberados: number;
  laudosLiberadosPorMedico: { medicoNome: string; total: number }[];
  amostrasAdmitidas: number;
  /** `null` quando nenhuma linha do período tem coleta e liberação preenchidas (R4 — nunca vira 0). */
  tatMedioDias: number | null;
  laudosForaDoPrazo: number;
  naoConformidadesPorSetor: IndicadorPorSetor[];
  laudosRetificados: number;
}

export interface IndicadorSecaoRequisicaoResposta {
  periodo: { inicio: string; fim: string };
  secao: SecaoRequisicao;
  totalRequisicoes: number;
  laudosLiberados: number;
  tatMedioDias: number | null;
  laudosForaDoPrazo: number;
}

/** TAT médio de 1 tipo de exame (ex.: `PCR`, `CAPTURA HÍBRIDA`) dentro da seção Biologia Molecular. */
export interface IndicadorTatPorTipoExame {
  exameTipoNomeLis: string;
  tatMedioDias: number;
  laudosLiberados: number;
}

/**
 * Biologia Molecular — issue 07: além das 4 métricas genéricas de
 * `IndicadorSecaoRequisicaoResposta`, quebra o TAT médio por
 * `exameTipoNomeLis` (PCR vs. Captura Híbrida). Tipo próprio em vez de
 * reaproveitar o genérico — ver issue 08 para o mesmo padrão nas outras seções.
 */
export interface IndicadorBiologiaMolecularResposta extends Omit<IndicadorSecaoRequisicaoResposta, 'secao'> {
  secao: 'biologia_molecular';
  /** Ordenado por `laudosLiberados` desc — tipos sem laudo liberado no período não aparecem. */
  tatPorTipoExame: IndicadorTatPorTipoExame[];
}

/**
 * Patologia/AP — issue 08: substitui os 4 KPIs genéricos de
 * `IndicadorSecaoRequisicaoResposta` (Requisições/Laudos liberados/TAT
 * médio/Fora do prazo) por métricas próprias da seção — não estende o tipo
 * genérico (diferente de `IndicadorBiologiaMolecularResposta`, que só
 * acrescenta).
 */
export interface IndicadorPatologiaApResposta {
  periodo: { inicio: string; fim: string };
  secao: 'patologia_ap';
  totalRequisicoes: number;
  /** Laudo liberado depois de `dta_prevista_setor` (prazo OPERACIONAL do setor) — não confundir com `laudosForaDoPrazo` de Indicadores Gerais (prazo ao cliente). */
  casosAtrasados: number;
  recorteColoracao: number;
  consensoPendente: number;
  /** Quase sempre 0 neste LIS (CodProblema=19 praticamente morto, ver migration 20260901130000) — dado real, não omitido. */
  blocosRefeitos: number;
}

/**
 * Histologia/Citologia — issue 09: substitui os 4 KPIs genéricos de
 * `IndicadorSecaoRequisicaoResposta` por métricas próprias da seção, mesmo
 * padrão de `IndicadorPatologiaApResposta`. "Microscopia Aguardando" foi
 * realocada de Patologia/AP para cá (ver migration 20260901140000: no LIS,
 * o evento é quase exclusivo de CITOPATOLOGIA). "Lâminas Inadequadas" e
 * "Amostras Insatisfatórias" ficaram de fora desta fase — decisão registrada
 * no cabeçalho da mesma migration (sinal quase inexistente no LIS).
 */
export interface IndicadorHistologiaCitologiaResposta {
  periodo: { inicio: string; fim: string };
  secao: 'histologia_citologia';
  totalRequisicoes: number;
  blocosProduzidos: number;
  laminasProduzidas: number;
  /** `null` quando faltar recebimento ou primeira lâmina pronta (R4 — nunca vira 0). */
  tatProcessamentoDias: number | null;
  microscopiaAguardando: number;
  amostrasNaoRecebidas: number;
  materialDevolvidoNaoConforme: number;
}

/** Item da lista de laudos retificados no período, pendentes ou não de curadoria de motivo. */
export interface RequisicaoRetificadaDTO {
  id: string;
  codRequisicao: string;
  dtaSolicitacao: string;
  dtaRetificacao: string | null;
  exameTipoNomeLis: string | null;
  /** PII (P10) — lido do LIS em lote sob demanda, nunca persistido em `qa_requisicoes`. */
  nomPaciente: string | null;
  patologistaNomeLis: string | null;
  motivoRetificacaoId: string | null;
  motivoRetificacaoNome: string | null;
  resumoRetificacaoCurado: string | null;
  statusCuradoria: StatusCuradoriaRetificacao;
  curadoPor: string | null;
  curadoEm: string | null;
}

export interface CuradoriaRetificacaoInput {
  motivoRetificacaoId?: string | null;
  resumoRetificacaoCurado?: string | null;
}

