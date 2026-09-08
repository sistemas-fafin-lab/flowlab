// Cliente de dados de Indicadores (Requisições) — supabase-js direto (RLS via
// `qualidade_usuario_tem_acesso()`/`current_user_has_permission`), mesmo
// padrão pós-openspec/spa-sem-backend-express de ocorrencias.ts: só
// sincronizar com o LIS passa pelo dispatcher serverless
// `/api/qualidade/[action]` (ver qualidadeApi.ts); leitura/curadoria são
// supabase-js puro. Módulo independente de Riscos — só toma emprestado
// `buscarIndicadoresOcorrencias` (porSetor) para "Não Conformidades por
// Setor", sem nenhuma outra dependência cruzada.

import type {
  CuradoriaRetificacaoInput,
  IndicadorBiologiaMolecularResposta,
  IndicadoresGeraisLaboratorioResposta,
  IndicadorHistologiaCitologiaResposta,
  IndicadorIhqParceiroResposta,
  IndicadorPatologiaApResposta,
  RequisicaoRetificadaDTO,
  SecaoRequisicao,
  StatusCuradoriaRetificacao,
} from './types';
import { supabase } from '../../lib/supabase';
import { chamarQualidadeApi, ErroApiQualidade } from './qualidadeApi.js';
import { buscarIndicadoresOcorrencias } from './ocorrencias.js';
import { agregarIndicadoresGerais, diasEntre, type LinhaIndicadorRequisicao } from './domain/requisicoesIndicadores.js';
import { agregarBiologiaMolecular } from './domain/biologiaMolecularIndicadores.js';
import { agregarPatologiaAp } from './domain/patologiaIndicadores.js';
import { agregarHistologiaCitologia } from './domain/histologiaCitologiaIndicadores.js';
import { agregarIhqParceiro, CODS_EXAME_IHQ_PARCEIRO, type LinhaIndicadorIhqParceiro } from './domain/ihqParceiroIndicadores.js';

export { ErroApiQualidade as ErroApi };

export interface ItemVocabularioRetificacao {
  id: string;
  nome: string;
}

export async function buscarMotivosRetificacao(): Promise<ItemVocabularioRetificacao[]> {
  const { data, error } = await supabase.from('qa_motivos_retificacao').select('id, nome').eq('ativo', true).order('nome');
  if (error) throw new ErroApiQualidade(500, `Falha ao listar motivos de retificação: ${error.message}`);
  return data ?? [];
}

export async function buscarIndicadoresGeraisLaboratorio(periodo: {
  inicio: string;
  fim: string;
}): Promise<IndicadoresGeraisLaboratorioResposta> {
  const { data, error } = await supabase
    .from('qa_requisicoes')
    .select('dta_coleta, dta_amostra_recebida, dta_admissao, dta_prevista, dta_liberacao, patologista_nome_lis, retificado')
    .gte('dta_solicitacao', periodo.inicio)
    .lte('dta_solicitacao', periodo.fim);
  if (error) throw new ErroApiQualidade(500, `Falha ao buscar indicadores gerais do laboratório: ${error.message}`);

  const linhas: LinhaIndicadorRequisicao[] = (data ?? []).map((linha) => ({
    dtaColeta: linha.dta_coleta,
    dtaAmostraRecebida: linha.dta_amostra_recebida,
    dtaAdmissao: linha.dta_admissao,
    dtaPrevista: linha.dta_prevista,
    dtaLiberacao: linha.dta_liberacao,
    patologistaNomeLis: linha.patologista_nome_lis,
    retificado: linha.retificado,
  }));

  const [gerais, indicadoresOcorrencias] = await Promise.all([
    Promise.resolve(agregarIndicadoresGerais(periodo, linhas)),
    buscarIndicadoresOcorrencias(periodo),
  ]);

  return { ...gerais, naoConformidadesPorSetor: indicadoresOcorrencias.porSetor };
}

/**
 * IHQ/Parceiro tem resposta própria (issue 10): tabela com 1 linha por tipo
 * de exame (`cod_exame IN (6,12,13)`, ver migration 20260901150000), não a
 * `secao_lis` inteira — filtra direto por `cod_exame` em vez de `secao_lis`
 * porque `secao_lis='ihq_parceiro'` também inclui `cod_exame_tipo_lis=3`
 * (fora do escopo desta tabela). Mesmo racional de
 * `buscarIndicadoresPatologiaAp`/`buscarIndicadoresHistologiaCitologia`.
 */
