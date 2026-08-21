// Cliente de dados de Ocorrências — AJUSTADO em 2026-08-19
// (openspec/changes/spa-sem-backend-express): não fala mais com
// apps/backend/Express via apiFetch — worklist, vocabulário, curadoria e
// indicadores são supabase-js DIRETO (RLS via `qualidade_usuario_tem_acesso()`,
// department = 'Qualidade'); só sincronizar com o LIS passa pelo dispatcher
// serverless `/api/qualidade/[action]` (ver qualidadeApi.ts). Assinaturas
// exportadas continuam as mesmas de antes — nenhuma página/componente
// precisou mudar.
//
// Porta apps/backend/src/modules/ocorrencias/{worklist,vocabulario,curadoria,indicadores}.ts,
// que já eram supabase-js puro (com a service role, do lado do servidor) —
// a mudança real é: cliente anon (supabaseClient.ts) em vez de service role,
// e `autor` vem de `supabase.auth.getUser()` em vez de `req.usuario`. O
// `auditoria.registrar()` explícito de curadoria.ts foi removido: o trigger
// Postgres de qa_ocorrencias (ver a migration deste piloto) grava a
// auditoria automaticamente a partir de agora — nenhuma escrita direta em
// `qa_auditoria` do lado do cliente.

import type { CuradoriaOcorrenciaInput, IndicadorOcorrenciasResposta, OcorrenciaDTO, OcorrenciaFiltro } from './types';
import { supabase } from '../../lib/supabase';
import { chamarQualidadeApi, ErroApiQualidade } from './qualidadeApi.js';
import { agregarOcorrencias, type LinhaIndicadorOcorrencia } from './domain/ocorrenciasIndicadores.js';

export { ErroApiQualidade as ErroApi };

export interface ItemVocabularioOcorrencia {
  id: string;
  nome: string;
}

async function listarVocabulario(
  tabela: 'qa_colaboradores' | 'qa_setores' | 'qa_motivos_ocorrencia',
): Promise<ItemVocabularioOcorrencia[]> {
  const { data, error } = await supabase.from(tabela).select('id, nome').eq('ativo', true).order('nome');
  if (error) throw new ErroApiQualidade(500, `Falha ao listar ${tabela}: ${error.message}`);
  return data ?? [];
}

export function buscarColaboradoresOcorrencia(): Promise<ItemVocabularioOcorrencia[]> {
  return listarVocabulario('qa_colaboradores');
}

export function buscarSetoresOcorrencia(): Promise<ItemVocabularioOcorrencia[]> {
  return listarVocabulario('qa_setores');
}

export function buscarMotivosOcorrencia(): Promise<ItemVocabularioOcorrencia[]> {
  return listarVocabulario('qa_motivos_ocorrencia');
}

const SELECT_OCORRENCIA =
  'id, id_ocorrencia_lis, num_cod, dta_ocorrencia, cod_requisicao, descricao_lis, acao_imediata_lis, ' +
  'cau_descricao_lis, categoria_origem_lis, categoria_origem_generica, colaborador_id, setor_erro_id, ' +
  'motivo_id, resumo_curado, acao_curada, status_curadoria, revisao_pendente, curado_por, curado_em, ' +
  'colaborador:qa_colaboradores(nome), setor:qa_setores(nome), motivo:qa_motivos_ocorrencia(nome)';

interface LinhaBrutaOcorrencia {
  id: string;
  id_ocorrencia_lis: number;
  num_cod: number | null;
  dta_ocorrencia: string;
  cod_requisicao: string | null;
  descricao_lis: string | null;
  acao_imediata_lis: string | null;
  cau_descricao_lis: string | null;
  categoria_origem_lis: string | null;
  categoria_origem_generica: boolean;
  colaborador_id: string | null;
  setor_erro_id: string | null;
  motivo_id: string | null;
  resumo_curado: string | null;
  acao_curada: string | null;
  status_curadoria: OcorrenciaDTO['statusCuradoria'];
  revisao_pendente: boolean;
  curado_por: string | null;
  curado_em: string | null;
  colaborador: { nome: string } | null;
  setor: { nome: string } | null;
  motivo: { nome: string } | null;
}

/** Colaborador/Setor/Motivo são puramente selecionáveis pelo usuário — sem sugestão automática. */
function mapearParaDTO(linha: LinhaBrutaOcorrencia): OcorrenciaDTO {
  return {
    id: linha.id,
    dtaOcorrencia: linha.dta_ocorrencia,
    numCod: linha.num_cod,
    codRequisicao: linha.cod_requisicao,
    descricaoLis: linha.descricao_lis,
    acaoImediataLis: linha.acao_imediata_lis,
    cauDescricaoLis: linha.cau_descricao_lis,
    categoriaOrigemDescricao: linha.categoria_origem_lis,
    categoriaOrigemGenerica: linha.categoria_origem_generica,
    colaboradorId: linha.colaborador_id,
    colaboradorNome: linha.colaborador?.nome ?? null,
    setorErroId: linha.setor_erro_id,
    setorErroNome: linha.setor?.nome ?? null,
    motivoId: linha.motivo_id,
    motivoNome: linha.motivo?.nome ?? null,
    resumoCurado: linha.resumo_curado,
    acaoCurada: linha.acao_curada,
    statusCuradoria: linha.status_curadoria,
    revisaoPendente: linha.revisao_pendente,
    curadoPor: linha.curado_por,
    curadoEm: linha.curado_em,
  };
}

