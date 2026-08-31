// Cliente de dados da aba Riscos — .scratch/qualidade-riscos-indicadores/issues/01-riscos-cadastro-matriz-origem.md.
// Diferente de ocorrencias.ts/cortesias.ts/ihq.ts/cancer.ts, `qa_riscos` não
// espelha o LIS: é dado nativo do Supabase, supabase-js direto do cliente,
// protegido por RLS (`current_user_has_permission('canViewQualidade' |
// 'canManageQualidade')`) — sem handler serverless de sync.

import { supabase } from '../../lib/supabase';
import { ErroApiQualidade } from './qualidadeApi.js';
import { resolverFaixasClassificacao, classificarScore } from './domain/riscosClassificacao.js';
import type {
  AtualizarPlanoAcaoInput,
  AvaliarEficaciaPlanoAcaoInput,
  EvidenciaPlanoAcao,
  FaixaClassificacaoRisco,
  NovaReavaliacaoInput,
  NovoPlanoAcaoInput,
  NovoRiscoInput,
  PlanoAcaoDTO,
  ReavaliacaoRiscoDTO,
  RiscoDTO,
  RiscoFiltro,
  StatusPlanoAcao,
  TratamentoRisco,
} from './types';
import type { ItemCombobox } from './components/ui/ComboboxBusca.js';

export { ErroApiQualidade as ErroApi };
export { buscarSetoresOcorrencia as buscarSetoresRisco } from './ocorrencias.js';

// ─── Parâmetros configuráveis ───────────────────────────────────────────────

async function buscarValorParametro(chave: string): Promise<unknown> {
  const { data, error } = await supabase.from('qa_parametros').select('valor').eq('chave', chave).maybeSingle();
  if (error) throw new ErroApiQualidade(500, `Falha ao carregar parâmetro "${chave}": ${error.message}`);
  return data?.valor ?? null;
}

export async function buscarFaixasClassificacao(): Promise<readonly FaixaClassificacaoRisco[]> {
  return resolverFaixasClassificacao(await buscarValorParametro('riscos.faixas_classificacao'));
}

export async function buscarProcessosSugeridos(setorId: string): Promise<string[]> {
  const { data, error } = await supabase.from('qa_riscos').select('processo').eq('setor_id', setorId);
  if (error) throw new ErroApiQualidade(500, `Falha ao buscar processos: ${error.message}`);
  return [...new Set((data ?? []).map((l) => l.processo as string))].sort();
}

// ─── qa_riscos ──────────────────────────────────────────────────────────────

const SELECT_RISCO =
  'id, setor_id, processo, risco_identificado, causa, consequencia, controle_existente, ' +
  'origem_risco, ocorrencia_origem_id, probabilidade, severidade, score, tratamento, criado_por, criado_em, ' +
  'setor:qa_setores(nome)';

interface LinhaBrutaRisco {
  id: string;
  setor_id: string;
  processo: string;
  risco_identificado: string;
  causa: string | null;
  consequencia: string | null;
  controle_existente: string | null;
  origem_risco: RiscoDTO['origemRisco'];
  ocorrencia_origem_id: string | null;
  probabilidade: number | null;
  severidade: number | null;
  score: number | null;
  tratamento: TratamentoRisco | null;
  criado_por: string;
  criado_em: string;
  setor: { nome: string } | null;
}

function mapearRisco(linha: LinhaBrutaRisco, faixas: readonly FaixaClassificacaoRisco[]): RiscoDTO {
  return {
    id: linha.id,
    setorId: linha.setor_id,
    setorNome: linha.setor?.nome ?? null,
    processo: linha.processo,
    riscoIdentificado: linha.risco_identificado,
    causa: linha.causa,
    consequencia: linha.consequencia,
    controleExistente: linha.controle_existente,
    origemRisco: linha.origem_risco,
    ocorrenciaOrigemId: linha.ocorrencia_origem_id,
    probabilidade: linha.probabilidade,
    severidade: linha.severidade,
    score: linha.score,
    nivel: classificarScore(linha.score, faixas),
    tratamento: linha.tratamento,
    criadoPor: linha.criado_por,
    criadoEm: linha.criado_em,
  };
}