export async function buscarIndicadoresIhqParceiro(periodo: {
  inicio: string;
  fim: string;
}): Promise<IndicadorIhqParceiroResposta> {
  const { data, error } = await supabase
    .from('qa_requisicoes')
    .select('cod_exame, dta_prevista, dta_liberacao, dta_envio_parceiro, dta_retorno_laudo_fotos, dta_retorno_amostra_devolvida')
    .in('cod_exame', [...CODS_EXAME_IHQ_PARCEIRO])
    .gte('dta_solicitacao', periodo.inicio)
    .lte('dta_solicitacao', periodo.fim);
  if (error) throw new ErroApiQualidade(500, `Falha ao buscar indicadores de IHQ/Parceiro: ${error.message}`);

  const linhas: LinhaIndicadorIhqParceiro[] = (data ?? []).map((linha) => ({
    codExame: linha.cod_exame,
    dtaPrevista: linha.dta_prevista,
    dtaLiberacao: linha.dta_liberacao,
    dtaEnvioParceiro: linha.dta_envio_parceiro,
    dtaRetornoLaudoFotos: linha.dta_retorno_laudo_fotos,
    dtaRetornoAmostraDevolvida: linha.dta_retorno_amostra_devolvida,
  }));

  return agregarIhqParceiro(periodo, linhas);
}

/**
 * Biologia Molecular tem resposta própria (issue 07): além das 4 métricas
 * genéricas de `agregarIndicadorSecao` (domain/requisicoesIndicadores.ts),
 * quebra o TAT médio por `exameTipoNomeLis`.
 */
export async function buscarIndicadoresBiologiaMolecular(periodo: {
  inicio: string;
  fim: string;
}): Promise<IndicadorBiologiaMolecularResposta> {
  const { data, error } = await supabase
    .from('qa_requisicoes')
    .select('dta_coleta, dta_prevista, dta_liberacao, exame_tipo_nome_lis')
    .eq('secao_lis', 'biologia_molecular')
    .gte('dta_solicitacao', periodo.inicio)
    .lte('dta_solicitacao', periodo.fim);
  if (error) throw new ErroApiQualidade(500, `Falha ao buscar indicadores de Biologia Molecular: ${error.message}`);

  const linhas = (data ?? []).map((linha) => ({
    dtaColeta: linha.dta_coleta,
    dtaPrevista: linha.dta_prevista,
    dtaLiberacao: linha.dta_liberacao,
    exameTipoNomeLis: linha.exame_tipo_nome_lis,
  }));

  return agregarBiologiaMolecular(periodo, linhas);
}

/**
 * Patologia/AP tem resposta própria (issue 08): substitui as 4 métricas
 * genéricas de `agregarIndicadorSecao` por Casos Atrasados/Recorte-Coloração/
 * Consenso Pendente/Blocos Refeitos.
 */
export async function buscarIndicadoresPatologiaAp(periodo: {
  inicio: string;
  fim: string;
}): Promise<IndicadorPatologiaApResposta> {
  const { data, error } = await supabase
    .from('qa_requisicoes')
    .select('dta_prevista_setor, dta_liberacao, recorte_coloracao, consenso_pendente, bloco_danificado')
    .eq('secao_lis', 'patologia_ap')
    .gte('dta_solicitacao', periodo.inicio)
    .lte('dta_solicitacao', periodo.fim);
  if (error) throw new ErroApiQualidade(500, `Falha ao buscar indicadores de Patologia/AP: ${error.message}`);

  const linhas = (data ?? []).map((linha) => ({
    dtaPrevistaSetor: linha.dta_prevista_setor,
    dtaLiberacao: linha.dta_liberacao,
    recorteColoracao: linha.recorte_coloracao,
    consensoPendente: linha.consenso_pendente,
    blocoDanificado: linha.bloco_danificado,
  }));

  return agregarPatologiaAp(periodo, linhas);
}

/**
 * Histologia/Citologia tem resposta própria (issue 09): substitui as 4
 * métricas genéricas de `agregarIndicadorSecao` por Blocos/Lâminas
 * Produzidas, Tempo de Processamento, Microscopia Aguardando (realocada de
 * Patologia/AP), Amostras Não Recebidas e Material Devolvido Não Conforme.
 */
