// Cliente de dados de Cortesias — AJUSTADO em 2026-08-19
// (openspec/changes/spa-sem-backend-express, D6): não fala mais com
// apps/backend/Express via apiFetch. Worklist/vocabulário/curadoria/
// indicadores/cotas/notificações são supabase-js DIRETO (RLS via
// `qualidade_usuario_tem_acesso()`); só sincronizar com o LIS e buscar o
// nome do paciente (PII, P10 — nunca persistido em `qa_cortesias`) passam
// pelo dispatcher serverless `/api/qualidade/[action]`. Assinaturas
// exportadas continuam as mesmas — nenhuma página/componente mudou.
//
// Porta apps/backend/src/modules/cortesias/{worklist,vocabulario,curadoria,
// indicadores,cotas,notificacoes}.ts. Diferença de Ocorrências: aqui a
// PROTEÇÃO de P6 é `status_curadoria !== 'pendente'` (não `curado_por !=
// null`) — Cortesias nunca teve a simplificação binária que Ocorrências
// teve; ver qaCortesiasRepo.ts original.

import type {
  CortesiaDTO,
  CortesiaFiltro,
  CotaCortesiaDTO,
  CotaCortesiaInput,
  CuradoriaCortesiaInput,
  IndicadorCortesiasResposta,
  NotificacaoCortesiaDTO,
  RecortePeriodoCortesia,
} from './types';
import { supabase } from '../../lib/supabase';
import { chamarQualidadeApi, ErroApiQualidade } from './qualidadeApi.js';
import { agregarCortesias, type LinhaIndicadorCortesia } from './domain/cortesiasIndicadores.js';
import { calcularEstadoCota } from './domain/cortesiasRegras.js';

export { ErroApiQualidade as ErroApi };

export interface ItemVocabularioCortesia {
  id: string;
  nome: string;
}

async function listarVocabulario(
  tabela: 'qa_motivos_cortesia' | 'qa_classificacoes_cortesia' | 'app_colaboradores',
): Promise<ItemVocabularioCortesia[]> {
  const { data, error } = await supabase.from(tabela).select('id, nome').eq('ativo', true).order('nome');
  if (error) throw new ErroApiQualidade(500, `Falha ao listar ${tabela}: ${error.message}`);
  return data ?? [];
}

export function buscarMotivosCortesia(): Promise<ItemVocabularioCortesia[]> {
  return listarVocabulario('qa_motivos_cortesia');
}

export function buscarClassificacoesCortesia(): Promise<ItemVocabularioCortesia[]> {
  return listarVocabulario('qa_classificacoes_cortesia');
}

/** Vocabulário controlado para `autorizado_por_corrigido` (R6) — nunca texto livre. */
export function buscarColaboradoresCortesia(): Promise<ItemVocabularioCortesia[]> {
  return listarVocabulario('app_colaboradores');
}

const SELECT_CORTESIA =
  'id, cod_requisicao, dta_solicitacao, dta_autorizacao, clinica_id_lis, clinica_nome, exame_nome, ' +
  'valor_particular, valor_particular_corrigido, valor_cobrado, valor_concedido, valor_concedido_corrigido, autorizado_por_lis, observacoes_lis, parsing_falhou, ' +
  'dias_ate_autorizacao, situacao_prazo, aprovada_fora_do_prazo, divergencia_valores, preco_cortesia_nao_cadastrado, ' +
  'motivo_id, classificacao_id, autorizado_por_corrigido, observacoes_curadas, status_curadoria, revisao_pendente, ' +
  'curado_por, curado_em, ' +
  'motivo:qa_motivos_cortesia(nome), classificacao:qa_classificacoes_cortesia(nome), colaborador:app_colaboradores(nome)';

