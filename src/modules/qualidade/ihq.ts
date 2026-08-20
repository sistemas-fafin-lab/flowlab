// Cliente de dados de IHQ — AJUSTADO em 2026-08-19
// (openspec/changes/spa-sem-backend-express, D6): não fala mais com
// apps/backend/Express via apiFetch. Worklist/curadoria/indicadores são
// supabase-js DIRETO; sync, PII sob demanda e confirmação de vínculo (que
// precisa recomputar `candidatas` a partir do LIS antes de validar/gravar)
// passam pelo dispatcher serverless `/api/qualidade/[action]`. Assinaturas
// exportadas continuam as mesmas.
//
// Porta apps/backend/src/modules/ihq/{worklist,curadoria,indicadores}.ts.
// `vinculo.ts` (confirmarVinculo) NÃO vira supabase-js direto como em
// Ocorrências/Cortesias — precisa validar a candidata escolhida contra o LIS
// (design.md D3 da Etapa 5, `candidatas` nunca persistida), então fica
// inteiramente no dispatcher (`confirmar-vinculo-ihq`), com service role.

import type { ConfirmarVinculoInput, CuradoriaIhqInput, IhqDTO, IhqFiltro, IndicadorIhqResposta } from './types';
import { supabase } from '../../lib/supabase';
import { chamarQualidadeApi, ErroApiQualidade } from './qualidadeApi.js';
import { agregarIhq, type LinhaIndicadorIhq } from './domain/ihqIndicadores.js';

export { ErroApiQualidade as ErroApi };

const SELECT_IHQ =
  'id, cod_requisicao_ihq, id_tarefa_bloco, dta_admissao, dta_solicitacao_bloco, medico_solicitante, status_lis, ' +
  'cod_requisicao_original, vinculo_proveniencia, vinculo_confianca, material_lis, patologista_lis, ' +
  'dta_envio_bloco, dta_envio_proveniencia, dta_envio_texto_original, dta_retorno_bloco, bloco_retornou, ' +
  'lamina_enviada, observacoes, status_curadoria, revisao_pendente, curado_por, curado_em';

interface LinhaBrutaIhq {
  id: string;
  cod_requisicao_ihq: string;
  id_tarefa_bloco: number | null;
  dta_admissao: string | null;
  dta_solicitacao_bloco: string | null;
  medico_solicitante: string | null;
  status_lis: IhqDTO['statusLis'];
  cod_requisicao_original: string | null;
  vinculo_proveniencia: IhqDTO['vinculoProveniencia'];
  vinculo_confianca: IhqDTO['vinculoConfianca'];
  material_lis: string | null;
  patologista_lis: string | null;
  dta_envio_bloco: string | null;
  dta_envio_proveniencia: IhqDTO['dtaEnvioProveniencia'];
  dta_envio_texto_original: string | null;
  dta_retorno_bloco: string | null;
  bloco_retornou: boolean | null;
  lamina_enviada: boolean | null;
  observacoes: string | null;
  status_curadoria: IhqDTO['statusCuradoria'];
  revisao_pendente: boolean;
  curado_por: string | null;
  curado_em: string | null;
}

function mapearParaDTO(
  linha: LinhaBrutaIhq,
  candidatas: IhqDTO['candidatas'] = null,
  nomePacienteLis: string | null = null,
): IhqDTO {
  return {
    id: linha.id,
    codRequisicaoIhq: linha.cod_requisicao_ihq,
    nomePacienteLis,
    idTarefaBloco: linha.id_tarefa_bloco,
    dtaAdmissao: linha.dta_admissao,
    dtaSolicitacaoBloco: linha.dta_solicitacao_bloco,
    medicoSolicitante: linha.medico_solicitante,
    statusLis: linha.status_lis,
    codRequisicaoOriginal: linha.cod_requisicao_original,
    vinculoProveniencia: linha.vinculo_proveniencia,
    vinculoConfianca: linha.vinculo_confianca,
    materialLis: linha.material_lis,
    patologistaLis: linha.patologista_lis,
    candidatas,
    dtaEnvioBloco: linha.dta_envio_bloco,
    dtaEnvioProveniencia: linha.dta_envio_proveniencia,
    dtaEnvioTextoOriginal: linha.dta_envio_texto_original,
    dtaRetornoBloco: linha.dta_retorno_bloco,
    blocoRetornou: linha.bloco_retornou,
    laminaEnviada: linha.lamina_enviada,
    observacoes: linha.observacoes,
    statusCuradoria: linha.status_curadoria,
    revisaoPendente: linha.revisao_pendente,
    curadoPor: linha.curado_por,
    curadoEm: linha.curado_em,
  };
}