export async function buscarIndicadoresHistologiaCitologia(periodo: {
  inicio: string;
  fim: string;
}): Promise<IndicadorHistologiaCitologiaResposta> {
  const { data, error } = await supabase
    .from('qa_requisicoes')
    .select('dta_amostra_recebida, dta_primeira_lamina_pronta, num_blocos, num_laminas, dta_microscopia_aguardando, amostra_nao_recebida, material_devolvido_nao_conforme')
    .eq('secao_lis', 'histologia_citologia')
    .gte('dta_solicitacao', periodo.inicio)
    .lte('dta_solicitacao', periodo.fim);
  if (error) throw new ErroApiQualidade(500, `Falha ao buscar indicadores de Histologia/Citologia: ${error.message}`);

  const linhas = (data ?? []).map((linha) => ({
    dtaAmostraRecebida: linha.dta_amostra_recebida,
    dtaPrimeiraLaminaPronta: linha.dta_primeira_lamina_pronta,
    numBlocos: linha.num_blocos,
    numLaminas: linha.num_laminas,
    microscopiaAguardando: linha.dta_microscopia_aguardando !== null,
    amostraNaoRecebida: linha.amostra_nao_recebida,
    materialDevolvidoNaoConforme: linha.material_devolvido_nao_conforme,
  }));

  return agregarHistologiaCitologia(periodo, linhas);
}

const SELECT_RETIFICACAO =
  'id, cod_requisicao, dta_solicitacao, dta_retificacao, exame_tipo_nome_lis, patologista_nome_lis, motivo_retificacao_id, ' +
  'resumo_retificacao_curado, status_curadoria, curado_por, curado_em, ' +
  'motivo:qa_motivos_retificacao(nome)';

interface LinhaBrutaRetificacao {
  id: string;
  cod_requisicao: string;
  dta_solicitacao: string;
  dta_retificacao: string | null;
  exame_tipo_nome_lis: string | null;
  patologista_nome_lis: string | null;
  motivo_retificacao_id: string | null;
  resumo_retificacao_curado: string | null;
  status_curadoria: string | null;
  curado_por: string | null;
  curado_em: string | null;
  motivo: { nome: string } | null;
}

/** `status_curadoria` só é preenchido pela curadoria — enquanto ninguém curou, a linha é "pendente" (nunca `null` no DTO). */
function statusCuradoriaOuPendente(bruto: string | null): StatusCuradoriaRetificacao {
  return bruto === 'concluida' ? 'concluida' : 'pendente';
}

function mapearRetificacaoParaDTO(linha: LinhaBrutaRetificacao, nomPaciente: string | null): RequisicaoRetificadaDTO {
  return {
    id: linha.id,
    codRequisicao: linha.cod_requisicao,
    dtaSolicitacao: linha.dta_solicitacao,
    dtaRetificacao: linha.dta_retificacao,
    exameTipoNomeLis: linha.exame_tipo_nome_lis,
    nomPaciente,
    patologistaNomeLis: linha.patologista_nome_lis,
    motivoRetificacaoId: linha.motivo_retificacao_id,
    motivoRetificacaoNome: linha.motivo?.nome ?? null,
    resumoRetificacaoCurado: linha.resumo_retificacao_curado,
    statusCuradoria: statusCuradoriaOuPendente(linha.status_curadoria),
    curadoPor: linha.curado_por,
    curadoEm: linha.curado_em,
  };
}

/** Espelha `MAX_CODIGOS` em `api/_lib/handlers/qualidade-buscar-pii-requisicoes.ts` — acima disso o handler recusa a chamada inteira (400). */
const MAX_CODIGOS_POR_CHAMADA_PII = 500;

/**
 * PII sob demanda (P10) — nunca persistida; buscada em lote via dispatcher,
 * mesmo padrão de cortesias.ts. Faz mais de uma chamada quando a lista passa
 * de `MAX_CODIGOS_POR_CHAMADA_PII` (achado ao vivo: listas de indicador como
 * "Laudos liberados" facilmente passam de 500 requisições no período) — sem
 * isso, o handler rejeitava a chamada inteira e todo mundo ficava sem nome.
 */
