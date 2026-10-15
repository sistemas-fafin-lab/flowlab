// Busca dos dropdowns do design system (Select e MultiSelect). Puro, para testar sem DOM.

export interface OpcaoBuscavel {
  label: string;
  description?: string;
  /** termos extras que a busca também encontra (ex.: e-mail, cargo, apelidos) */
  keywords?: string;
}

/** Minúsculas e sem acento: "José" acha "jose", "Gestão" acha "gestao". */
export const normalizarBusca = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * As opções que casam com a busca, na ordem original. Cada palavra digitada precisa aparecer em
 * algum lugar (rótulo, descrição ou termos extras): "ana ti" acha "Ana Souza · TI".
 */
export function filtrarOpcoes<T extends OpcaoBuscavel>(opcoes: readonly T[], busca: string): T[] {
  const termos = normalizarBusca(busca).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return [...opcoes];
  return opcoes.filter((o) => {
    const texto = normalizarBusca([o.label, o.description ?? '', o.keywords ?? ''].join(' '));
    return termos.every((t) => texto.includes(t));
  });
}

/** Tecla que escreve um caractere (abre a busca já com ele, como num select nativo). */
export const ehTeclaDeTexto = (e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }): boolean =>
  e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey;
