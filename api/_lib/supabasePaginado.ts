// api/_lib/supabasePaginado.ts
// Leitura de uma tabela inteira do Supabase em páginas, pros endpoints de
// integração que devolvem tudo num payload só (orcamento-particular,
// tuss-exames).

import type { SupabaseClient } from '@supabase/supabase-js';

const PAGE_SIZE = 1000; // espelha max_rows do PostgREST (supabase/config.toml)

/** Lança com o nome da tabela se qualquer página falhar. */
export async function buscarTodasPaginado<T>(
  supabase: SupabaseClient,
  tabela: string,
  colunas: string,
): Promise<T[]> {
  const linhas: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(tabela)
      .select(colunas)
      .range(from, from + PAGE_SIZE - 1)
      .returns<T[]>();
    if (error) throw new Error(`Falha ao ler ${tabela}: ${error.message}`);
    linhas.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return linhas;
}