async function buscarNomesPacientesRequisicoes(codigosRequisicao: string[]): Promise<Record<string, string>> {
  const codigosUnicos = [...new Set(codigosRequisicao)];
  const nomes: Record<string, string> = {};
  for (let i = 0; i < codigosUnicos.length; i += MAX_CODIGOS_POR_CHAMADA_PII) {
    const lote = codigosUnicos.slice(i, i + MAX_CODIGOS_POR_CHAMADA_PII);
    const resultado = await chamarQualidadeApi<Record<string, string>>(
      'buscar-pii-requisicoes',
      { codigosRequisicao: lote },
      'Falha ao buscar nomes de pacientes.',
    );
    Object.assign(nomes, resultado);
  }
  return nomes;
}

// ─── Itens individuais por trás de um KPI de Indicadores (drill-down em modal) ──

/**
 * Uma chave por KPI clicável da aba Indicadores — espelha exatamente as
 * condições já usadas pelos agregadores em domain/*Indicadores.ts (nunca
 * reimplementadas aqui, só a mesma leitura aplicada linha a linha em vez de
 * contada). "Laudos retificados" (Indicadores Gerais) fica de fora de
 * propósito — já tem lista própria (`buscarRequisicoesRetificadas`) com
 * tabela e drawer de curadoria, não precisa deste modal genérico.
 */
export type ChaveIndicador =
  | 'geral_laudos_liberados'
  | 'geral_fora_prazo'
  | 'biomol_laudos_liberados'
  | 'biomol_fora_prazo'
  | 'pat_casos_atrasados'
  | 'pat_recorte_coloracao'
  | 'pat_consenso_pendente'
  | 'pat_blocos_refeitos'
  | 'hist_microscopia_aguardando'
  | 'hist_amostra_nao_recebida'
  | 'hist_material_devolvido';

export interface ItemIndicadorRequisicaoDTO {
  id: string;
  codRequisicao: string;
  nomPaciente: string | null;
  exameTipoNomeLis: string | null;
  /** Rótulo da coluna `data` abaixo — varia por indicador (ex: "Liberado em", "Aguardando desde"). */
  rotuloData: string;
  data: string | null;
  /** Só preenchido nos indicadores de atraso (diferença entre o prazo e `data`). */
  diasAtraso: number | null;
}

interface ConfigItemIndicador {
  secaoLis?: SecaoRequisicao;
  /** Coluna (snake_case) com a data mostrada na linha. */
  colunaData: string;
  rotuloData: string;
  /** Quando setado, filtra `.eq(colunaFlag, true)` no servidor. Ausente = filtra `colunaData IS NOT NULL`. */
  colunaFlag?: string;
  /** Quando setado, o indicador é "atraso": exige `colunaPrazoParaAtraso` e `colunaData` preenchidos e `diasEntre(prazo, data) > 0` — mesma condição dos agregadores. */
  colunaPrazoParaAtraso?: string;
}

const CONFIG_ITEM_INDICADOR: Record<ChaveIndicador, ConfigItemIndicador> = {
  geral_laudos_liberados: { colunaData: 'dta_liberacao', rotuloData: 'Liberado em' },
  geral_fora_prazo: { colunaData: 'dta_liberacao', rotuloData: 'Liberado em', colunaPrazoParaAtraso: 'dta_prevista' },
  biomol_laudos_liberados: { secaoLis: 'biologia_molecular', colunaData: 'dta_liberacao', rotuloData: 'Liberado em' },
  biomol_fora_prazo: {
    secaoLis: 'biologia_molecular',
    colunaData: 'dta_liberacao',
    rotuloData: 'Liberado em',
    colunaPrazoParaAtraso: 'dta_prevista',
  },
  pat_casos_atrasados: {
    secaoLis: 'patologia_ap',
    colunaData: 'dta_liberacao',
    rotuloData: 'Liberado em',
    colunaPrazoParaAtraso: 'dta_prevista_setor',
  },
  pat_recorte_coloracao: {
    secaoLis: 'patologia_ap',
    colunaData: 'dta_recorte_coloracao',
    rotuloData: 'Recorte/coloração em',
    colunaFlag: 'recorte_coloracao',
  },
  pat_consenso_pendente: {
    secaoLis: 'patologia_ap',
    colunaData: 'dta_consenso_criado',
    rotuloData: 'Consenso criado em',
    colunaFlag: 'consenso_pendente',
  },
  pat_blocos_refeitos: {
    secaoLis: 'patologia_ap',
    colunaData: 'dta_bloco_danificado',
    rotuloData: 'Registrado em',
    colunaFlag: 'bloco_danificado',
  },
  hist_microscopia_aguardando: {
    secaoLis: 'histologia_citologia',
    colunaData: 'dta_microscopia_aguardando',
    rotuloData: 'Aguardando desde',
  },
  hist_amostra_nao_recebida: {
    secaoLis: 'histologia_citologia',
    colunaData: 'dta_amostra_nao_recebida',
    rotuloData: 'Registrado em',
    colunaFlag: 'amostra_nao_recebida',
  },
  hist_material_devolvido: {
    secaoLis: 'histologia_citologia',
    colunaData: 'dta_material_devolvido',
    rotuloData: 'Devolvido em',
    colunaFlag: 'material_devolvido_nao_conforme',
  },
};