export async function listarRiscos(filtro: RiscoFiltro = {}): Promise<RiscoDTO[]> {
  let query = supabase.from('qa_riscos').select(SELECT_RISCO).order('criado_em', { ascending: false });
  if (filtro.setorId) query = query.eq('setor_id', filtro.setorId);

  const [faixas, { data, error }] = await Promise.all([buscarFaixasClassificacao(), query]);
  if (error) throw new ErroApiQualidade(500, `Falha ao listar riscos: ${error.message}`);

  return ((data ?? []) as unknown as LinhaBrutaRisco[]).map((l) => mapearRisco(l, faixas));
}

export async function criarRisco(input: NovoRiscoInput): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ErroApiQualidade(401, 'Sessão expirada. Faça login novamente.');

  const { data, error } = await supabase
    .from('qa_riscos')
    .insert({
      setor_id: input.setorId,
      processo: input.processo,
      risco_identificado: input.riscoIdentificado,
      causa: input.causa ?? null,
      consequencia: input.consequencia ?? null,
      controle_existente: input.controleExistente ?? null,
      origem_risco: input.origemRisco,
      ocorrencia_origem_id: input.ocorrenciaOrigemId ?? null,
      probabilidade: input.probabilidade ?? null,
      severidade: input.severidade ?? null,
      criado_por: user.id,
    })
    .select('id')
    .single();
  if (error) throw new ErroApiQualidade(error.code === '42501' ? 403 : 500, `Falha ao cadastrar risco: ${error.message}`);

  return data.id as string;
}

export async function buscarRisco(id: string): Promise<RiscoDTO> {
  const [faixas, { data, error }] = await Promise.all([
    buscarFaixasClassificacao(),
    supabase.from('qa_riscos').select(SELECT_RISCO).eq('id', id).single(),
  ]);
  if (error) throw new ErroApiQualidade(error.code === 'PGRST116' ? 404 : 500, `Falha ao buscar risco: ${error.message}`);

  return mapearRisco(data as unknown as LinhaBrutaRisco, faixas);
}

export async function atualizarTratamentoRisco(riscoId: string, tratamento: TratamentoRisco): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ErroApiQualidade(401, 'Sessão expirada. Faça login novamente.');

  const { error } = await supabase
    .from('qa_riscos')
    .update({ tratamento, tratamento_atualizado_por: user.id, tratamento_atualizado_em: new Date().toISOString() })
    .eq('id', riscoId);
  if (error) throw new ErroApiQualidade(error.code === '42501' ? 403 : 500, `Falha ao salvar tratamento: ${error.message}`);
}

/**
 * Responsáveis elegíveis para um plano de ação — todo usuário do FlowLab,
 * sem filtro por cargo/board (diferente de useBoardUsers, que restringe a
 * quem tem `custom_roles.board_id`): não há um recorte equivalente para
 * Qualidade, e `user_profiles` já é de leitura livre para `authenticated`.
 */
export async function buscarResponsaveisPlanoAcao(): Promise<ItemCombobox[]> {
  const { data, error } = await supabase.from('user_profiles').select('id, name').order('name');
  if (error) throw new ErroApiQualidade(500, `Falha ao buscar responsáveis: ${error.message}`);
  return (data ?? []).map((u) => ({ id: u.id as string, nome: u.name as string }));
}

// ─── qa_reavaliacoes_risco — histórico de risco residual ───────────────────

const SELECT_REAVALIACAO = 'id, risco_id, probabilidade, severidade, score, observacao, reavaliado_por, reavaliado_em';

interface LinhaBrutaReavaliacao {
  id: string;
  risco_id: string;
  probabilidade: number;
  severidade: number;
  score: number;
  observacao: string | null;
  reavaliado_por: string;
  reavaliado_em: string;
}

