// api/_lib/rh/holeritesStorage.ts
// Convenções de path do bucket privado `colaborador-holerites` (migration
// 20260916120000_rh_holerites.sql), compartilhadas entre os handlers de
// preview e confirmação.

export const BUCKET_HOLERITES = 'colaborador-holerites';

/** Path temporário onde o navegador do RH sobe o PDF consolidado antes do parsing (ver EnviarHoleritesSection). */
const PADRAO_TEMP_PATH = /^_tmp\/[a-f0-9-]{36}\.pdf$/;

export function tempPathValido(path: unknown): path is string {
  return typeof path === 'string' && PADRAO_TEMP_PATH.test(path);
}

/** Path final do holerite individual de um colaborador — determinístico (upsert natural: mesmo colaborador+competência sempre cai no mesmo objeto). */
export function pathHoleriteIndividual(colaboradorId: string, competencia: string): string {
  const competenciaAnoMes = competencia.slice(0, 7); // "YYYY-MM-DD" -> "YYYY-MM"
  return `${colaboradorId}/${competenciaAnoMes}.pdf`;
}