export async function buscarOcorrencias(filtro: OcorrenciaFiltro): Promise<OcorrenciaDTO[]> {
  let query = supabase
    .from('qa_ocorrencias')
    .select(SELECT_OCORRENCIA)
    .gte('dta_ocorrencia', filtro.inicio)
    .lte('dta_ocorrencia', filtro.fim)
    .order('dta_ocorrencia', { ascending: false });

  if (filtro.setorErroId) query = query.eq('setor_erro_id', filtro.setorErroId);
  if (filtro.motivoId) query = query.eq('motivo_id', filtro.motivoId);
  if (filtro.colaboradorId) query = query.eq('colaborador_id', filtro.colaboradorId);
  if (filtro.status) query = query.eq('status_curadoria', filtro.status);

  const { data, error } = await query;
  if (error) throw new ErroApiQualidade(500, `Falha ao listar ocorrências: ${error.message}`);

  return ((data ?? []) as unknown as LinhaBrutaOcorrencia[]).map(mapearParaDTO);
}

export async function buscarOcorrencia(id: string): Promise<OcorrenciaDTO> {
  const { data, error } = await supabase.from('qa_ocorrencias').select(SELECT_OCORRENCIA).eq('id', id).maybeSingle();
  if (error) throw new ErroApiQualidade(500, `Falha ao buscar ocorrência ${id}: ${error.message}`);
  if (!data) throw new ErroApiQualidade(404, 'Ocorrência não encontrada');
  return mapearParaDTO(data as unknown as LinhaBrutaOcorrencia);
}

/**
 * Curadoria é um `update` direto — RLS (`qualidade_usuario_tem_acesso()`)
 * protege a escrita; `curado_por`/`curado_em` são sempre preenchidos com o
 * usuário e o momento atual (curar sempre marca "quem" e "quando",
 * independente de quais campos foram preenchidos — mesma regra de
 * curadoria.ts original). Auditoria (P7) é gravada pelo trigger de
 * qa_ocorrencias, não aqui.
 */
export async function salvarCuradoriaOcorrencia(id: string, input: CuradoriaOcorrenciaInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ErroApiQualidade(401, 'Sessão expirada. Faça login novamente.');

  const agora = new Date().toISOString();
  const colunas: Record<string, unknown> = {
    colaborador_id: input.colaboradorId ?? null,
    setor_erro_id: input.setorErroId ?? null,
    motivo_id: input.motivoId ?? null,
    resumo_curado: input.resumoCurado ?? null,
    acao_curada: input.acaoCurada ?? null,
    curado_por: user.id,
    curado_em: agora,
  };
  if (input.colaboradorId) {
    colunas.colaborador_confirmado_por = user.id;
    colunas.colaborador_confirmado_em = agora;
  }

  const { error } = await supabase.from('qa_ocorrencias').update(colunas).eq('id', id);
  if (error) throw new ErroApiQualidade(error.code === '42501' ? 403 : 500, `Falha ao salvar curadoria: ${error.message}`);
}

export async function buscarIndicadoresOcorrencias(periodo: {
  inicio: string;
  fim: string;
}): Promise<IndicadorOcorrenciasResposta> {
  const { data, error } = await supabase
    .from('qa_ocorrencias')
    .select(
      'dta_ocorrencia, status_curadoria, motivo_id, setor_erro_id, colaborador_id, ' +
        'motivo:qa_motivos_ocorrencia(nome), setor:qa_setores(nome), colaborador:qa_colaboradores(nome)',
    )
    .gte('dta_ocorrencia', periodo.inicio)
    .lte('dta_ocorrencia', periodo.fim);

  if (error) throw new ErroApiQualidade(500, `Falha ao buscar indicadores de ocorrências: ${error.message}`);

  const linhas: LinhaIndicadorOcorrencia[] = (data ?? []).map((linha) => {
    const bruta = linha as unknown as {
      dta_ocorrencia: string;
      status_curadoria: string;
      motivo_id: string | null;
      setor_erro_id: string | null;
      colaborador_id: string | null;
      motivo: { nome: string } | null;
      setor: { nome: string } | null;
      colaborador: { nome: string } | null;
    };
    return {
      dtaOcorrencia: bruta.dta_ocorrencia,
      statusCuradoria: bruta.status_curadoria,
      motivoId: bruta.motivo_id,
      motivoNome: bruta.motivo?.nome ?? null,
      setorErroId: bruta.setor_erro_id,
      setorErroNome: bruta.setor?.nome ?? null,
      colaboradorId: bruta.colaborador_id,
      colaboradorNome: bruta.colaborador?.nome ?? null,
    };
  });

  return agregarOcorrencias(periodo, linhas);
}

export function sincronizarOcorrencias(periodo: { inicio: string; fim: string }): Promise<void> {
  return chamarQualidadeApi('sync-ocorrencias', periodo, 'Falha ao sincronizar Ocorrências.');
}
