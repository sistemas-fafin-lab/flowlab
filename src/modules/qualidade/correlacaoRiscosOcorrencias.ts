// Cliente de dados da correlação N:N entre Riscos e Ocorrências —
// .scratch/qualidade-riscos-indicadores/issues/05-riscos-correlacao-ocorrencias.md.
//
// `qa_riscos_ocorrencias` é o vínculo N:N (livre, editável a qualquer
// momento) — mecanismo separado de `qa_riscos.ocorrencia_origem_id` (origem
// 1:N, imutável, coberta por riscos.ts/criarRisco). As funções de leitura
// abaixo já mesclam os dois (via domain/riscosCorrelacao.ts) para que a UI
// nunca precise fazer essa conta sozinha nem duplicar uma ocorrência/risco
// que é as duas coisas ao mesmo tempo.
//
// Depende só de ocorrencias.ts (buscarOcorrencia, para resolver a origem do
// lado do risco) — não importa riscos.ts de propósito, para riscos.ts poder
// importar daqui (criarRisco grava a correlação junto com a origem) sem
// criar um ciclo de módulos.

import { supabase } from '../../lib/supabase';
import { ErroApiQualidade } from './qualidadeApi.js';
import { mesclarVinculosComOrigem } from './domain/riscosCorrelacao.js';
import { buscarOcorrencia } from './ocorrencias.js';
import type {
  CardCorrelacaoRiscoDTO,
  OcorrenciaCandidataVinculoDTO,
  OcorrenciaVinculadaRiscoDTO,
  OcorrenciaVinculoDTO,
  RiscoCandidatoVinculoDTO,
  RiscoVinculadoOcorrenciaDTO,
} from './types';

export { ErroApiQualidade as ErroApi };

const LIMITE_CANDIDATOS = 20;

function textoResumoOcorrencia(linha: { descricao_lis: string | null; resumo_curado: string | null }): string {
  return linha.resumo_curado ?? linha.descricao_lis ?? '';
}

// ─── Leitura: ocorrências vinculadas a 1 risco (detalhe do risco) ──────────

interface LinhaBrutaVinculoPorRisco {
  id: string;
  ocorrencia_id: string;
  ocorrencia: { id: string; dta_ocorrencia: string; descricao_lis: string | null; resumo_curado: string | null } | null;
}

function mapearVinculoPorRisco(linha: LinhaBrutaVinculoPorRisco & { ocorrencia: NonNullable<LinhaBrutaVinculoPorRisco['ocorrencia']> }): OcorrenciaVinculoDTO & {
  vinculoId: string;
} {
  return {
    id: linha.ocorrencia.id,
    vinculoId: linha.id,
    dtaOcorrencia: linha.ocorrencia.dta_ocorrencia,
    resumo: textoResumoOcorrencia(linha.ocorrencia),
  };
}

async function listarOcorrenciasVinculadas(riscoId: string): Promise<(OcorrenciaVinculoDTO & { vinculoId: string })[]> {
  const { data, error } = await supabase
    .from('qa_riscos_ocorrencias')
    .select('id, ocorrencia_id, ocorrencia:qa_ocorrencias(id, dta_ocorrencia, descricao_lis, resumo_curado)')
    .eq('risco_id', riscoId);
  if (error) throw new ErroApiQualidade(500, `Falha ao listar ocorrências vinculadas: ${error.message}`);

  return ((data ?? []) as unknown as LinhaBrutaVinculoPorRisco[])
    .filter((linha): linha is LinhaBrutaVinculoPorRisco & { ocorrencia: NonNullable<LinhaBrutaVinculoPorRisco['ocorrencia']> } => linha.ocorrencia !== null)
    .map(mapearVinculoPorRisco);
}

/** Seção "Correlação" do detalhe de 1 risco — vínculos N:N mesclados com a ocorrência de origem, sem duplicar. */
export async function buscarOcorrenciasCorrelacionadas(risco: { id: string; ocorrenciaOrigemId: string | null }): Promise<OcorrenciaVinculadaRiscoDTO[]> {
  const [vinculos, ocorrenciaOrigem] = await Promise.all([
    listarOcorrenciasVinculadas(risco.id),
    risco.ocorrenciaOrigemId ? buscarOcorrencia(risco.ocorrenciaOrigemId) : Promise.resolve(null),
  ]);

  const origens: (OcorrenciaVinculoDTO & { vinculoId: null })[] = ocorrenciaOrigem
    ? [
        {
          id: ocorrenciaOrigem.id,
          vinculoId: null,
          dtaOcorrencia: ocorrenciaOrigem.dtaOcorrencia,
          resumo: ocorrenciaOrigem.resumoCurado ?? ocorrenciaOrigem.descricaoLis ?? '',
        },
      ]
    : [];

  return mesclarVinculosComOrigem(vinculos, origens);
}