/**
 * `nomePacienteLis` nunca é persistido (P10) — buscado em lote via
 * dispatcher, casado em memória por `codRequisicaoIhq|idTarefaBloco` (a
 * mesma requisição pode gerar duas linhas — R2). `candidatas` nunca vem
 * preenchida na listagem (custaria uma consulta ao LIS por linha) — só
 * `buscarIhqItem` traz a lista fresca.
 */
export async function buscarIhqLista(filtro: IhqFiltro): Promise<IhqDTO[]> {
  let query = supabase
    .from('qa_ihq_solicitacoes')
    .select(SELECT_IHQ)
    .gte('dta_admissao', filtro.inicio)
    .lte('dta_admissao', filtro.fim)
    .order('dta_admissao', { ascending: false });

  if (filtro.vinculoConfianca) query = query.eq('vinculo_confianca', filtro.vinculoConfianca);
  if (filtro.status) query = query.eq('status_curadoria', filtro.status);
  if (filtro.vinculoAConfirmar) {
    query = query.in('vinculo_confianca', ['baixa', 'nenhuma']).eq('vinculo_proveniencia', 'heuristica');
  }

  const { data, error } = await query;
  if (error) throw new ErroApiQualidade(500, `Falha ao listar solicitações de IHQ: ${error.message}`);

  const linhas = (data ?? []) as unknown as LinhaBrutaIhq[];
  if (linhas.length === 0) return [];

  let nomes: Record<string, string> = {};
  try {
    nomes = await chamarQualidadeApi<Record<string, string>>(
      'buscar-pii-ihq',
      { inicio: filtro.inicio, fim: filtro.fim },
      'Falha ao buscar nomes de pacientes.',
    );
  } catch {
    // Nome de paciente é enriquecimento — não bloqueia a worklist.
  }

  return linhas.map((linha) =>
    mapearParaDTO(linha, null, nomes[`${linha.cod_requisicao_ihq}|${linha.id_tarefa_bloco ?? ''}`] ?? null),
  );
}

interface DetalheIhqResposta {
  nomePacienteLis: string | null;
  candidatas: IhqDTO['candidatas'];
}

/**
 * `candidatas` nunca é persistida — recalculada sob demanda, consultando o
 * LIS de novo para o mesmo dia de admissão (design.md D3 da Etapa 5).
 */
export async function buscarIhqItem(id: string): Promise<IhqDTO> {
  const { data, error } = await supabase.from('qa_ihq_solicitacoes').select(SELECT_IHQ).eq('id', id).maybeSingle();
  if (error) throw new ErroApiQualidade(500, `Falha ao buscar solicitação de IHQ ${id}: ${error.message}`);
  if (!data) throw new ErroApiQualidade(404, 'Solicitação de IHQ não encontrada');

  const linha = data as unknown as LinhaBrutaIhq;
  if (!linha.dta_admissao) return mapearParaDTO(linha, []);

  try {
    const detalhe = await chamarQualidadeApi<DetalheIhqResposta>(
      'buscar-detalhe-ihq',
      { id, dtaAdmissao: linha.dta_admissao, codRequisicaoIhq: linha.cod_requisicao_ihq, idTarefaBloco: linha.id_tarefa_bloco },
      'Falha ao buscar detalhe de IHQ.',
    );
    return mapearParaDTO(linha, detalhe.candidatas, detalhe.nomePacienteLis);
  } catch {
    return mapearParaDTO(linha, []);
  }
}