interface LinhaBrutaCortesia {
  id: string;
  cod_requisicao: string;
  dta_solicitacao: string;
  dta_autorizacao: string | null;
  clinica_id_lis: number | null;
  clinica_nome: string | null;
  exame_nome: string | null;
  valor_particular: number | null;
  valor_particular_corrigido: number | null;
  valor_cobrado: number | null;
  valor_concedido: number | null;
  valor_concedido_corrigido: number | null;
  autorizado_por_lis: string | null;
  observacoes_lis: string | null;
  parsing_falhou: boolean;
  dias_ate_autorizacao: number | null;
  situacao_prazo: CortesiaDTO['situacaoPrazo'];
  aprovada_fora_do_prazo: boolean;
  divergencia_valores: boolean;
  preco_cortesia_nao_cadastrado: boolean;
  motivo_id: string | null;
  classificacao_id: string | null;
  autorizado_por_corrigido: string | null;
  observacoes_curadas: string | null;
  status_curadoria: CortesiaDTO['statusCuradoria'];
  revisao_pendente: boolean;
  curado_por: string | null;
  curado_em: string | null;
  motivo: { nome: string } | null;
  classificacao: { nome: string } | null;
  colaborador: { nome: string } | null;
}

function mapearParaDTO(linha: LinhaBrutaCortesia, nomePacienteLis: string | null): CortesiaDTO {
  return {
    id: linha.id,
    codRequisicao: linha.cod_requisicao,
    nomePacienteLis,
    dtaSolicitacao: linha.dta_solicitacao,
    dtaAutorizacao: linha.dta_autorizacao,
    clinicaNome: linha.clinica_nome,
    exameNome: linha.exame_nome,
    valorParticular: linha.valor_particular,
    valorParticularCorrigido: linha.valor_particular_corrigido,
    valorCobrado: linha.valor_cobrado,
    valorConcedido: linha.valor_concedido,
    valorConcedidoCorrigido: linha.valor_concedido_corrigido,
    autorizadoPorLis: linha.autorizado_por_lis,
    observacoesLis: linha.observacoes_lis,
    parsingFalhou: linha.parsing_falhou,
    diasAteAutorizacao: linha.dias_ate_autorizacao,
    situacaoPrazo: linha.situacao_prazo,
    aprovadaForaDoPrazo: linha.aprovada_fora_do_prazo,
    divergenciaValores: linha.divergencia_valores,
    precoCortesiaNaoCadastrado: linha.preco_cortesia_nao_cadastrado,
    motivoId: linha.motivo_id,
    motivoNome: linha.motivo?.nome ?? null,
    classificacaoId: linha.classificacao_id,
    classificacaoNome: linha.classificacao?.nome ?? null,
    autorizadoPorCorrigidoId: linha.autorizado_por_corrigido,
    autorizadoPorCorrigidoNome: linha.colaborador?.nome ?? null,
    observacoesCuradas: linha.observacoes_curadas,
    statusCuradoria: linha.status_curadoria,
    revisaoPendente: linha.revisao_pendente,
    curadoPor: linha.curado_por,
    curadoEm: linha.curado_em,
  };
}

/** PII sob demanda (P10) — nunca persistida; buscada em lote, uma única chamada ao dispatcher por período. */
function buscarNomesPacientes(
  periodo: { inicio: string; fim: string },
  recorte: RecortePeriodoCortesia | undefined,
  codigosRequisicao: string[],
): Promise<Record<string, string>> {
  return chamarQualidadeApi<Record<string, string>>(
    'buscar-pii-cortesias',
    { ...periodo, recorte, codigosRequisicao },
    'Falha ao buscar nomes de pacientes.',
  );
}

export async function buscarCortesias(filtro: CortesiaFiltro): Promise<CortesiaDTO[]> {
  const colunaPeriodo = filtro.recorte === 'autorizacao' ? 'dta_autorizacao' : 'dta_solicitacao';

  let query = supabase
    .from('qa_cortesias')
    .select(SELECT_CORTESIA)
    .gte(colunaPeriodo, filtro.inicio)
    .lte(colunaPeriodo, filtro.fim)
    .order(colunaPeriodo, { ascending: false });

  if (filtro.clinicaIdLis) query = query.eq('clinica_id_lis', filtro.clinicaIdLis);
  if (filtro.situacaoPrazo) query = query.eq('situacao_prazo', filtro.situacaoPrazo);
  if (filtro.status) query = query.eq('status_curadoria', filtro.status);

  const { data, error } = await query;
  if (error) throw new ErroApiQualidade(500, `Falha ao listar cortesias: ${error.message}`);

  const linhas = (data ?? []) as unknown as LinhaBrutaCortesia[];
  if (linhas.length === 0) return [];

  let nomes: Record<string, string> = {};
  try {
    nomes = await buscarNomesPacientes(
      { inicio: filtro.inicio, fim: filtro.fim },
      filtro.recorte,
      linhas.map((l) => l.cod_requisicao),
    );
  } catch {
    // Nome de paciente é enriquecimento (PII sob demanda) — não bloqueia a worklist se o LIS estiver indisponível.
  }

  return linhas.map((linha) => mapearParaDTO(linha, nomes[linha.cod_requisicao] ?? null));
}

