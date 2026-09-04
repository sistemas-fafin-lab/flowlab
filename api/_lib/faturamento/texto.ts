/**
 * Normaliza um campo de texto vindo do body de uma request: string vazia (ou
 * só espaços) vira `undefined`, para os handlers tratarem como "não
 * informado" com o mesmo `if (!campo)`.
 */
export function texto(bruto: unknown): string | undefined {
  return typeof bruto === 'string' && bruto.trim() !== '' ? bruto.trim() : undefined;
}
