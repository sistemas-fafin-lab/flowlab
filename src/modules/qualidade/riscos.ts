// Cliente de dados da aba Riscos — .scratch/qualidade-riscos-indicadores/issues/01-riscos-cadastro-matriz-origem.md.
// Diferente de ocorrencias.ts/cortesias.ts/ihq.ts/cancer.ts, `qa_riscos` não
// espelha o LIS: é dado nativo do Supabase, supabase-js direto do cliente,
// protegido por RLS (`current_user_has_permission('canViewQualidade' |
// 'canManageQualidade')`) — sem handler serverless de sync.

import { supabase } from '../../lib/supabase';
import { ErroApiQualidade } from './qualidadeApi.js';
import { resolverFaixasClassificacao, classificarScore } from './domain/riscosClassificacao.js';
import type { FaixaClassificacaoRisco, NovoRiscoInput, RiscoDTO, RiscoFiltro } from './types';

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
  'origem_risco, ocorrencia_origem_id, probabilidade, severidade, score, criado_por, criado_em, ' +
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
