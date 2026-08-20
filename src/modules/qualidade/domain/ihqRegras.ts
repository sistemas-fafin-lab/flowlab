// Regras puras de IHQ (R1, R5) — portadas verbatim de
// apps/backend/src/modules/ihq/rules/{nivelConfiancaVinculo,calcularTAT}.ts.
// Sem I/O, sem `new Date()` implícito (P4).

import type { NivelConfianca } from '../types';

export interface CandidataVinculoIhqPura {
  codRequisicaoOriginal: string;
  dtaSolicitacao: string;
  temPeca: boolean;
}

/**
 * R1 — confiança do vínculo com a biópsia original, calculada só a partir
 * de `candidatas`. "Mais de 1 candidata, 0 com peça" é tratado como
 * `baixa`, não `nenhuma` — existem candidatas reais na janela, só nenhuma
 * tem peça resolvida ainda (design.md D1 da Etapa 5).
 */
export function nivelConfiancaVinculo(candidatas: readonly CandidataVinculoIhqPura[]): NivelConfianca {
  if (candidatas.length === 0) return 'nenhuma';
  if (candidatas.length === 1) return 'alta';

  const comPeca = candidatas.filter((c) => c.temPeca).length;
  return comPeca === 1 ? 'media' : 'baixa';
}

export interface ResultadoTAT {
  /** `null` quando não há `dtaEnvio` ainda — nunca `0`. */
  diasEmAberto: number | null;
  atrasado: boolean;
}

function paraDataUtc(dataIso: string): number {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return Date.UTC(ano!, mes! - 1, dia!);
}

/**
 * R5 — TAT (turnaround time). `dataReferencia` é sempre parâmetro explícito
 * (P4) — nunca `new Date()`. `dtaEnvio` é aproximado (R3); o TAT herda essa
 * incerteza.
 */
export function calcularTAT(
  dtaEnvio: string | null,
  dtaRetorno: string | null,
  dataReferencia: string,
  tatAlertaDias: number,
): ResultadoTAT {
  if (!dtaEnvio) return { diasEmAberto: null, atrasado: false };

  const fimMs = paraDataUtc(dtaRetorno ?? dataReferencia);
  const diasEmAberto = Math.round((fimMs - paraDataUtc(dtaEnvio)) / 86_400_000);

  return { diasEmAberto, atrasado: diasEmAberto > tatAlertaDias };
}
