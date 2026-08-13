// Rótulo legível de um status a partir da lista fixa do módulo
// (STATUS_LAUDO, STATUS_CULTURA, …). Status fora da lista (valor novo/legado)
// cai no próprio valor — as listas toleram valores futuros por contrato.

export const rotuloStatus = <T extends string>(
  lista: readonly { key: T; label: string }[],
  valor: string,
): string => lista.find((x) => x.key === valor)?.label ?? valor;
