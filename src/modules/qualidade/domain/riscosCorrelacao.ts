// Correlação N:N entre Riscos e Ocorrências
// (.scratch/qualidade-riscos-indicadores/issues/05-riscos-correlacao-ocorrencias.md).
// Agregação pura (mesmo padrão de riscosGerenciamento.ts), sem I/O.

interface ComId {
  id: string;
}

/**
 * Mescla uma lista de vínculos N:N com os itens de origem 1:N, sem duplicar
 * — um item que é origem E já tem vínculo N:N aparece uma única vez, com
 * `ehOrigem: true`; um item que é só origem (ainda sem vínculo N:N) entra
 * como uma linha adicional, também com `ehOrigem: true`. `origens` aceita
 * mais de 1 item porque, do lado da ocorrência, mais de 1 risco pode ter
 * nascido da mesma ocorrência (cada risco tem no máximo 1 origem, mas nada
 * impede duas gerações a partir da mesma ocorrência).
 */
export function mesclarVinculosComOrigem<T extends ComId>(vinculosNN: readonly T[], origens: readonly T[]): (T & { ehOrigem: boolean })[] {
  const idsOrigem = new Set(origens.map((o) => o.id));
  const idsVinculos = new Set(vinculosNN.map((v) => v.id));

  const marcados = vinculosNN.map((v) => ({ ...v, ehOrigem: idsOrigem.has(v.id) }));
  const origensFaltantes = origens.filter((o) => !idsVinculos.has(o.id)).map((o) => ({ ...o, ehOrigem: true }));

  return [...origensFaltantes, ...marcados];
}

/** Mesma normalização de ComboboxBusca.tsx (minúsculas, sem diacríticos) — busca acento-insensível. */
function normalizarBusca(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

interface CardBuscavel {
  riscoIdentificado: string;
  processo: string;
  ocorrencias: readonly { resumo: string }[];
}

/** Sub-aba Correlação: busca por texto do risco (processo/risco identificado) OU de qualquer ocorrência vinculada ao card. */
export function filtrarCardsCorrelacao<T extends CardBuscavel>(cards: readonly T[], busca: string): T[] {
  const alvo = normalizarBusca(busca.trim());
  if (!alvo) return [...cards];
  return cards.filter(
    (c) =>
      normalizarBusca(c.riscoIdentificado).includes(alvo) ||
      normalizarBusca(c.processo).includes(alvo) ||
      c.ocorrencias.some((o) => normalizarBusca(o.resumo).includes(alvo)),
  );
}
