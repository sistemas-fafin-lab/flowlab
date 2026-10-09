import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { normalizarNomeCategoria, ordenarCategorias, proximaOrdem, validarNomeCategoria } from '../domain/categorias';
import { chaveTexto } from '../domain/listaDespesas';
import type { CategoriaTI, CategoriaTIInput, NaturezaGasto } from '../types';

interface CategoriaTIRow {
  id: string;
  nome: string;
  descricao: string | null;
  natureza_padrao: NaturezaGasto;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

const mapCategoria = (row: CategoriaTIRow): CategoriaTI => ({
  id: row.id,
  nome: row.nome,
  descricao: row.descricao,
  naturezaPadrao: row.natureza_padrao,
  ordem: row.ordem,
  ativo: row.ativo,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** Traduz os erros do Postgres que a tela consegue provocar. */
const mensagemDeErro = (erro: { code?: string; message: string }, padrao: string): string => {
  if (erro.code === '23505') return 'Já existe uma categoria com esse nome.';
  if (erro.code === '23514') return 'Dados inválidos para a categoria. Confira o nome e a natureza.';
  if (erro.code === '42501') return 'Você não tem permissão para alterar categorias de Gastos de TI.';
  return erro.message || padrao;
};

const paraLinha = (input: CategoriaTIInput) => ({
  nome: normalizarNomeCategoria(input.nome),
  descricao: input.descricao?.trim() || null,
  natureza_padrao: input.naturezaPadrao,
});

export type ResultadoCriarCategoria = { ok: true; id: string } | { ok: false; erro: string };
export type ResultadoCriarCategorias = { ok: true; idPorChave: Map<string, string> } | { ok: false; erro: string };

export interface UseCategoriasTIResult {
  /** Todas as categorias (ativas e inativas), já na ordem de exibição/cor. */
  categorias: CategoriaTI[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Cria no fim da lista. Devolve o id para o formulário de despesa já selecionar a categoria nova. */
  criarCategoria: (input: CategoriaTIInput) => Promise<ResultadoCriarCategoria>;
  /**
   * Cria várias de uma vez no fim da lista (importação, issue 09), com
   * posições seguidas numa só instrução. Devolve o id por nome normalizado
   * (chaveTexto), para trocar o marcador de categoria nova das linhas.
   */
  criarCategoriasEmLote: (nomes: string[]) => Promise<ResultadoCriarCategorias>;
  atualizarCategoria: (id: string, input: CategoriaTIInput) => Promise<string | null>;
  definirAtivo: (id: string, ativo: boolean) => Promise<string | null>;
  /** Grava a ordem inteira de uma vez (RPC ti_reordenar_categorias). */
  reordenar: (idsEmOrdem: string[]) => Promise<string | null>;
}

export function useCategoriasTI(): UseCategoriasTIResult {
  const [categorias, setCategorias] = useState<CategoriaTI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchCategorias = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('ti_categorias')
        .select('id, nome, descricao, natureza_padrao, ordem, ativo, created_at, updated_at')
        .order('ordem', { ascending: true });

      if (fetchError) throw fetchError;
      if (requestIdRef.current !== requestId) return;

      setCategorias(ordenarCategorias(((data as CategoriaTIRow[] | null) ?? []).map(mapCategoria)));
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      console.error('Erro ao carregar categorias de Gastos de TI:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as categorias.');
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategorias();
  }, [fetchCategorias]);

  const criarCategoria = useCallback(
    async (input: CategoriaTIInput): Promise<ResultadoCriarCategoria> => {
      const invalido = validarNomeCategoria(input.nome, categorias);
      if (invalido) return { ok: false, erro: invalido };
      const { data, error: erro } = await supabase
        .from('ti_categorias')
        .insert({ ...paraLinha(input), ordem: proximaOrdem(categorias) })
        .select('id')
        .single();
      if (erro) return { ok: false, erro: mensagemDeErro(erro, 'Não foi possível criar a categoria.') };
      await fetchCategorias();
      return { ok: true, id: (data as { id: string }).id };
    },
    [categorias, fetchCategorias],
  );

  const criarCategoriasEmLote = useCallback(
    async (nomes: string[]): Promise<ResultadoCriarCategorias> => {
      if (nomes.length === 0) return { ok: true, idPorChave: new Map() };
      for (const nome of nomes) {
        const invalido = validarNomeCategoria(nome, categorias);
        if (invalido) return { ok: false, erro: `${nome}: ${invalido}` };
      }
      const primeira = proximaOrdem(categorias);
      const { data, error: erro } = await supabase
        .from('ti_categorias')
        .insert(nomes.map((nome, i) => ({ nome: normalizarNomeCategoria(nome), natureza_padrao: 'opex', ordem: primeira + i })))
        .select('id, nome');
      if (erro) return { ok: false, erro: mensagemDeErro(erro, 'Não foi possível criar as categorias.') };
      await fetchCategorias();
      return { ok: true, idPorChave: new Map(((data as { id: string; nome: string }[]) ?? []).map((c) => [chaveTexto(c.nome), c.id])) };
    },
    [categorias, fetchCategorias],
  );

  const atualizarCategoria = useCallback(
    async (id: string, input: CategoriaTIInput): Promise<string | null> => {
      const invalido = validarNomeCategoria(input.nome, categorias, id);
      if (invalido) return invalido;
      const { error: erro } = await supabase.from('ti_categorias').update(paraLinha(input)).eq('id', id);
      if (erro) return mensagemDeErro(erro, 'Não foi possível salvar a categoria.');
      await fetchCategorias();
      return null;
    },
    [categorias, fetchCategorias],
  );

  const definirAtivo = useCallback(
    async (id: string, ativo: boolean): Promise<string | null> => {
      const { error: erro } = await supabase.from('ti_categorias').update({ ativo }).eq('id', id);
      if (erro) return mensagemDeErro(erro, 'Não foi possível alterar a categoria.');
      await fetchCategorias();
      return null;
    },
    [fetchCategorias],
  );

  const reordenar = useCallback(
    async (idsEmOrdem: string[]): Promise<string | null> => {
      // Otimista: a lista troca de posição na hora; se o banco recusar, o
      // refetch devolve a ordem real.
      setCategorias((atuais) => {
        const posicao = new Map(idsEmOrdem.map((id, i) => [id, i + 1]));
        return ordenarCategorias(atuais.map((c) => ({ ...c, ordem: posicao.get(c.id) ?? c.ordem })));
      });
      const { error: erro } = await supabase.rpc('ti_reordenar_categorias', { p_ids: idsEmOrdem });
      if (erro) {
        await fetchCategorias();
        return mensagemDeErro(erro, 'Não foi possível reordenar as categorias.');
      }
      return null;
    },
    [fetchCategorias],
  );

  return {
    categorias,
    loading,
    error,
    refetch: fetchCategorias,
    criarCategoria,
    criarCategoriasEmLote,
    atualizarCategoria,
    definirAtivo,
    reordenar,
  };
}
