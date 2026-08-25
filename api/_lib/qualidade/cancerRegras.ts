// api/_lib/qualidade/cancerRegras.ts
// Regras puras de Registro de Câncer (R2/R3/R8) — implementadas contra o
// contrato já fixado em src/modules/qualidade/domain/cancerRegras.test.ts
// (ver issue .scratch/qualidade/issues/02-cancer-regras-arquivo-faltando.md).
// Sem I/O, sem `new Date()` (P4) — quem chama já traz os dados do LIS/Supabase.

export type TriagemCancer = 'pendente' | 'cancer_confirmado' | 'nao_cancer' | 'inconclusivo';

export interface CasoFunilInput {
  triagem: TriagemCancer;
  cidoTopografiaCodigo: string | null;
  cidoMorfologiaCodigo: string | null;
  exportacaoId: string | null;
  revisaoPendente: boolean;
}

export interface FunilContagem {
  universo: number;
  triados: number;
  confirmados: number;
  classificados: number;
  exportados: number;
  /** R8 — nunca soma dentro das 5 contagens normais. */
  retificacaoPendente: number;
}

/** R2/R8 — cada contagem é independente; um caso pode entrar em várias. */
export function calcularFunil(casos: readonly CasoFunilInput[]): FunilContagem {
  let triados = 0;
  let confirmados = 0;
  let classificados = 0;
  let exportados = 0;
  let retificacaoPendente = 0;

  for (const caso of casos) {
    if (caso.triagem !== 'pendente') triados++;
    if (caso.triagem === 'cancer_confirmado') confirmados++;
    if (caso.cidoTopografiaCodigo !== null && caso.cidoMorfologiaCodigo !== null) classificados++;
    if (caso.exportacaoId !== null) exportados++;
    if (caso.revisaoPendente) retificacaoPendente++;
  }

  return { universo: casos.length, triados, confirmados, classificados, exportados, retificacaoPendente };
}

export interface CasoElegibilidadeInput {
  triagem: TriagemCancer;
  cidoTopografiaCodigo: string | null;
  cidoMorfologiaCodigo: string | null;
  exportacaoId: string | null;
}

/** R3 — só confirmado, classificado nos 2 eixos, e ainda não exportado. */
export function elegivelParaExportacao(caso: CasoElegibilidadeInput): boolean {
  return (
    caso.triagem === 'cancer_confirmado' &&
    caso.cidoTopografiaCodigo !== null &&
    caso.cidoMorfologiaCodigo !== null &&
    caso.exportacaoId === null
  );
}

export interface EntradaCatalogoCido {
  codigo: string;
  descricao: string;
}

export interface CandidaturaInput {
  /** Ex.: "M-80903" — `diagnostico.CodInternacional` do LIS. */
  codInternacionalDiagnostico: string | null;
  textoLaudo: string | null;
}

export interface CandidaturaResultado {
  candidato: boolean;
  confianca: 'alta' | 'media' | null;
  indicadores: string[];
}

function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** "M-80903" → "80903"; sem "-" devolve o valor como veio. */
function extrairCodigoMorfologia(codInternacional: string): string {
  const partes = codInternacional.split('-');
  return partes.length > 1 ? partes[partes.length - 1]! : codInternacional;
}

/**
 * R1 — heurística, nunca decisão. Código CID-O batendo exato = confiança
 * alta; só o texto do laudo batendo por descrição = confiança média; sem
 * nenhum indício, não é candidato.
 */
export function avaliarCandidaturaCancer(
  input: CandidaturaInput,
  catalogoMorfologia: readonly EntradaCatalogoCido[],
): CandidaturaResultado {
  if (input.codInternacionalDiagnostico) {
    const codigo = extrairCodigoMorfologia(input.codInternacionalDiagnostico);
    const bateCodigo = catalogoMorfologia.find((entrada) => entrada.codigo === codigo);
    if (bateCodigo) {
      return { candidato: true, confianca: 'alta', indicadores: [`codigo_cid_o:${input.codInternacionalDiagnostico}`] };
    }
  }

  if (input.textoLaudo) {
    const textoNormalizado = normalizarTexto(input.textoLaudo);
    const bateDescricao = catalogoMorfologia.find((entrada) => textoNormalizado.includes(normalizarTexto(entrada.descricao)));
    if (bateDescricao) {
      return { candidato: true, confianca: 'media', indicadores: [`descricao_laudo:${bateDescricao.descricao}`] };
    }
  }

  return { candidato: false, confianca: null, indicadores: [] };
}

const ORDEM_CONFIANCA: Record<'alta' | 'media', number> = { alta: 2, media: 1 };

