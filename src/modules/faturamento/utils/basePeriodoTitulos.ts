// Base do período da aba Títulos: sobre qual data o "de/até" recorta.
// Compartilhado pela tela (useContasReceber) e pela API (titulos-lotes-status-aplis).
//
// - emissao: `notas.data_emissao` (padrão; a emissão nunca é nula).
// - competencia: `notas.competencia` ('YYYY-MM'), pelos meses do de/até — título
//   sem competência fica de fora.
// - envio: `lotes.data_envio` — o título entra se ALGUM lote dele foi enviado no
//   período; título sem lote enviado fica de fora.

export type BasePeriodoTitulos = 'emissao' | 'competencia' | 'envio';

export const BASES_PERIODO_TITULOS: { value: BasePeriodoTitulos; label: string }[] = [
  { value: 'emissao', label: 'Emissão' },
  { value: 'competencia', label: 'Competência' },
  { value: 'envio', label: 'Envio' },
];

export function ehBasePeriodoTitulos(valor: unknown): valor is BasePeriodoTitulos {
  return valor === 'emissao' || valor === 'competencia' || valor === 'envio';
}

/** Meses ('YYYY-MM') do período 'YYYY-MM-DD', para o recorte por competência. */
export function mesesDoPeriodo(desde: string, ate: string): { de: string; ate: string } {
  return { de: desde.slice(0, 7), ate: ate.slice(0, 7) };
}

/** Apelido do vínculo com os lotes usado só para o recorte por envio (PostgREST). */
export const ALIAS_ENVIO_LOTE = 'filtro_envio_lote';
export const EMBED_ENVIO_LOTE = `${ALIAS_ENVIO_LOTE}:nota_lote!inner(lotes!inner(data_envio))`;
