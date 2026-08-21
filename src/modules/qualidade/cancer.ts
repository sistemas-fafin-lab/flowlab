// Cliente de dados de Registro de Câncer — AJUSTADO em 2026-08-19
// (openspec/changes/spa-sem-backend-express, D6): não fala mais com
// apps/backend/Express via apiFetch. Assinaturas exportadas continuam as
// mesmas — nenhuma página/componente mudou.
//
// Diferente dos outros 3 módulos: a MAIORIA das operações aqui passa pelo
// dispatcher (não supabase-js direto), porque listagem/detalhe já
// precisam do LIS para calcular candidatura/sugestão de classificação, e
// geração de exportação sobe um CSV com PII completa ao Storage — nunca
// algo que o browser deveria fazer com a chave anônima (ver
// api/_lib/qualidade/handlers/{buscar-funil-cancer,buscar-detalhe-cancer,
// gerar-exportacao-cancer}.ts). Só o que é CRUD puro sobre `qa_*`
// (triagem, classificação, catálogo CID-O, parâmetros fixos, lista de
// exportações já feitas) é supabase-js direto, protegido por RLS.

import type {
  AtualizarParametroFixoCancerInput,
  CancerCasoDetalheDTO,
  CidoEntradaDTO,
  ClassificacaoCancerInput,
  ExportacaoRhcDTO,
  FunilCancerResposta,
  GerarExportacaoInput,
  ParametrosFixosCancerDTO,
  TipoCido,
  TriagemCancerInput,
} from './types';
import { supabase } from '../../lib/supabase';
import { chamarQualidadeApi, ErroApiQualidade } from './qualidadeApi.js';

export { ErroApiQualidade as ErroApi };

export function buscarFunilCancer(periodo: { inicio: string; fim: string }): Promise<FunilCancerResposta> {
  return chamarQualidadeApi('buscar-funil-cancer', periodo, 'Falha ao buscar funil de Registro de Câncer.');
}

export function buscarCancerCaso(id: string): Promise<CancerCasoDetalheDTO> {
  return chamarQualidadeApi('buscar-detalhe-cancer', { id }, 'Falha ao buscar caso de Registro de Câncer.');
}

/**
 * Triagem (R2) — decisão humana explícita, nunca inferida do texto do
 * laudo. `update` direto, RLS protege a escrita; auditoria (P7) é gravada
 * pelo trigger de qa_cancer_casos. Casos "não é câncer" continuam
 * consultáveis, com autor e justificativa (R7, P3) — nunca apagados.
 */