/** Confirmação de vínculo precisa validar a candidata contra o LIS — sempre server-side (ver cabeçalho). */
export function confirmarVinculoIhq(id: string, input: ConfirmarVinculoInput): Promise<void> {
  return chamarQualidadeApi('confirmar-vinculo-ihq', { id, ...input }, 'Falha ao confirmar vínculo.');
}

/**
 * Curadoria (R7 — lâmina enviada, observações, sem origem estrutural) —
 * `update` direto, RLS protege a escrita. Corrigir `dtaEnvioBlocoCorrigida`
 * muda `dta_envio_proveniencia` para `'curadoria'`, congelando o campo
 * contra qualquer sync futuro (mesma regra de curadoria.ts original).
 */
export async function salvarCuradoriaIhq(id: string, input: CuradoriaIhqInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ErroApiQualidade(401, 'Sessão expirada. Faça login novamente.');

  const colunas: Record<string, unknown> = {
    lamina_enviada: input.laminaEnviada ?? null,
    observacoes: input.observacoes ?? null,
    status_curadoria: input.status,
    curado_por: user.id,
    curado_em: new Date().toISOString(),
  };
  if (input.dtaEnvioBlocoCorrigida) {
    colunas.dta_envio_bloco = input.dtaEnvioBlocoCorrigida;
    colunas.dta_envio_proveniencia = 'curadoria';
  }

  const { error } = await supabase.from('qa_ihq_solicitacoes').update(colunas).eq('id', id);
  if (error) throw new ErroApiQualidade(error.code === '42501' ? 403 : 500, `Falha ao salvar curadoria: ${error.message}`);
}

export async function buscarIndicadoresIhq(periodo: {
  inicio: string;
  fim: string;
  dataReferencia: string;
}): Promise<IndicadorIhqResposta> {
  const { data, error } = await supabase
    .from('qa_ihq_solicitacoes')
    .select('cod_requisicao_ihq, dta_solicitacao_bloco, dta_envio_bloco, dta_retorno_bloco')
    .gte('dta_admissao', periodo.inicio)
    .lte('dta_admissao', periodo.fim);
  if (error) throw new ErroApiQualidade(500, `Falha ao buscar indicadores de IHQ: ${error.message}`);

  const linhas: LinhaIndicadorIhq[] = (
    (data ?? []) as {
      cod_requisicao_ihq: string;
      dta_solicitacao_bloco: string | null;
      dta_envio_bloco: string | null;
      dta_retorno_bloco: string | null;
    }[]
  ).map((linha) => ({
    codRequisicaoIhq: linha.cod_requisicao_ihq,
    dtaSolicitacaoBloco: linha.dta_solicitacao_bloco,
    dtaEnvioBloco: linha.dta_envio_bloco,
    dtaRetornoBloco: linha.dta_retorno_bloco,
  }));

  // tatAlertaDias é lido pelo dispatcher em sync; aqui, para indicadores
  // client-side, também precisa do parâmetro — lido diretamente do Supabase
  // (leitura pública de app_parametros, mesma RLS de qualidade_usuario_tem_acesso()).
  const { data: parametro } = await supabase
    .from('app_parametros')
    .select('valor')
    .eq('modulo', 'ihq')
    .eq('chave', 'ihq.tat_alerta_dias')
    .maybeSingle();
  const tatAlertaDias = Number((parametro as { valor: unknown } | null)?.valor ?? 5);

  return agregarIhq(periodo, periodo.dataReferencia, linhas, tatAlertaDias);
}

export function sincronizarIhq(periodo: { inicio: string; fim: string }): Promise<void> {
  return chamarQualidadeApi('sync-ihq', periodo, 'Falha ao sincronizar IHQ.');
}
