// EPI e Identificação do EPI no cadastro de produtos (CONTEXT.md, seção Estoque e Qualidade;
// .scratch/epi-relatorio-mensal/spec.md). Regras puras, sem banco e sem tela.

export type TipoIdentificacaoEpi = 'CA' | 'ANVISA';

export const TIPOS_IDENTIFICACAO_EPI: { value: TipoIdentificacaoEpi; label: string }[] = [
  { value: 'CA', label: 'CA' },
  { value: 'ANVISA', label: 'Registro ANVISA' },
];

/** Os campos de EPI do produto. Texto vazio quer dizer "não informado". */
export interface CamposEpi {
  isEpi: boolean;
  epiTipo: TipoIdentificacaoEpi | '';
  epiNumero: string;
  /** YYYY-MM-DD */
  epiValidade: string;
}

/** Colunas de EPI da tabela products, para um `select` junto com o id. */
export const COLUNAS_EPI_PRODUTO = 'is_epi, epi_identificacao_tipo, epi_identificacao_numero, epi_identificacao_validade';

interface LinhaEpiProduto {
  is_epi?: boolean | null;
  epi_identificacao_tipo?: string | null;
  epi_identificacao_numero?: string | null;
  epi_identificacao_validade?: string | null;
}

/** Colunas de EPI de uma linha de products → CamposEpi (NULL vira ''; tipo desconhecido vira ''). */
export function camposEpiDaLinha(linha: LinhaEpiProduto): CamposEpi {
  const tipo = linha.epi_identificacao_tipo;
  return {
    isEpi: linha.is_epi ?? false,
    epiTipo: tipo === 'CA' || tipo === 'ANVISA' ? tipo : '',
    epiNumero: linha.epi_identificacao_numero ?? '',
    epiValidade: linha.epi_identificacao_validade ?? '',
  };
}

/**
 * Cópia da Identificação do EPI gravada no item da solicitação de materiais na finalização
 * (campo `identificacaoEpi` do item). `null` = não informado no cadastro naquele momento.
 * A presença da cópia, mesmo toda `null`, quer dizer "foi entregue com esta identificação":
 * só item sem cópia (entregas anteriores à funcionalidade) usa o cadastro atual do produto.
 */
export interface CopiaIdentificacaoEpi {
  tipo: TipoIdentificacaoEpi | null;
  numero: string | null;
  /** YYYY-MM-DD */
  validade: string | null;
}

/** "CA 12345", "ANVISA 80495510226", só o número quando falta o tipo, ou '' sem número. */
export function formatarIdentificacaoEpi(campos: Pick<CamposEpi, 'epiTipo' | 'epiNumero'>): string {
  const numero = campos.epiNumero.trim();
  if (!numero) return '';
  return campos.epiTipo ? `${campos.epiTipo} ${numero}` : numero;
}

/** EPI cuja validade da identificação é anterior a `hoje` (YYYY-MM-DD). Só avisa, não bloqueia. */
export function identificacaoEpiVencida(campos: CamposEpi, hoje: string): boolean {
  return campos.isEpi && !!campos.epiValidade && campos.epiValidade < hoje;
}

/** EPI sem o número da identificação ("quando aplicável": não bloqueia, só aparece no filtro). */
export function epiSemIdentificacao(campos: CamposEpi): boolean {
  return campos.isEpi && !campos.epiNumero.trim();
}

export type FiltroEpi = 'todos' | 'epi' | 'sem-identificacao' | 'vencida';

export function passaFiltroEpi(campos: CamposEpi, filtro: FiltroEpi, hoje: string): boolean {
  switch (filtro) {
    case 'todos':
      return true;
    case 'epi':
      return campos.isEpi;
    case 'sem-identificacao':
      return epiSemIdentificacao(campos);
    case 'vencida':
      return identificacaoEpiVencida(campos, hoje);
  }
}

const CHAVES_EPI: (keyof CamposEpi)[] = ['isEpi', 'epiTipo', 'epiNumero', 'epiValidade'];

/**
 * O que vai para o banco num cadastro ou edição de produto. Sem a permissão "Gerir EPI"
 * (`canManageEpi`), a marcação e a identificação saem do salvamento e ficam como estão.
 * O trigger `products_guard_epi` recusa a mesma alteração direto no banco. Ao desmarcar EPI,
 * a identificação (que a tela esconde) é apagada, para não ficar dado invisível no produto.
 */
export function respeitarPermissaoEpi<T extends Partial<CamposEpi>>(dados: T, podeGerirEpi: boolean): T {
  const resultado = { ...dados };
  if (!podeGerirEpi) {
    for (const chave of CHAVES_EPI) delete resultado[chave];
    return resultado;
  }
  if (resultado.isEpi === false) {
    return { ...resultado, epiTipo: '', epiNumero: '', epiValidade: '' };
  }
  if (typeof resultado.epiNumero === 'string') resultado.epiNumero = resultado.epiNumero.trim();
  return resultado;
}