export async function salvarTriagemCancer(id: string, input: TriagemCancerInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ErroApiQualidade(401, 'Sessão expirada. Faça login novamente.');

  const { error } = await supabase
    .from('qa_cancer_casos')
    .update({
      triagem: input.triagem,
      triagem_justificativa: input.justificativa,
      triado_por: user.id,
      triado_em: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw new ErroApiQualidade(error.code === '42501' ? 403 : 500, `Falha ao salvar triagem: ${error.message}`);
}

export class TriagemNaoConfirmadaError extends ErroApiQualidade {
  constructor() {
    super(400, 'Só é possível classificar casos com triagem "cancer_confirmado"');
  }
}

export class CodigoCidoInvalidoError extends ErroApiQualidade {
  constructor(codigo: string, tipoEsperado: TipoCido) {
    super(400, `Código CID-O "${codigo}" não encontrado para o tipo "${tipoEsperado}"`);
  }
}

async function validarCodigoCido(codigo: string, tipoEsperado: TipoCido): Promise<void> {
  const { data, error } = await supabase
    .from('qa_cido_catalogo')
    .select('codigo')
    .eq('codigo', codigo)
    .eq('tipo', tipoEsperado)
    .eq('ativo', true)
    .maybeSingle();
  if (error) throw new ErroApiQualidade(500, `Falha ao validar código CID-O "${codigo}": ${error.message}`);
  if (!data) throw new CodigoCidoInvalidoError(codigo, tipoEsperado);
}

/**
 * Classificação CID-O (R3) — só permitida depois da triagem confirmar
 * câncer, só com códigos validados contra `qa_cido_catalogo` (nunca texto
 * livre). `update` direto + validação client-side (o `check` constraint do
 * banco é a rede de segurança real, não esta checagem — R2/R3).
 */
export async function salvarClassificacaoCancer(id: string, input: ClassificacaoCancerInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ErroApiQualidade(401, 'Sessão expirada. Faça login novamente.');

  const { data: caso, error: erroBusca } = await supabase
    .from('qa_cancer_casos')
    .select('triagem')
    .eq('id', id)
    .maybeSingle();
  if (erroBusca) throw new ErroApiQualidade(500, `Falha ao buscar caso ${id}: ${erroBusca.message}`);
  if (!caso) throw new ErroApiQualidade(404, `Caso ${id} não encontrado`);
  if ((caso as { triagem: string }).triagem !== 'cancer_confirmado') throw new TriagemNaoConfirmadaError();

  await validarCodigoCido(input.cidoTopografiaCodigo, 'topografia');
  await validarCodigoCido(input.cidoMorfologiaCodigo, 'morfologia');

  const { error } = await supabase
    .from('qa_cancer_casos')
    .update({
      cido_topografia_codigo: input.cidoTopografiaCodigo,
      cido_morfologia_codigo: input.cidoMorfologiaCodigo,
      classificado_por: user.id,
      classificado_em: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw new ErroApiQualidade(500, `Falha ao salvar classificação: ${error.message}`);
}

/**
 * Busca por código (prefixo) ou descrição (substring) — R3. Duas consultas
 * `ilike` separadas em vez de um `.or()` com string montada à mão, para não
 * abrir superfície de injeção na sintaxe de filtro do PostgREST.
 */
export async function buscarCidoCatalogo(busca: string, tipo?: TipoCido): Promise<CidoEntradaDTO[]> {
  function baseQuery() {
    let query = supabase.from('qa_cido_catalogo').select('codigo, tipo, descricao').eq('ativo', true);
    if (tipo) query = query.eq('tipo', tipo);
    return query;
  }

  if (!busca) {
    const { data, error } = await baseQuery().order('descricao').limit(50);
    if (error) throw new ErroApiQualidade(500, `Falha ao buscar catálogo CID-O: ${error.message}`);
    return (data ?? []) as CidoEntradaDTO[];
  }

  const [porCodigo, porDescricao] = await Promise.all([
    baseQuery().ilike('codigo', `${busca}%`).limit(50),
    baseQuery().ilike('descricao', `%${busca}%`).limit(50),
  ]);
  if (porCodigo.error) throw new ErroApiQualidade(500, `Falha ao buscar catálogo CID-O: ${porCodigo.error.message}`);
  if (porDescricao.error) throw new ErroApiQualidade(500, `Falha ao buscar catálogo CID-O: ${porDescricao.error.message}`);

  const vistos = new Set<string>();
  const resultado: CidoEntradaDTO[] = [];
  for (const linha of [...(porCodigo.data ?? []), ...(porDescricao.data ?? [])] as CidoEntradaDTO[]) {
    if (vistos.has(linha.codigo)) continue;
    vistos.add(linha.codigo);
    resultado.push(linha);
  }
  return resultado.slice(0, 50);
}

export function sincronizarCancer(periodo: { inicio: string; fim: string }): Promise<void> {
  return chamarQualidadeApi('sync-cancer', periodo, 'Falha ao sincronizar Registro de Câncer.');
}

export async function listarExportacoesCancer(): Promise<ExportacaoRhcDTO[]> {
  const { data, error } = await supabase
    .from('qa_exportacoes_rhc')
    .select('id, ano, trimestre, hash_arquivo, total_casos, registrador, gerado_por, gerado_em')
    .order('gerado_em', { ascending: false });
  if (error) throw new ErroApiQualidade(500, `Falha ao listar exportações: ${error.message}`);

  return (
    (data ?? []) as {
      id: string;
      ano: number;
      trimestre: 1 | 2 | 3 | 4;
      hash_arquivo: string;
      total_casos: number;
      registrador: string;
      gerado_por: string;
      gerado_em: string;
    }[]
  ).map((linha) => ({
    id: linha.id,
    ano: linha.ano,
    trimestre: linha.trimestre,
    hashArquivo: linha.hash_arquivo,
    totalCasos: linha.total_casos,
    registrador: linha.registrador,
    geradoPor: linha.gerado_por,
    geradoEm: linha.gerado_em,
  }));
}

export function gerarExportacaoCancer(input: GerarExportacaoInput): Promise<ExportacaoRhcDTO> {
  return chamarQualidadeApi('gerar-exportacao-cancer', input, 'Falha ao gerar exportação.');
}

export function buscarLinkDownloadExportacao(id: string): Promise<{ url: string }> {
  return chamarQualidadeApi('baixar-exportacao-cancer', { id }, 'Falha ao gerar link de download.');
}

/**
 * Campos fixos institucionais (Fonte, Cor, Região administrativa etc.) —
 * "raramente variam" mas não são hardcoded (P5). `atualizado_por`/
 * `atualizado_em` na própria linha de `qa_parametros` são o rastro de
 * quem mudou o quê (mesmo padrão de core/parametros.ts original — este
 * recurso não usa `qa_auditoria`, porque a chave primária de
 * `qa_parametros` é `chave text`, não `uuid`).
 */
export async function atualizarParametroFixoCancer(input: AtualizarParametroFixoCancerInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ErroApiQualidade(401, 'Sessão expirada. Faça login novamente.');

  const chave = `cancer.${input.chave}`;
  const { data: existente, error: erroBusca } = await supabase.from('qa_parametros').select('chave').eq('chave', chave).maybeSingle();
  if (erroBusca) throw new ErroApiQualidade(500, `Falha ao buscar parâmetro "${chave}": ${erroBusca.message}`);
  if (!existente) throw new ErroApiQualidade(404, `Parâmetro "${chave}" não existe — não é possível editar o que não foi criado por migration`);

  const { error } = await supabase
    .from('qa_parametros')
    .update({ valor: input.valor, atualizado_em: new Date().toISOString(), atualizado_por: user.id })
    .eq('chave', chave);
  if (error) throw new ErroApiQualidade(error.code === '42501' ? 403 : 500, `Falha ao gravar parâmetro "${chave}": ${error.message}`);
}

export async function buscarParametrosFixosCancer(): Promise<ParametrosFixosCancerDTO> {
  const { data, error } = await supabase.from('qa_parametros').select('chave, valor').eq('modulo', 'cancer');
  if (error) throw new ErroApiQualidade(500, `Falha ao carregar parâmetros fixos: ${error.message}`);

  const porChave = new Map((data ?? []).map((l) => [String(l.chave).replace('cancer.', ''), l.valor]));
  const texto = (chave: string) => String(porChave.get(chave) ?? '');

  return {
    cnes: texto('cnes'),
    fonte: texto('fonte'),
    regiaoAdministrativa: texto('regiao_administrativa'),
    municipio: texto('municipio'),
    estado: texto('estado'),
    naturalidadeFixa: texto('naturalidade_fixa'),
    nacionalidadeFixa: texto('nacionalidade_fixa'),
    corIgnorado: texto('cor_ignorado'),
    enderecoCodigo: texto('endereco_codigo'),
    profissaoCodigo: texto('profissao_codigo'),
    meioDiagnostico: texto('meio_diagnostico'),
    extensao: texto('extensao'),
    casoRaro: texto('caso_raro'),
    estadoCivilIgnorado: texto('estado_civil_ignorado'),
    escolaridadeIgnorado: texto('escolaridade_ignorado'),
    registrador: texto('registrador'),
  };
}
