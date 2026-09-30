// Regras puras do "Atualizar do apLIS" (criação de títulos a partir dos lotes
// fechados no apLIS — .scratch/faturamento-titulos-automaticos/spec.md).

import { paraIso } from './formato';

/** Data de corte mínima. Lotes fechados antes disso foram tratados pelo backfill
 *  e ficam de fora de propósito. O servidor valida o mesmo piso
 *  (faturamento-titulos-aplis-previa.ts); aqui só limita o campo. */
export const PISO_CORTE_APLIS = '2026-09-01';

/** Default do "fechados a partir de": 1º dia do mês anterior (cobre o mês que
 *  acabou de fechar), nunca antes do piso. Em data local, não UTC. */
export function corteAplisPadrao(hoje: Date = new Date()): string {
  const corte = paraIso(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1));
  return corte < PISO_CORTE_APLIS ? PISO_CORTE_APLIS : corte;
}
