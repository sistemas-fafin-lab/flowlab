// Cliente de dados da aba Contingências — .scratch/qualidade-riscos-indicadores/issues/03-riscos-contingencia.md.
// Assim como riscos.ts, `qa_planos_contingencia`/`qa_testes_contingencia` não
// espelham o LIS: dado nativo do Supabase, supabase-js direto do cliente,
// protegido por RLS. Plano de contingência é independente de risco — sem FK
// para `qa_riscos`.

import { supabase } from '../../lib/supabase';
import { ErroApiQualidade } from './qualidadeApi.js';
import type {
  AtualizarPlanoContingenciaInput,
  DocumentoPlanoContingencia,
  NovoPlanoContingenciaInput,
  NovoTesteContingenciaInput,
  PlanoContingenciaDTO,
  PlanoContingenciaFiltro,
  StatusPlanoContingencia,
  TesteContingenciaDTO,
} from './types';

export { ErroApiQualidade as ErroApi };
export { buscarSetoresOcorrencia as buscarSetoresContingencia } from './ocorrencias.js';

// ─── qa_planos_contingencia ─────────────────────────────────────────────────

const SELECT_PLANO_CONTINGENCIA =
  'id, codigo, setor_id, evento, cenario, impactos, gatilho_acionamento, acoes_imediatas, responsaveis, ' +
  'comunicacao, materiais, fornecedor_alternativo, prazo_maximo_interrupcao, status, documento, ' +
  'criado_por, criado_em, atualizado_por, atualizado_em, setor:qa_setores(nome)';

interface LinhaBrutaPlanoContingencia {
  id: string;
  codigo: string;
  setor_id: string;
  evento: string;
  cenario: string;
  impactos: string | null;
  gatilho_acionamento: string;
  acoes_imediatas: string;
  responsaveis: string | null;
  comunicacao: string | null;
  materiais: string | null;
  fornecedor_alternativo: string | null;
  prazo_maximo_interrupcao: string | null;
  status: StatusPlanoContingencia;
  documento: DocumentoPlanoContingencia | null;
  criado_por: string;
  criado_em: string;
  atualizado_por: string | null;
  atualizado_em: string | null;
  setor: { nome: string } | null;
}

function mapearPlanoContingencia(linha: LinhaBrutaPlanoContingencia): PlanoContingenciaDTO {
  return {
    id: linha.id,
    codigo: linha.codigo,
    setorId: linha.setor_id,
    setorNome: linha.setor?.nome ?? null,
    evento: linha.evento,
    cenario: linha.cenario,
    impactos: linha.impactos,
    gatilhoAcionamento: linha.gatilho_acionamento,
    acoesImediatas: linha.acoes_imediatas,
    responsaveis: linha.responsaveis,
    comunicacao: linha.comunicacao,
    materiais: linha.materiais,
    fornecedorAlternativo: linha.fornecedor_alternativo,
    prazoMaximoInterrupcao: linha.prazo_maximo_interrupcao,
    status: linha.status,
    documento: linha.documento,
    criadoPor: linha.criado_por,
    criadoEm: linha.criado_em,
    atualizadoPor: linha.atualizado_por,
    atualizadoEm: linha.atualizado_em,
  };
}

export async function listarPlanosContingencia(filtro: PlanoContingenciaFiltro = {}): Promise<PlanoContingenciaDTO[]> {
  let query = supabase.from('qa_planos_contingencia').select(SELECT_PLANO_CONTINGENCIA).order('criado_em', { ascending: false });
  if (filtro.setorId) query = query.eq('setor_id', filtro.setorId);

  const { data, error } = await query;
  if (error) throw new ErroApiQualidade(500, `Falha ao listar planos de contingência: ${error.message}`);

  return ((data ?? []) as unknown as LinhaBrutaPlanoContingencia[]).map(mapearPlanoContingencia);
}

export async function criarPlanoContingencia(input: NovoPlanoContingenciaInput): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ErroApiQualidade(401, 'Sessão expirada. Faça login novamente.');

  const { data, error } = await supabase
    .from('qa_planos_contingencia')
    .insert({
      codigo: input.codigo,
      setor_id: input.setorId,
      evento: input.evento,
      cenario: input.cenario,
      impactos: input.impactos ?? null,
      gatilho_acionamento: input.gatilhoAcionamento,
      acoes_imediatas: input.acoesImediatas,
      responsaveis: input.responsaveis ?? null,
      comunicacao: input.comunicacao ?? null,
      materiais: input.materiais ?? null,
      fornecedor_alternativo: input.fornecedorAlternativo ?? null,
      prazo_maximo_interrupcao: input.prazoMaximoInterrupcao ?? null,
      status: input.status ?? 'ativo',
      criado_por: user.id,
    })
    .select('id')
    .single();
  if (error)
    throw new ErroApiQualidade(error.code === '42501' ? 403 : 500, `Falha ao cadastrar plano de contingência: ${error.message}`);

  return data.id as string;
}

export async function buscarPlanoContingencia(id: string): Promise<PlanoContingenciaDTO> {
  const { data, error } = await supabase.from('qa_planos_contingencia').select(SELECT_PLANO_CONTINGENCIA).eq('id', id).single();
  if (error)
    throw new ErroApiQualidade(error.code === 'PGRST116' ? 404 : 500, `Falha ao buscar plano de contingência: ${error.message}`);

  return mapearPlanoContingencia(data as unknown as LinhaBrutaPlanoContingencia);
}