// ─── Leitura: riscos vinculados a 1 ocorrência (detalhe da ocorrência) ─────

interface RiscoVinculoBase {
  id: string;
  riscoIdentificado: string;
  processo: string;
  score: number | null;
}

interface LinhaBrutaVinculoPorOcorrencia {
  id: string;
  risco_id: string;
  risco: { id: string; risco_identificado: string; processo: string; score: number | null } | null;
}

function mapearVinculoPorOcorrencia(
  linha: LinhaBrutaVinculoPorOcorrencia & { risco: NonNullable<LinhaBrutaVinculoPorOcorrencia['risco']> },
): RiscoVinculoBase & { vinculoId: string } {
  return {
    id: linha.risco.id,
    vinculoId: linha.id,
    riscoIdentificado: linha.risco.risco_identificado,
    processo: linha.risco.processo,
    score: linha.risco.score,
  };
}

async function listarRiscosVinculados(ocorrenciaId: string): Promise<(RiscoVinculoBase & { vinculoId: string })[]> {
  const { data, error } = await supabase
    .from('qa_riscos_ocorrencias')
    .select('id, risco_id, risco:qa_riscos(id, risco_identificado, processo, score)')
    .eq('ocorrencia_id', ocorrenciaId);
  if (error) throw new ErroApiQualidade(500, `Falha ao listar riscos vinculados: ${error.message}`);

  return ((data ?? []) as unknown as LinhaBrutaVinculoPorOcorrencia[])
    .filter((linha): linha is LinhaBrutaVinculoPorOcorrencia & { risco: NonNullable<LinhaBrutaVinculoPorOcorrencia['risco']> } => linha.risco !== null)
    .map(mapearVinculoPorOcorrencia);
}

interface LinhaBrutaRiscoOrigem {
  id: string;
  risco_identificado: string;
  processo: string;
  score: number | null;
}

function mapearRiscoOrigem(linha: LinhaBrutaRiscoOrigem): RiscoVinculoBase & { vinculoId: null } {
  return {
    id: linha.id,
    vinculoId: null,
    riscoIdentificado: linha.risco_identificado,
    processo: linha.processo,
    score: linha.score,
  };
}

async function listarRiscosDeOrigem(ocorrenciaId: string): Promise<(RiscoVinculoBase & { vinculoId: null })[]> {
  const { data, error } = await supabase.from('qa_riscos').select('id, risco_identificado, processo, score').eq('ocorrencia_origem_id', ocorrenciaId);
  if (error) throw new ErroApiQualidade(500, `Falha ao listar riscos de origem: ${error.message}`);

  return ((data ?? []) as unknown as LinhaBrutaRiscoOrigem[]).map(mapearRiscoOrigem);
}

/** Seção "Riscos vinculados" do detalhe de 1 ocorrência — vínculos N:N mesclados com o(s) risco(s) de origem, sem duplicar. */
export async function buscarRiscosCorrelacionados(ocorrenciaId: string): Promise<RiscoVinculadoOcorrenciaDTO[]> {
  const [vinculos, origens] = await Promise.all([listarRiscosVinculados(ocorrenciaId), listarRiscosDeOrigem(ocorrenciaId)]);
  return mesclarVinculosComOrigem(vinculos, origens);
}

// ─── Escrita: vincular / desvincular ────────────────────────────────────────

export async function vincularRiscoOcorrencia(riscoId: string, ocorrenciaId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ErroApiQualidade(401, 'Sessão expirada. Faça login novamente.');

  const { error } = await supabase.from('qa_riscos_ocorrencias').insert({ risco_id: riscoId, ocorrencia_id: ocorrenciaId, criado_por: user.id });
  if (error) {
    if (error.code === '23505') throw new ErroApiQualidade(409, 'Este risco já está vinculado a esta ocorrência.');
    throw new ErroApiQualidade(error.code === '42501' ? 403 : 500, `Falha ao vincular: ${error.message}`);
  }
}

/** Remove só a linha de `qa_riscos_ocorrencias` — nunca toca `qa_riscos.ocorrencia_origem_id`. */
export async function desvincularRiscoOcorrencia(vinculoId: string): Promise<void> {
  const { error } = await supabase.from('qa_riscos_ocorrencias').delete().eq('id', vinculoId);
  if (error) throw new ErroApiQualidade(error.code === '42501' ? 403 : 500, `Falha ao desvincular: ${error.message}`);
}