export async function buscarCortesia(id: string): Promise<CortesiaDTO> {
  const { data, error } = await supabase.from('qa_cortesias').select(SELECT_CORTESIA).eq('id', id).maybeSingle();
  if (error) throw new ErroApiQualidade(500, `Falha ao buscar cortesia ${id}: ${error.message}`);
  if (!data) throw new ErroApiQualidade(404, 'Cortesia não encontrada');

  const linha = data as unknown as LinhaBrutaCortesia;
  let nomePacienteLis: string | null = null;
  try {
    const nomes = await buscarNomesPacientes(
      { inicio: linha.dta_solicitacao, fim: linha.dta_solicitacao },
      'solicitacao',
      [linha.cod_requisicao],
    );
    nomePacienteLis = nomes[linha.cod_requisicao] ?? null;
  } catch {
    // idem — enriquecimento, não bloqueia o detalhe.
  }

  return mapearParaDTO(linha, nomePacienteLis);
}

/**
 * Curadoria — `update` direto, RLS (`qualidade_usuario_tem_acesso()`)
 * protege a escrita. Auditoria (P7) é gravada pelo trigger de qa_cortesias,
 * não aqui (ver curadoria.ts original, que chamava auditoria.registrar()
 * explicitamente — substituído pelo trigger Postgres nesta conversão).
 */
export async function salvarCuradoriaCortesia(id: string, input: CuradoriaCortesiaInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ErroApiQualidade(401, 'Sessão expirada. Faça login novamente.');

  const colunas: Record<string, unknown> = {
    motivo_id: input.motivoId ?? null,
    classificacao_id: input.classificacaoId ?? null,
    autorizado_por_corrigido: input.autorizadoPorCorrigidoId ?? null,
    observacoes_curadas: input.observacoesCuradas ?? null,
    valor_particular_corrigido: input.valorParticularCorrigido ?? null,
    valor_concedido_corrigido: input.valorConcedidoCorrigido ?? null,
    status_curadoria: input.status,
    curado_por: user.id,
    curado_em: new Date().toISOString(),
  };

  const { error } = await supabase.from('qa_cortesias').update(colunas).eq('id', id);
  if (error) throw new ErroApiQualidade(error.code === '42501' ? 403 : 500, `Falha ao salvar curadoria: ${error.message}`);
}

