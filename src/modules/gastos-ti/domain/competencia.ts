// Competência = mês de referência de uma cobrança, sempre como texto
// 'YYYY-MM-01'. Nunca Date: `new Date('2026-10-01')` é meia-noite UTC e, em
// São Paulo, vira 30/09 — o mês inteiro mudaria (RNF07).

const RE_COMPETENCIA = /^(\d{4})-(\d{2})-01$/;
const RE_DATA = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/;

export const MESES_ABREVIADOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const;

const doisDigitos = (n: number): string => String(n).padStart(2, '0');

export function ehCompetencia(valor: string | null | undefined): boolean {
  const m = RE_COMPETENCIA.exec(valor ?? '');
  if (!m) return false;
  const mes = Number(m[2]);
  return mes >= 1 && mes <= 12;
}

/** Monta a competência; mês fora de 1..12 transborda para o ano vizinho (mês 13 = jan do ano seguinte). */
export function competencia(ano: number, mes: number): string {
  const indice = ano * 12 + (mes - 1);
  const anoFinal = Math.floor(indice / 12);
  const mesFinal = indice - anoFinal * 12 + 1;
  return `${anoFinal}-${doisDigitos(mesFinal)}-01`;
}

export function partesCompetencia(c: string): { ano: number; mes: number } {
  const [ano, mes] = c.split('-').map(Number);
  return { ano, mes };
}

export function somarMeses(c: string, meses: number): string {
  const { ano, mes } = partesCompetencia(c);
  return competencia(ano, mes + meses);
}

/** Quantos meses de `de` até `ate` (negativo se `ate` vem antes). */
export function mesesEntre(de: string, ate: string): number {
  const a = partesCompetencia(de);
  const b = partesCompetencia(ate);
  return (b.ano - a.ano) * 12 + (b.mes - a.mes);
}

/** 'YYYY-MM-DD' ou 'YYYY-MM' → competência do mês. null se não for data. */
export function competenciaDaData(data: string | null | undefined): string | null {
  const m = RE_DATA.exec(data ?? '');
  if (!m) return null;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return `${m[1]}-${m[2]}-01`;
}

export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Data de vencimento ('YYYY-MM-DD') na competência; dia 29–31 cai no último dia dos meses mais curtos (RN03). */
export function vencimentoNaCompetencia(c: string, dia: number): string {
  const { ano, mes } = partesCompetencia(c);
  const diaFinal = Math.min(Math.max(1, dia), ultimoDiaDoMes(ano, mes));
  return `${ano}-${doisDigitos(mes)}-${doisDigitos(diaFinal)}`;
}

/** '2026-10-01' → 'out/2026'. */
export function formatarCompetencia(c: string | null | undefined): string {
  if (!c || !ehCompetencia(c)) return '—';
  const { ano, mes } = partesCompetencia(c);
  return `${MESES_ABREVIADOS[mes - 1]}/${ano}`;
}

/** Competência → valor de `<input type="month">` ('YYYY-MM'). */
export function paraCampoMes(c: string | null | undefined): string {
  return c && ehCompetencia(c) ? c.slice(0, 7) : '';
}
