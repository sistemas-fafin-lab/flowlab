// Gerenciamento de risco — reavaliação (residual) e ciclos de plano de ação
// (.scratch/qualidade-riscos-indicadores/issues/02-riscos-gerenciamento.md).
// Agregação pura (mesmo padrão de riscosClassificacao.ts), sem I/O.

import type { PlanoAcaoDTO, ReavaliacaoRiscoDTO } from '../types';

/** Mais recente primeiro — ordem de exibição do histórico (risco inicial × residual). */
export function ordenarReavaliacoesPorData(
  reavaliacoes: readonly ReavaliacaoRiscoDTO[],
): readonly ReavaliacaoRiscoDTO[] {
  return [...reavaliacoes].sort((a, b) => b.reavaliadoEm.localeCompare(a.reavaliadoEm));
}

/** Reavaliação mais recente ("risco residual atual") — `null` se o risco nunca foi reavaliado. */
export function reavaliacaoMaisRecente(reavaliacoes: readonly ReavaliacaoRiscoDTO[]): ReavaliacaoRiscoDTO | null {
  return ordenarReavaliacoesPorData(reavaliacoes)[0] ?? null;
}

/** Um ciclo é a cadeia de planos ligados por `planoAnteriorId`, do mais antigo ao mais novo. */
export type CicloPlanoAcao = readonly PlanoAcaoDTO[];

/**
 * Agrupa planos de ação de um risco em ciclos — cada ciclo começa num plano
 * sem `planoAnteriorId` (ou cujo anterior não está na lista) e segue a
 * cadeia de "não eficaz → próximo plano" até a ponta mais recente. Preserva
 * o histórico completo do ciclo anterior em vez de substituí-lo (R3 da issue).
 */
export function agruparCiclosPlanoAcao(planos: readonly PlanoAcaoDTO[]): readonly CicloPlanoAcao[] {
  const porId = new Map(planos.map((p) => [p.id, p] as const));
  const proximoPorAnterior = new Map<string, PlanoAcaoDTO>();
  for (const plano of planos) {
    if (plano.planoAnteriorId) proximoPorAnterior.set(plano.planoAnteriorId, plano);
  }

  const raizes = planos.filter((p) => !p.planoAnteriorId || !porId.has(p.planoAnteriorId));

  return raizes.map((raiz) => {
    const ciclo: PlanoAcaoDTO[] = [raiz];
    let atual = proximoPorAnterior.get(raiz.id);
    while (atual) {
      ciclo.push(atual);
      atual = proximoPorAnterior.get(atual.id);
    }
    return ciclo;
  });
}

/** Plano na ponta de um ciclo (o mais recente) — é o único elegível para "criar próximo plano". */
export function pontaDoCiclo(ciclo: CicloPlanoAcao): PlanoAcaoDTO | null {
  return ciclo[ciclo.length - 1] ?? null;
}