function mapearReavaliacao(linha: LinhaBrutaReavaliacao): ReavaliacaoRiscoDTO {
  return {
    id: linha.id,
    riscoId: linha.risco_id,
    probabilidade: linha.probabilidade,
    severidade: linha.severidade,
    score: linha.score,
    observacao: linha.observacao,
    reavaliadoPor: linha.reavaliado_por,
    reavaliadoEm: linha.reavaliado_em,
  };
}

export async function listarReavaliacoesRisco(riscoId: string): Promise<ReavaliacaoRiscoDTO[]> {
  const { data, error } = await supabase
    .from('qa_reavaliacoes_risco')
    .select(SELECT_REAVALIACAO)
    .eq('risco_id', riscoId)
    .order('reavaliado_em', { ascending: false });
  if (error) throw new ErroApiQualidade(500, `Falha ao listar reavaliações: ${error.message}`);

  return ((data ?? []) as unknown as LinhaBrutaReavaliacao[]).map(mapearReavaliacao);
}

export async function criarReavaliacaoRisco(input: NovaReavaliacaoInput): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ErroApiQualidade(401, 'Sessão expirada. Faça login novamente.');

  const { data, error } = await supabase
    .from('qa_reavaliacoes_risco')
    .insert({
      risco_id: input.riscoId,
      probabilidade: input.probabilidade,
      severidade: input.severidade,
      observacao: input.observacao ?? null,
      reavaliado_por: user.id,
    })
    .select('id')
    .single();
  if (error) throw new ErroApiQualidade(error.code === '42501' ? 403 : 500, `Falha ao registrar reavaliação: ${error.message}`);

  return data.id as string;
}

// ─── qa_planos_acao — plano(s) de ação + eficácia ──────────────────────────

const SELECT_PLANO_ACAO =
  'id, risco_id, acao, responsavel_id, data_prevista, data_conclusao, status, evidencias, eficaz, ' +
  'avaliado_em, avaliado_por, observacao_eficacia, plano_anterior_id, criado_por, criado_em, ' +
  'responsavel:user_profiles!qa_planos_acao_responsavel_id_fkey(name)';

interface LinhaBrutaPlanoAcao {
  id: string;
  risco_id: string;
  acao: string;
  responsavel_id: string;
  data_prevista: string | null;
  data_conclusao: string | null;
  status: StatusPlanoAcao;
  evidencias: EvidenciaPlanoAcao[];
  eficaz: boolean | null;
  avaliado_em: string | null;
  avaliado_por: string | null;
  observacao_eficacia: string | null;
  plano_anterior_id: string | null;
  criado_por: string;
  criado_em: string;
  responsavel: { name: string } | null;
}

function mapearPlanoAcao(linha: LinhaBrutaPlanoAcao): PlanoAcaoDTO {
  return {
    id: linha.id,
    riscoId: linha.risco_id,
    acao: linha.acao,
    responsavelId: linha.responsavel_id,
    responsavelNome: linha.responsavel?.name ?? null,
    dataPrevista: linha.data_prevista,
    dataConclusao: linha.data_conclusao,
    status: linha.status,
    evidencias: linha.evidencias ?? [],
    eficaz: linha.eficaz,
    avaliadoEm: linha.avaliado_em,
    avaliadoPor: linha.avaliado_por,
    observacaoEficacia: linha.observacao_eficacia,
    planoAnteriorId: linha.plano_anterior_id,
    criadoPor: linha.criado_por,
    criadoEm: linha.criado_em,
  };
}

export async function listarPlanosAcao(riscoId: string): Promise<PlanoAcaoDTO[]> {
  const { data, error } = await supabase
    .from('qa_planos_acao')
    .select(SELECT_PLANO_ACAO)
    .eq('risco_id', riscoId)
    .order('criado_em', { ascending: true });
  if (error) throw new ErroApiQualidade(500, `Falha ao listar planos de ação: ${error.message}`);

  return ((data ?? []) as unknown as LinhaBrutaPlanoAcao[]).map(mapearPlanoAcao);
}

