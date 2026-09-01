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
  IndicadorSecaoRequisicaoResposta,
  RequisicaoRetificadaDTO,
  SecaoRequisicao,
  StatusCuradoriaRetificacao,
} from './types';
import { supabase } from '../../lib/supabase';
import { chamarQualidadeApi, ErroApiQualidade } from './qualidadeApi.js';
import { buscarIndicadoresOcorrencias } from './ocorrencias.js';
import { agregarIndicadoresGerais, type LinhaIndicadorRequisicao } from './domain/requisicoesIndicadores.js';
import { agregarBiologiaMolecular } from './domain/biologiaMolecularIndicadores.js';
import { agregarPatologiaAp } from './domain/patologiaIndicadores.js';
import { agregarHistologiaCitologia } from './domain/histologiaCitologiaIndicadores.js';
import { agregarIhqParceiro } from './domain/ihqParceiroIndicadores.js';

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

const AGREGADOR_POR_SECAO = {
  patologia_ap: agregarPatologiaAp,
  histologia_citologia: agregarHistologiaCitologia,
  ihq_parceiro: agregarIhqParceiro,
} as const;

export async function buscarIndicadoresSecaoRequisicao(
  secao: Exclude<SecaoRequisicao, 'biologia_molecular'>,
  periodo: { inicio: string; fim: string },
): Promise<IndicadorSecaoRequisicaoResposta> {
  const { data, error } = await supabase
    .from('qa_requisicoes')
    .select('dta_coleta, dta_prevista, dta_liberacao')
    .eq('secao_lis', secao)
    .gte('dta_solicitacao', periodo.inicio)
    .lte('dta_solicitacao', periodo.fim);
  if (error) throw new ErroApiQualidade(500, `Falha ao buscar indicadores da seção ${secao}: ${error.message}`);

  const linhas = (data ?? []).map((linha) => ({
    dtaColeta: linha.dta_coleta,
    dtaPrevista: linha.dta_prevista,
    dtaLiberacao: linha.dta_liberacao,
  }));

  return AGREGADOR_POR_SECAO[secao](periodo, linhas);
}

/**
 * Biologia Molecular tem resposta própria (issue 07): além das 4 métricas
 * genéricas, quebra o TAT médio por `exameTipoNomeLis` — por isso não passa
 * por `buscarIndicadoresSecaoRequisicao`/`AGREGADOR_POR_SECAO` acima, que
 * assumem o formato genérico de `IndicadorSecaoRequisicaoResposta`.
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

/** PII sob demanda (P10) — nunca persistida; buscada em lote via dispatcher, mesmo padrão de cortesias.ts. */
function buscarNomesPacientesRequisicoes(codigosRequisicao: string[]): Promise<Record<string, string>> {
  return chamarQualidadeApi<Record<string, string>>(
    'buscar-pii-requisicoes',
    { codigosRequisicao },
    'Falha ao buscar nomes de pacientes.',
  );
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