export async function buscarIndicadoresCortesias(periodo: {
  inicio: string;
  fim: string;
  recorte?: RecortePeriodoCortesia;
}): Promise<IndicadorCortesiasResposta> {
  const recorte: RecortePeriodoCortesia = periodo.recorte ?? 'solicitacao';
  const colunaPeriodo = recorte === 'autorizacao' ? 'dta_autorizacao' : 'dta_solicitacao';

  const { data, error } = await supabase
    .from('qa_cortesias')
    .select(
      'valor_concedido, valor_concedido_corrigido, aprovada_fora_do_prazo, clinica_id_lis, clinica_nome, ' +
        'classificacao_id, autorizado_por_lis, dta_solicitacao, dta_autorizacao, ' +
        'classificacao:qa_classificacoes_cortesia(nome), colaborador:app_colaboradores(nome)',
    )
    .gte(colunaPeriodo, periodo.inicio)
    .lte(colunaPeriodo, periodo.fim);

  if (error) throw new ErroApiQualidade(500, `Falha ao buscar indicadores de cortesias: ${error.message}`);

  const linhas: LinhaIndicadorCortesia[] = (
    (data ?? []) as unknown as {
      valor_concedido: number | null;
      valor_concedido_corrigido: number | null;
      aprovada_fora_do_prazo: boolean;
      clinica_id_lis: number | null;
      clinica_nome: string | null;
      classificacao_id: string | null;
      autorizado_por_lis: string | null;
      dta_solicitacao: string;
      dta_autorizacao: string | null;
      classificacao: { nome: string } | null;
      colaborador: { nome: string } | null;
    }[]
  ).map((linha) => ({
    valorConcedido: linha.valor_concedido,
    valorConcedidoCorrigido: linha.valor_concedido_corrigido,
    aprovadaForaDoPrazo: linha.aprovada_fora_do_prazo,
    clinicaIdLis: linha.clinica_id_lis,
    clinicaNome: linha.clinica_nome,
    classificacaoId: linha.classificacao_id,
    classificacaoNome: linha.classificacao?.nome ?? null,
    autorizadoPorCorrigidoNome: linha.colaborador?.nome ?? null,
    autorizadoPorLis: linha.autorizado_por_lis,
    dataRecorte: (recorte === 'autorizacao' ? linha.dta_autorizacao : linha.dta_solicitacao) ?? linha.dta_solicitacao,
  }));

  const { data: cotasData, error: erroCotas } = await supabase
    .from('qa_cotas_cortesia')
    .select('clinica_id_lis, cota_mensal')
    .not('clinica_id_lis', 'is', null);
  if (erroCotas) throw new ErroApiQualidade(500, `Falha ao buscar cotas de cortesias: ${erroCotas.message}`);

  const realizadoPorClinica = new Map<number, number>();
  for (const linha of linhas) {
    if (linha.clinicaIdLis === null) continue;
    realizadoPorClinica.set(linha.clinicaIdLis, (realizadoPorClinica.get(linha.clinicaIdLis) ?? 0) + 1);
  }

  const cotas = (cotasData ?? []) as { clinica_id_lis: number; cota_mensal: number }[];
  const cotasExcedidas = cotas.filter(
    (cota) => calcularEstadoCota(cota.cota_mensal, realizadoPorClinica.get(cota.clinica_id_lis) ?? 0) === 'excedido',
  ).length;

  return agregarCortesias({ inicio: periodo.inicio, fim: periodo.fim }, recorte, linhas, cotasExcedidas);
}

export function sincronizarCortesias(periodo: {
  inicio: string;
  fim: string;
  recorte?: RecortePeriodoCortesia;
}): Promise<void> {
  return chamarQualidadeApi('sync-cortesias', periodo, 'Falha ao sincronizar Cortesias.');
}

export async function buscarNotificacoesCortesias(desde: string | null): Promise<NotificacaoCortesiaDTO[]> {
  const LIMITE_NOTIFICACOES = 20;
  let query = supabase
    .from('qa_cortesias')
    .select(
      'id, cod_requisicao, clinica_nome, exame_nome, autorizado_por_lis, dta_solicitacao, sincronizado_em, ' +
        'colaborador:app_colaboradores(nome)',
    )
    .order('sincronizado_em', { ascending: false })
    .limit(LIMITE_NOTIFICACOES);

  if (desde) query = query.gt('sincronizado_em', desde);

  const { data, error } = await query;
  if (error) throw new ErroApiQualidade(500, `Falha ao listar notificações de cortesias: ${error.message}`);

  return (
    (data ?? []) as unknown as {
      id: string;
      cod_requisicao: string;
      clinica_nome: string | null;
      exame_nome: string | null;
      autorizado_por_lis: string | null;
      dta_solicitacao: string;
      sincronizado_em: string;
      colaborador: { nome: string } | null;
    }[]
  ).map((linha) => ({
    id: linha.id,
    codRequisicao: linha.cod_requisicao,
    clinicaNome: linha.clinica_nome,
    exameNome: linha.exame_nome,
    autorizadoPor: linha.colaborador?.nome ?? linha.autorizado_por_lis,
    dtaSolicitacao: linha.dta_solicitacao,
    sincronizadoEm: linha.sincronizado_em,
  }));
}

// ── Cotas (R5) ───────────────────────────────────────────────────────────

interface LinhaCota {
  id: string;
  clinica_id_lis: number;
  cota_mensal: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  observacoes: string | null;
}

/** Realizado do período = nº de cortesias com `dta_solicitacao` no período para a clínica. */
async function calcularRealizadoPeriodo(clinicaIdLis: number, periodo: { inicio: string; fim: string }): Promise<number> {
  const { count, error } = await supabase
    .from('qa_cortesias')
    .select('id', { count: 'exact', head: true })
    .eq('clinica_id_lis', clinicaIdLis)
    .gte('dta_solicitacao', periodo.inicio)
    .lte('dta_solicitacao', periodo.fim);
  if (error) throw new ErroApiQualidade(500, `Falha ao calcular realizado da clínica ${clinicaIdLis}: ${error.message}`);
  return count ?? 0;
}

