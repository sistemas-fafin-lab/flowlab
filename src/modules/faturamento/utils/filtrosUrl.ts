// Estado inicial de filtros da aba Faturas vindo da URL (issue 02 — deep-link de
// período + convênio, hoje usado pelo drill-down de Contas a Receber → Envios).
// Extraído em funções puras para poder testar sem montar o componente — ver
// filtrosUrl.test.ts.

const DATA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface PeriodoUrl {
  periodoIni: string;
  periodoFim: string;
}

/** `periodoIni`/`periodoFim` da URL, só quando os DOIS vêm no formato YYYY-MM-DD —
 *  um período parcial ou malformado é ignorado (a tela cai no padrão local, como se
 *  não houvesse parâmetro nenhum). */
export function periodoInicialDaUrl(searchParams: URLSearchParams): PeriodoUrl | null {
  const ini = searchParams.get('periodoIni');
  const fim = searchParams.get('periodoFim');
  if (ini && fim && DATA_ISO_RE.test(ini) && DATA_ISO_RE.test(fim)) return { periodoIni: ini, periodoFim: fim };
  return null;
}

/** `idFontePagadora` da URL — inteiro positivo; undefined (sem filtro) quando
 *  ausente ou inválido. */
export function idFontePagadoraInicialDaUrl(searchParams: URLSearchParams): number | undefined {
  const bruto = searchParams.get('idFontePagadora');
  if (!bruto) return undefined;
  const n = Number(bruto);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}