export async function atualizarPlanoContingencia(id: string, input: AtualizarPlanoContingenciaInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ErroApiQualidade(401, 'Sessão expirada. Faça login novamente.');

  const colunas: Record<string, unknown> = { atualizado_por: user.id, atualizado_em: new Date().toISOString() };
  if (input.status !== undefined) colunas.status = input.status;

  const { error } = await supabase.from('qa_planos_contingencia').update(colunas).eq('id', id);
  if (error)
    throw new ErroApiQualidade(error.code === '42501' ? 403 : 500, `Falha ao atualizar plano de contingência: ${error.message}`);
}

const BUCKET_DOCUMENTOS = 'qa-contingencia-documentos';

export async function anexarDocumentoPlanoContingencia(planoId: string, arquivo: File): Promise<void> {
  const path = `${planoId}/${Date.now()}-${arquivo.name}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET_DOCUMENTOS).upload(path, arquivo);
  if (uploadError) throw new ErroApiQualidade(500, `Falha ao subir documento: ${uploadError.message}`);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ErroApiQualidade(401, 'Sessão expirada. Faça login novamente.');

  const documento: DocumentoPlanoContingencia = { path, nome: arquivo.name, tamanho: arquivo.size };
  const { error: updateError } = await supabase
    .from('qa_planos_contingencia')
    .update({ documento, atualizado_por: user.id, atualizado_em: new Date().toISOString() })
    .eq('id', planoId);
  if (updateError) throw new ErroApiQualidade(500, `Falha ao registrar documento: ${updateError.message}`);
}

/** Signed URL de curta duração — o bucket é privado, sem leitura pública. */
export async function buscarUrlDocumentoContingencia(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET_DOCUMENTOS).createSignedUrl(path, 300);
  if (error || !data) throw new ErroApiQualidade(500, `Falha ao gerar link do documento: ${error?.message ?? 'sem URL'}`);
  return data.signedUrl;
}

// ─── qa_testes_contingencia — histórico de testes ──────────────────────────

const SELECT_TESTE_CONTINGENCIA =
  'id, plano_id, data_teste, resultado, necessidade_melhoria, descricao_melhoria, proxima_data_prevista, ' +
  'observacoes, registrado_por, registrado_em';

interface LinhaBrutaTesteContingencia {
  id: string;
  plano_id: string;
  data_teste: string;
  resultado: TesteContingenciaDTO['resultado'];
  necessidade_melhoria: boolean;
  descricao_melhoria: string | null;
  proxima_data_prevista: string | null;
  observacoes: string | null;
  registrado_por: string;
  registrado_em: string;
}

function mapearTesteContingencia(linha: LinhaBrutaTesteContingencia): TesteContingenciaDTO {
  return {
    id: linha.id,
    planoId: linha.plano_id,
    dataTeste: linha.data_teste,
    resultado: linha.resultado,
    necessidadeMelhoria: linha.necessidade_melhoria,
    descricaoMelhoria: linha.descricao_melhoria,
    proximaDataPrevista: linha.proxima_data_prevista,
    observacoes: linha.observacoes,
    registradoPor: linha.registrado_por,
    registradoEm: linha.registrado_em,
  };
}

export async function listarTestesContingencia(planoId: string): Promise<TesteContingenciaDTO[]> {
  const { data, error } = await supabase
    .from('qa_testes_contingencia')
    .select(SELECT_TESTE_CONTINGENCIA)
    .eq('plano_id', planoId)
    .order('data_teste', { ascending: false });
  if (error) throw new ErroApiQualidade(500, `Falha ao listar testes: ${error.message}`);

  return ((data ?? []) as unknown as LinhaBrutaTesteContingencia[]).map(mapearTesteContingencia);
}

/** Uma query para todos os planos, em vez de N — usado pelo dashboard de Riscos (issue 04) para resolver "último teste" de cada plano de contingência. */
export async function listarTestesContingenciaPorPlanos(planoIds: readonly string[]): Promise<Map<string, TesteContingenciaDTO[]>> {
  const mapa = new Map<string, TesteContingenciaDTO[]>();
  if (planoIds.length === 0) return mapa;

  const { data, error } = await supabase.from('qa_testes_contingencia').select(SELECT_TESTE_CONTINGENCIA).in('plano_id', planoIds);
  if (error) throw new ErroApiQualidade(500, `Falha ao listar testes: ${error.message}`);

  for (const linha of (data ?? []) as unknown as LinhaBrutaTesteContingencia[]) {
    const teste = mapearTesteContingencia(linha);
    const lista = mapa.get(teste.planoId) ?? [];
    lista.push(teste);
    mapa.set(teste.planoId, lista);
  }
  return mapa;
}

export async function criarTesteContingencia(input: NovoTesteContingenciaInput): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ErroApiQualidade(401, 'Sessão expirada. Faça login novamente.');

  const { data, error } = await supabase
    .from('qa_testes_contingencia')
    .insert({
      plano_id: input.planoId,
      data_teste: input.dataTeste,
      resultado: input.resultado,
      necessidade_melhoria: input.necessidadeMelhoria,
      descricao_melhoria: input.descricaoMelhoria ?? null,
      proxima_data_prevista: input.proximaDataPrevista ?? null,
      observacoes: input.observacoes ?? null,
      registrado_por: user.id,
    })
    .select('id')
    .single();
  if (error) throw new ErroApiQualidade(error.code === '42501' ? 403 : 500, `Falha ao registrar teste: ${error.message}`);

  return data.id as string;
}