async function nomeClinica(clinicaIdLis: number, periodo: { inicio: string; fim: string }): Promise<string | null> {
  const { data } = await supabase
    .from('qa_cortesias')
    .select('clinica_nome')
    .eq('clinica_id_lis', clinicaIdLis)
    .gte('dta_solicitacao', periodo.inicio)
    .lte('dta_solicitacao', periodo.fim)
    .limit(1)
    .maybeSingle();
  return (data as { clinica_nome: string | null } | null)?.clinica_nome ?? null;
}

async function paraDTOCota(linha: LinhaCota, periodo: { inicio: string; fim: string }): Promise<CotaCortesiaDTO> {
  const [realizadoPeriodo, clinicaNome] = await Promise.all([
    calcularRealizadoPeriodo(linha.clinica_id_lis, periodo),
    nomeClinica(linha.clinica_id_lis, periodo),
  ]);

  return {
    id: linha.id,
    clinicaIdLis: linha.clinica_id_lis,
    clinicaNome,
    cotaMensal: linha.cota_mensal,
    vigenciaInicio: linha.vigencia_inicio,
    vigenciaFim: linha.vigencia_fim,
    observacoes: linha.observacoes,
    realizadoPeriodo,
    // Estado NUNCA é lido de coluna — sempre recalculado na leitura (R5).
    estado: calcularEstadoCota(linha.cota_mensal, realizadoPeriodo),
  };
}

export async function buscarCotas(periodo: { inicio: string; fim: string }): Promise<CotaCortesiaDTO[]> {
  const { data, error } = await supabase
    .from('qa_cotas_cortesia')
    .select('id, clinica_id_lis, cota_mensal, vigencia_inicio, vigencia_fim, observacoes')
    .not('clinica_id_lis', 'is', null);
  if (error) throw new ErroApiQualidade(500, `Falha ao listar cotas: ${error.message}`);

  const linhas = (data ?? []) as LinhaCota[];
  return Promise.all(linhas.map((linha) => paraDTOCota(linha, periodo)));
}

export async function criarCota(input: CotaCortesiaInput): Promise<CotaCortesiaDTO> {
  const { data, error } = await supabase
    .from('qa_cotas_cortesia')
    .insert({
      clinica_id_lis: input.clinicaIdLis,
      cota_mensal: input.cotaMensal,
      vigencia_inicio: input.vigenciaInicio,
      vigencia_fim: input.vigenciaFim ?? null,
      observacoes: input.observacoes ?? null,
    })
    .select('id, clinica_id_lis, cota_mensal, vigencia_inicio, vigencia_fim, observacoes')
    .single();
  if (error) throw new ErroApiQualidade(500, `Falha ao criar cota: ${error.message}`);

  return paraDTOCota(data as LinhaCota, { inicio: input.vigenciaInicio, fim: input.vigenciaFim ?? input.vigenciaInicio });
}

export async function atualizarCota(
  id: string,
  input: Partial<CotaCortesiaInput>,
  periodo: { inicio: string; fim: string },
): Promise<CotaCortesiaDTO> {
  const colunas: Record<string, unknown> = {};
  if (input.cotaMensal !== undefined) colunas.cota_mensal = input.cotaMensal;
  if (input.vigenciaInicio !== undefined) colunas.vigencia_inicio = input.vigenciaInicio;
  if (input.vigenciaFim !== undefined) colunas.vigencia_fim = input.vigenciaFim;
  if (input.observacoes !== undefined) colunas.observacoes = input.observacoes;

  const { data, error } = await supabase
    .from('qa_cotas_cortesia')
    .update(colunas)
    .eq('id', id)
    .select('id, clinica_id_lis, cota_mensal, vigencia_inicio, vigencia_fim, observacoes')
    .maybeSingle();
  if (error) throw new ErroApiQualidade(500, `Falha ao atualizar cota ${id}: ${error.message}`);
  if (!data) throw new ErroApiQualidade(404, `Cota ${id} não encontrada`);

  return paraDTOCota(data as LinhaCota, periodo);
}
