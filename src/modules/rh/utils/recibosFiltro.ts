// Filtro e agrupamento da lista de recibos de pagamento (holerites) — usada na
// ficha do colaborador (RH) e, depois, no Meu perfil.

const MESES = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export interface ReciboFiltravel {
  /** "YYYY-MM-DD", sempre dia 1. */
  competencia: string;
}

/** Minúsculas e sem acento. */
export const normalizarBusca = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Texto pesquisável de uma competência: "setembro 09/2026 2026". */
export const textoBuscaCompetencia = (competencia: string): string => {
  const [ano, mes] = competencia.split('-');
  return `${MESES[Number(mes) - 1] ?? ''} ${mes}/${ano} ${ano}`;
};

/**
 * Cada palavra da busca precisa aparecer no texto da competência: "set 2026",
 * "março", "03/2026" e "2025" funcionam.
 */
export const reciboCasaBusca = (competencia: string, busca: string): boolean => {
  const termos = normalizarBusca(busca).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return true;
  const alvo = textoBuscaCompetencia(competencia);
  return termos.every((t) => alvo.includes(t));
};

export const anoDaCompetencia = (competencia: string): number => Number(competencia.slice(0, 4));

/** Anos com recibo, do mais recente ao mais antigo. */
export const anosDisponiveis = (recibos: readonly ReciboFiltravel[]): number[] =>
  [...new Set(recibos.map((r) => anoDaCompetencia(r.competencia)))].sort((a, b) => b - a);

export const filtrarRecibos = <T extends ReciboFiltravel>(recibos: readonly T[], busca: string, ano: number | null): T[] =>
  recibos.filter((r) => (ano === null || anoDaCompetencia(r.competencia) === ano) && reciboCasaBusca(r.competencia, busca));

/** Grupos por ano (desc), recibos de cada ano por competência (desc). */
export const agruparPorAno = <T extends ReciboFiltravel>(recibos: readonly T[]): { ano: number; recibos: T[] }[] => {
  const ordenados = [...recibos].sort((a, b) => b.competencia.localeCompare(a.competencia));
  const grupos: { ano: number; recibos: T[] }[] = [];
  for (const r of ordenados) {
    const ano = anoDaCompetencia(r.competencia);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.ano === ano) ultimo.recibos.push(r);
    else grupos.push({ ano, recibos: [r] });
  }
  return grupos;
};
