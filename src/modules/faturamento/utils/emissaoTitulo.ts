import type { LoteFaturamento } from '../types';
import { hojeIso } from './formato';

/** Emissão padrão do título: a data de criação do lote (a mais antiga, com vários
 *  lotes) — a mesma "data de faturamento" que o setor usa na planilha de controle
 *  e que o backfill de 11/09 gravou. Antes era hoje, o que jogava o título no mês
 *  da NF e fazia o faturado do mês divergir da planilha. Sem lote com data, hoje. */
export function emissaoPadrao(lotes: Pick<LoteFaturamento, 'dtaCriacao'>[]): string {
  const datas = lotes.map((l) => l.dtaCriacao).filter((d): d is string => Boolean(d)).sort();
  return datas[0] ?? hojeIso();
}