/** Combina várias avaliações (ex.: um indício por bloco/peça) na maior confiança encontrada. */
export function combinarCandidaturas(resultados: readonly CandidaturaResultado[]): CandidaturaResultado {
  let melhor: CandidaturaResultado = { candidato: false, confianca: null, indicadores: [] };
  const indicadores: string[] = [];

  for (const resultado of resultados) {
    indicadores.push(...resultado.indicadores);
    if (!resultado.candidato) continue;
    if (melhor.confianca === null || (resultado.confianca && ORDEM_CONFIANCA[resultado.confianca] > ORDEM_CONFIANCA[melhor.confianca])) {
      melhor = resultado;
    }
  }

  return { candidato: melhor.candidato, confianca: melhor.confianca, indicadores };
}

export interface SugestaoClassificacaoCancer {
  codigo: string;
  descricao: string;
}

export interface SugestaoMorfologiaInput {
  codInternacionalDiagnostico: string | null;
}

/** R2/R3 — só sugere por correspondência EXATA de código; nunca "quase bate". */
export function sugerirMorfologia(
  input: SugestaoMorfologiaInput,
  catalogoMorfologia: readonly EntradaCatalogoCido[],
): SugestaoClassificacaoCancer | null {
  if (!input.codInternacionalDiagnostico) return null;
  const codigo = extrairCodigoMorfologia(input.codInternacionalDiagnostico);
  const entrada = catalogoMorfologia.find((e) => e.codigo === codigo);
  return entrada ? { codigo: entrada.codigo, descricao: entrada.descricao } : null;
}

/** Prefixo gravado por `qa_parametros` (módulo `cancer`) enquanto o valor real de um campo fixo do RHC é pendência de negócio — ver issue 11. */
export const PREFIXO_PLACEHOLDER_PARAMETRO_FIXO_CANCER = 'PLACEHOLDER — ';

/**
 * As colunas do layout RHC sem origem no LIS — `registrador` fica de fora:
 * vem do formulário de exportação a cada lote, não de `qa_parametros`
 * (issue 13).
 */
export interface ColunasFixasExportacaoCancer {
  cnes: string;
  fonte: string;
  regiaoAdministrativa: string;
  municipio: string;
  estado: string;
  naturalidadeFixa: string;
  nacionalidadeFixa: string;
  corIgnorado: string;
  enderecoCodigo: string;
  profissaoCodigo: string;
  meioDiagnostico: string;
  extensao: string;
  casoRaro: string;
  estadoCivilIgnorado: string;
  escolaridadeIgnorado: string;
}

/**
 * Lista fechada de chaves (não `Object.keys`/`Object.entries`) — mesmas 15
 * chaves de `ColunasFixasExportacaoCancer`/`carregarParametrosFixosCancer`;
 * `registrador` não entra em nenhuma das duas (issue 13).
 */
const CHAVES_COLUNAS_FIXAS_EXPORTACAO_CANCER = [
  'cnes',
  'fonte',
  'regiaoAdministrativa',
  'municipio',
  'estado',
  'naturalidadeFixa',
  'nacionalidadeFixa',
  'corIgnorado',
  'enderecoCodigo',
  'profissaoCodigo',
  'meioDiagnostico',
  'extensao',
  'casoRaro',
  'estadoCivilIgnorado',
  'escolaridadeIgnorado',
] as const satisfies readonly (keyof ColunasFixasExportacaoCancer)[];

/**
 * R4 (spec RHC do projeto irmão) — nenhuma dessas colunas pode ir pro CSV de
 * exportação vazia ou com placeholder: é um arquivo de notificação
 * compulsória à vigilância epidemiológica. Devolve as chaves ainda
 * pendentes; vazio = liberado para exportar.
 */
export function parametrosFixosPendentes(parametros: ColunasFixasExportacaoCancer): string[] {
  return CHAVES_COLUNAS_FIXAS_EXPORTACAO_CANCER.filter((chave) => {
    const valor = parametros[chave];
    return valor === '' || valor.startsWith(PREFIXO_PLACEHOLDER_PARAMETRO_FIXO_CANCER);
  });
}

export interface SugestaoTopografiaInput {
  descricaoTopografiaLis: string | null;
}

/** R2/R3 — só sugere por descrição normalizada IGUAL; sem correspondência clara não sugere nada. */
export function sugerirTopografia(
  input: SugestaoTopografiaInput,
  catalogoTopografia: readonly EntradaCatalogoCido[],
): SugestaoClassificacaoCancer | null {
  if (!input.descricaoTopografiaLis) return null;
  const alvo = normalizarTexto(input.descricaoTopografiaLis);
  const entrada = catalogoTopografia.find((e) => normalizarTexto(e.descricao) === alvo);
  return entrada ? { codigo: entrada.codigo, descricao: entrada.descricao } : null;
}
