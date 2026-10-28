// Quem pode ver cada tela do Faturamento (docs/adr/0001-permissoes-faturamento-por-tela.md).
// `canViewBilling` continua abrindo todas as telas; cada tela também abre com a sua chave.
// A mesma regra vale na rota, no menu e na API (api/_lib/faturamento/autorizacao.ts),
// por isso o arquivo não importa nada do navegador. A API e a RLS (fat_pode_ver_tela,
// 20261028150000) aceitam também canManageBilling, como já aceitavam antes.

export type TelaFaturamento = 'faturas' | 'contasReceber' | 'glosas' | 'indicadores' | 'calendarioEnvios';

const CHAVE_DA_TELA: Record<TelaFaturamento, string> = {
  faturas: 'canViewFaturas',
  contasReceber: 'canViewContasReceber',
  glosas: 'canViewGlosas',
  indicadores: 'canViewIndicadores',
  calendarioEnvios: 'canViewCalendarioEnvios',
};

/** Telas do menu, na ordem em que aparecem. A primeira permitida é a entrada do item "Faturamento". */
export const TELAS_FATURAMENTO: { tela: TelaFaturamento; href: string }[] = [
  { tela: 'faturas', href: '/faturamento/faturas' },
  { tela: 'contasReceber', href: '/faturamento/recebimentos' },
  { tela: 'glosas', href: '/faturamento/glosas' },
  { tela: 'indicadores', href: '/faturamento/indicadores' },
];

/** A chave geral e a chave da tela; qualquer uma das duas abre a tela. */
export function chavesQueAbremTela(tela: TelaFaturamento): string[] {
  return ['canViewBilling', CHAVE_DA_TELA[tela]];
}

export function podeVerTela(permissoes: string[], tela: TelaFaturamento): boolean {
  return chavesQueAbremTela(tela).some((chave) => permissoes.includes(chave));
}

export function primeiraTelaPermitida(permissoes: string[]): string | null {
  return TELAS_FATURAMENTO.find(({ tela }) => podeVerTela(permissoes, tela))?.href ?? null;
}