interface LinhaBrutaItemIndicador {
  id: string;
  cod_requisicao: string;
  exame_tipo_nome_lis: string | null;
  [coluna: string]: unknown;
}

/**
 * Item a item por trás de um KPI da aba Indicadores — mesma condição do
 * agregador correspondente (ver `CONFIG_ITEM_INDICADOR`), só aplicada linha a
 * linha em vez de contada. Nome de paciente é enriquecimento sob demanda
 * (P10), mesmo padrão de `buscarRequisicoesRetificadas` — nunca bloqueia a
 * lista se o LIS estiver indisponível.
 */
export async function buscarItensIndicador(
  chave: ChaveIndicador,
  periodo: { inicio: string; fim: string },
): Promise<ItemIndicadorRequisicaoDTO[]> {
  const config = CONFIG_ITEM_INDICADOR[chave];
  const colunas = new Set(['id', 'cod_requisicao', 'exame_tipo_nome_lis', config.colunaData]);
  if (config.colunaPrazoParaAtraso) colunas.add(config.colunaPrazoParaAtraso);
  const selectColunas = [...colunas].join(', ');

  function construirQuery() {
    let query = supabase
      .from('qa_requisicoes')
      .select(selectColunas)
      .gte('dta_solicitacao', periodo.inicio)
      .lte('dta_solicitacao', periodo.fim);
    if (config.secaoLis) query = query.eq('secao_lis', config.secaoLis);
    if (config.colunaFlag) query = query.eq(config.colunaFlag, true);
    else query = query.not(config.colunaData, 'is', null);
    if (config.colunaPrazoParaAtraso) query = query.not(config.colunaPrazoParaAtraso, 'is', null);
    return query.order('dta_solicitacao', { ascending: false });
  }

  // PostgREST devolve no máximo 1000 linhas por chamada por padrão — sem
  // paginar, um período com mais de 1000 requisições cortava linhas
  // legítimas do meio da lista (achado ao vivo: "Fora do prazo" contava 1 no
  // KPI mas o modal vinha vazio, porque a única linha que batia a condição
  // ficava fora das primeiras 1000 retornadas pela ordenação). Cada página
  // exige uma nova instância do query builder — reaproveitar a mesma
  // instância com `.range()` em loop não refaz os filtros.
  const TAMANHO_PAGINA = 1000;
  let linhas: LinhaBrutaItemIndicador[] = [];
  for (let offset = 0; ; offset += TAMANHO_PAGINA) {
    const { data, error } = await construirQuery().range(offset, offset + TAMANHO_PAGINA - 1);
    if (error) throw new ErroApiQualidade(500, `Falha ao buscar itens do indicador: ${error.message}`);
    const pagina = (data ?? []) as unknown as LinhaBrutaItemIndicador[];
    linhas = linhas.concat(pagina);
    if (pagina.length < TAMANHO_PAGINA) break;
  }

  if (config.colunaPrazoParaAtraso) {
    const colunaPrazo = config.colunaPrazoParaAtraso;
    linhas = linhas.filter((l) => {
      const prazo = l[colunaPrazo] as string | null;
      const dataVal = l[config.colunaData] as string | null;
      return prazo !== null && dataVal !== null && diasEntre(prazo, dataVal) > 0;
    });
  }

  let nomes: Record<string, string> = {};
  try {
    nomes = await buscarNomesPacientesRequisicoes(linhas.map((l) => l.cod_requisicao));
  } catch {
    // Nome de paciente é enriquecimento (PII sob demanda) — não bloqueia a lista se o LIS estiver indisponível.
  }

  return linhas.map((l) => {
    const dataVal = l[config.colunaData] as string | null;
    const prazo = config.colunaPrazoParaAtraso ? (l[config.colunaPrazoParaAtraso] as string | null) : null;
    return {
      id: l.id,
      codRequisicao: l.cod_requisicao,
      nomPaciente: nomes[l.cod_requisicao] ?? null,
      exameTipoNomeLis: l.exame_tipo_nome_lis,
      rotuloData: config.rotuloData,
      data: dataVal,
      diasAtraso: prazo && dataVal ? diasEntre(prazo, dataVal) : null,
    };
  });
}

