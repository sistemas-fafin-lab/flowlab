import type { LoteFaturamento } from '../types';
import { hojeIso } from './formato';

/** Emissão padrão do título: a data de fechamento do lote no apLIS (a mais
 *  recente, com vários lotes — é quando a cobrança inteira ficou faturada). É a
 *  "Data Faturamento" da planilha de controle do setor e a convenção do backfill
 *  do 1º semestre. Antes era a criação do lote, o que jogava lotes criados num mês
 *  e fechados no outro no mês errado. Sem lote fechado, hoje. */
export function emissaoPadrao(lotes: Pick<LoteFaturamento, 'dtaFechamento'>[]): string {
  const datas = lotes.map((l) => l.dtaFechamento).filter((d): d is string => Boolean(d)).sort();
  return datas[datas.length - 1] ?? hojeIso();
}