export async function criarPlanoAcao(input: NovoPlanoAcaoInput): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ErroApiQualidade(401, 'Sessão expirada. Faça login novamente.');

  const { data, error } = await supabase
    .from('qa_planos_acao')
    .insert({
      risco_id: input.riscoId,
      acao: input.acao,
      responsavel_id: input.responsavelId,
      data_prevista: input.dataPrevista ?? null,
      status: input.status ?? 'planejado',
      plano_anterior_id: input.planoAnteriorId ?? null,
      criado_por: user.id,
    })
    .select('id')
    .single();
  if (error) throw new ErroApiQualidade(error.code === '42501' ? 403 : 500, `Falha ao criar plano de ação: ${error.message}`);

  return data.id as string;
}

export async function atualizarPlanoAcao(id: string, input: AtualizarPlanoAcaoInput): Promise<void> {
  const colunas: Record<string, unknown> = {};
  if (input.acao !== undefined) colunas.acao = input.acao;
  if (input.responsavelId !== undefined) colunas.responsavel_id = input.responsavelId;
  if (input.dataPrevista !== undefined) colunas.data_prevista = input.dataPrevista;
  if (input.dataConclusao !== undefined) colunas.data_conclusao = input.dataConclusao;
  if (input.status !== undefined) colunas.status = input.status;

  const { error } = await supabase.from('qa_planos_acao').update(colunas).eq('id', id);
  if (error) throw new ErroApiQualidade(error.code === '42501' ? 403 : 500, `Falha ao atualizar plano de ação: ${error.message}`);
}

export async function avaliarEficaciaPlanoAcao(id: string, input: AvaliarEficaciaPlanoAcaoInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ErroApiQualidade(401, 'Sessão expirada. Faça login novamente.');

  const { error } = await supabase
    .from('qa_planos_acao')
    .update({
      eficaz: input.eficaz,
      observacao_eficacia: input.observacaoEficacia ?? null,
      avaliado_por: user.id,
      avaliado_em: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw new ErroApiQualidade(error.code === '42501' ? 403 : 500, `Falha ao avaliar eficácia: ${error.message}`);
}

const BUCKET_EVIDENCIAS = 'qa-riscos-evidencias';

export async function anexarEvidenciaPlanoAcao(planoId: string, arquivo: File): Promise<void> {
  const path = `${planoId}/${Date.now()}-${arquivo.name}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET_EVIDENCIAS).upload(path, arquivo);
  if (uploadError) throw new ErroApiQualidade(500, `Falha ao subir evidência: ${uploadError.message}`);

  const { data: planoAtual, error: leituraError } = await supabase
    .from('qa_planos_acao')
    .select('evidencias')
    .eq('id', planoId)
    .single();
  if (leituraError) throw new ErroApiQualidade(500, `Falha ao registrar evidência: ${leituraError.message}`);

  const evidencias: EvidenciaPlanoAcao[] = [
    ...((planoAtual?.evidencias as EvidenciaPlanoAcao[] | null) ?? []),
    { path, nome: arquivo.name, tamanho: arquivo.size },
  ];

  const { error: updateError } = await supabase.from('qa_planos_acao').update({ evidencias }).eq('id', planoId);
  if (updateError) throw new ErroApiQualidade(500, `Falha ao registrar evidência: ${updateError.message}`);
}

/** Signed URL de curta duração — o bucket é privado, sem leitura pública. */
export async function buscarUrlEvidencia(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET_EVIDENCIAS).createSignedUrl(path, 300);
  if (error || !data) throw new ErroApiQualidade(500, `Falha ao gerar link da evidência: ${error?.message ?? 'sem URL'}`);
  return data.signedUrl;
}