export async function buscarRequisicoesRetificadas(periodo: {
  inicio: string;
  fim: string;
}): Promise<RequisicaoRetificadaDTO[]> {
  const { data, error } = await supabase
    .from('qa_requisicoes')
    .select(SELECT_RETIFICACAO)
    .eq('retificado', true)
    .gte('dta_solicitacao', periodo.inicio)
    .lte('dta_solicitacao', periodo.fim)
    .order('dta_solicitacao', { ascending: false });
  if (error) throw new ErroApiQualidade(500, `Falha ao listar laudos retificados: ${error.message}`);

  const linhas = (data ?? []) as unknown as LinhaBrutaRetificacao[];

  let nomes: Record<string, string> = {};
  try {
    nomes = await buscarNomesPacientesRequisicoes(linhas.map((l) => l.cod_requisicao));
  } catch {
    // Nome de paciente é enriquecimento (PII sob demanda) — não bloqueia a lista se o LIS estiver indisponível.
  }

  return linhas.map((linha) => mapearRetificacaoParaDTO(linha, nomes[linha.cod_requisicao] ?? null));
}

/**
 * `nomPacienteConhecido` — quando o chamador já tem o nome (ex.: a linha
 * clicada na tabela de retificados já veio de `buscarRequisicoesRetificadas`,
 * que fez a mesma busca em lote) evita repetir a chamada de PII sob demanda
 * (nova conexão ao LIS) só para reobter um dado que já está em mãos.
 */
export async function buscarRequisicaoRetificada(id: string, nomPacienteConhecido?: string | null): Promise<RequisicaoRetificadaDTO> {
  const { data, error } = await supabase.from('qa_requisicoes').select(SELECT_RETIFICACAO).eq('id', id).maybeSingle();
  if (error) throw new ErroApiQualidade(500, `Falha ao buscar laudo retificado ${id}: ${error.message}`);
  if (!data) throw new ErroApiQualidade(404, 'Laudo retificado não encontrado');

  const linha = data as unknown as LinhaBrutaRetificacao;
  let nomPaciente = nomPacienteConhecido ?? null;
  if (nomPacienteConhecido === undefined) {
    try {
      const nomes = await buscarNomesPacientesRequisicoes([linha.cod_requisicao]);
      nomPaciente = nomes[linha.cod_requisicao] ?? null;
    } catch {
      // idem — enriquecimento, não bloqueia o detalhe.
    }
  }

  return mapearRetificacaoParaDTO(linha, nomPaciente);
}

/**
 * Curadoria é um `update` direto — RLS protege a escrita; `curado_por`/
 * `curado_em` sempre preenchidos com o usuário e o momento atual (mesma
 * regra de salvarCuradoriaOcorrencia). Auditoria é gravada pelo trigger de
 * qa_requisicoes, não aqui.
 */
export async function salvarCuradoriaRetificacao(id: string, input: CuradoriaRetificacaoInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ErroApiQualidade(401, 'Sessão expirada. Faça login novamente.');

  const agora = new Date().toISOString();
  const colunas = {
    motivo_retificacao_id: input.motivoRetificacaoId ?? null,
    resumo_retificacao_curado: input.resumoRetificacaoCurado ?? null,
    status_curadoria: 'concluida',
    curado_por: user.id,
    curado_em: agora,
  };

  const { error } = await supabase.from('qa_requisicoes').update(colunas).eq('id', id);
  if (error) throw new ErroApiQualidade(error.code === '42501' ? 403 : 500, `Falha ao salvar curadoria: ${error.message}`);
}

export function sincronizarRequisicoes(periodo: { inicio: string; fim: string }): Promise<void> {
  return chamarQualidadeApi('sync-requisicoes', periodo, 'Falha ao sincronizar Requisições.');
}
