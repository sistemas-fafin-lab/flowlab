/** Os lotes do apLIS de um agendamento em texto: "lote 7245" ou "lotes 7231, 7234". */
export function textoLotes(lotes: readonly (number | string)[]): string {
  return `${lotes.length > 1 ? 'lotes' : 'lote'} ${lotes.join(', ')}`;
}