// ─── Busca de candidatos para vincular ──────────────────────────────────────

interface LinhaBrutaOcorrenciaCandidata {
  id: string;
  dta_ocorrencia: string;
  descricao_lis: string | null;
  resumo_curado: string | null;
  cod_requisicao: string | null;
}

function mapearOcorrenciaCandidata(linha: LinhaBrutaOcorrenciaCandidata): OcorrenciaCandidataVinculoDTO {
  return {
    id: linha.id,
    dtaOcorrencia: linha.dta_ocorrencia,
    resumo: textoResumoOcorrencia(linha),
    codRequisicao: linha.cod_requisicao,
  };
}

export async function buscarOcorrenciasParaVincular(busca: string): Promise<OcorrenciaCandidataVinculoDTO[]> {
  let query = supabase
    .from('qa_ocorrencias')
    .select('id, dta_ocorrencia, descricao_lis, resumo_curado, cod_requisicao')
    .order('dta_ocorrencia', { ascending: false })
    .limit(LIMITE_CANDIDATOS);

  const alvo = busca.trim();
  if (alvo) query = query.or(`descricao_lis.ilike.%${alvo}%,resumo_curado.ilike.%${alvo}%,cod_requisicao.ilike.%${alvo}%`);

  const { data, error } = await query;
  if (error) throw new ErroApiQualidade(500, `Falha ao buscar ocorrências: ${error.message}`);

  return ((data ?? []) as unknown as LinhaBrutaOcorrenciaCandidata[]).map(mapearOcorrenciaCandidata);
}

interface LinhaBrutaRiscoCandidato {
  id: string;
  risco_identificado: string;
  processo: string;
}

function mapearRiscoCandidato(linha: LinhaBrutaRiscoCandidato): RiscoCandidatoVinculoDTO {
  return { id: linha.id, riscoIdentificado: linha.risco_identificado, processo: linha.processo };
}

export async function buscarRiscosParaVincular(busca: string): Promise<RiscoCandidatoVinculoDTO[]> {
  let query = supabase.from('qa_riscos').select('id, risco_identificado, processo').order('criado_em', { ascending: false }).limit(LIMITE_CANDIDATOS);

  const alvo = busca.trim();
  if (alvo) query = query.or(`risco_identificado.ilike.%${alvo}%,processo.ilike.%${alvo}%`);

  const { data, error } = await query;
  if (error) throw new ErroApiQualidade(500, `Falha ao buscar riscos: ${error.message}`);

  return ((data ?? []) as unknown as LinhaBrutaRiscoCandidato[]).map(mapearRiscoCandidato);
}

// ─── Sub-aba Correlação: cards (1 por risco com ao menos 1 vínculo N:N) ────

interface LinhaBrutaCard {
  risco_id: string;
  risco: { id: string; risco_identificado: string; processo: string; setor: { nome: string } | null } | null;
  ocorrencia: { id: string; dta_ocorrencia: string; descricao_lis: string | null; resumo_curado: string | null } | null;
}

export async function listarCardsCorrelacao(): Promise<CardCorrelacaoRiscoDTO[]> {
  const { data, error } = await supabase
    .from('qa_riscos_ocorrencias')
    .select(
      'risco_id, risco:qa_riscos(id, risco_identificado, processo, setor:qa_setores(nome)), ' +
        'ocorrencia:qa_ocorrencias(id, dta_ocorrencia, descricao_lis, resumo_curado)',
    )
    .order('criado_em', { ascending: false });
  if (error) throw new ErroApiQualidade(500, `Falha ao listar correlação: ${error.message}`);

  const cards = new Map<string, CardCorrelacaoRiscoDTO>();
  for (const linha of (data ?? []) as unknown as LinhaBrutaCard[]) {
    if (!linha.risco) continue;

    let card = cards.get(linha.risco_id);
    if (!card) {
      card = {
        riscoId: linha.risco.id,
        riscoIdentificado: linha.risco.risco_identificado,
        processo: linha.risco.processo,
        setorNome: linha.risco.setor?.nome ?? null,
        ocorrencias: [],
      };
      cards.set(linha.risco_id, card);
    }
    if (linha.ocorrencia) {
      card.ocorrencias.push({ id: linha.ocorrencia.id, dtaOcorrencia: linha.ocorrencia.dta_ocorrencia, resumo: textoResumoOcorrencia(linha.ocorrencia) });
    }
  }

  return [...cards.values()];
}
