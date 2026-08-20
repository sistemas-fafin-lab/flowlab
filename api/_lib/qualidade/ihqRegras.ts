// api/_lib/qualidade/ihqRegras.ts
// Regra pura de confiança do vínculo de IHQ (R1) — cópia server-side de
// src/modules/qualidade/domain/ihqRegras.ts (mesmo motivo de duplicação que
// cortesiasRegras.ts: sem import cross-boundary api/ → src/ neste repo).
// Só `nivelConfiancaVinculo` é reproduzida aqui — `calcularTAT` é usada
// apenas na leitura de indicadores (client-side), não em nenhum handler.

export type NivelConfianca = 'alta' | 'media' | 'baixa' | 'nenhuma';

export interface CandidataVinculoIhqPura {
  codRequisicaoOriginal: string;
  dtaSolicitacao: string;
  temPeca: boolean;
}

/**
 * R1 — confiança do vínculo com a biópsia original, calculada só a partir
 * de `candidatas`. "Mais de 1 candidata, 0 com peça" é tratado como
 * `baixa`, não `nenhuma` — existem candidatas reais na janela, só nenhuma
 * tem peça resolvida ainda.
 */
export function nivelConfiancaVinculo(candidatas: readonly CandidataVinculoIhqPura[]): NivelConfianca {
  if (candidatas.length === 0) return 'nenhuma';
  if (candidatas.length === 1) return 'alta';

  const comPeca = candidatas.filter((c) => c.temPeca).length;
  return comPeca === 1 ? 'media' : 'baixa';
}
