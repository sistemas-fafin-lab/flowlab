// Regras puras das categorias de Gastos de TI (issue 02). Sem acesso a banco.

export interface CategoriaOrdenavel {
  id: string;
  nome: string;
  ordem: number;
}

const compararNome = (a: string, b: string): number => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });

/**
 * Ordem de exibição e de cor: `ordem` crescente, empate pelo nome. A coluna
 * `ordem` não é UNIQUE no banco (a reordenação reescreve todas numa instrução),
 * então o desempate precisa ser determinístico aqui.
 */
export function ordenarCategorias<T extends CategoriaOrdenavel>(categorias: readonly T[]): T[] {
  return [...categorias].sort((a, b) => a.ordem - b.ordem || compararNome(a.nome, b.nome));
}

/** Próxima posição livre: categoria nova entra no fim da lista. */
export function proximaOrdem(categorias: readonly { ordem: number }[]): number {
  return categorias.reduce((maior, c) => Math.max(maior, c.ordem), 0) + 1;
}

/**
 * Lista de ids depois de mover uma categoria uma posição. Na ponta (ou id
 * desconhecido) devolve a mesma ordem — a tela desabilita o botão, mas a regra
 * não depende disso.
 */
export function moverCategoria(idsEmOrdem: readonly string[], id: string, direcao: 'subir' | 'descer'): string[] {
  const ids = [...idsEmOrdem];
  const de = ids.indexOf(id);
  const para = direcao === 'subir' ? de - 1 : de + 1;
  if (de === -1 || para < 0 || para >= ids.length) return ids;
  [ids[de], ids[para]] = [ids[para], ids[de]];
  return ids;
}

/** Tira espaços das pontas e junta espaços repetidos no meio. */
export function normalizarNomeCategoria(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ');
}

/**
 * Valida o nome antes de ir ao banco. A comparação de duplicidade ignora
 * maiúsculas e acentos: o índice único do banco (`lower(nome)`) não garante
 * isso para letras acentuadas em todo locale, então a checagem de verdade para
 * "ÇA" × "ça" é esta.
 */
export function validarNomeCategoria(
  nome: string,
  existentes: readonly { id: string; nome: string }[],
  idEditando?: string,
): string | null {
  const normalizado = normalizarNomeCategoria(nome);
  if (!normalizado) return 'Informe o nome da categoria.';
  if (normalizado.length > 60) return 'Use no máximo 60 caracteres no nome.';
  const repetida = existentes.some((c) => c.id !== idEditando && compararNome(c.nome, normalizado) === 0);
  if (repetida) return 'Já existe uma categoria com esse nome.';
  return null;
}
