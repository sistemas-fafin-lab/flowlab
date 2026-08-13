import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { ViewSalva, ViewSalvaTela } from '../types';

// Views de filtros salvas por usuário, por tela (dashboard/titulos/glosas).
//
// CRUD direto sob RLS (fat_views_salvas exige usuario_id = auth.uid()), mesmo
// padrão de lancarGlosas/cancelarTitulo em useContasReceber.ts: é uma linha
// só, sem nada a tornar atômico, então nenhuma RPC.
//
// `salvar` é upsert por (usuario_id, tela, nome): salvar de novo com o mesmo
// nome sobrescreve os filtros da view existente em vez de barrar com erro de
// unicidade — é o comportamento esperado de "salvar view".
//
// `filtros` é um JSONB que o banco nunca olha: uma view salva em formato
// antigo ou corrompido voltaria crua para o chamador. Cada tela passa o seu
// `sanitizar` (utils/viewsSalvas.ts) e o hook o aplica a cada linha antes de
// devolvê-la — nenhum consumidor recebe filtro com campo faltando ou valor
// fora do union (o crash de 3b971eb não pode mais ressuscitar numa tela nova).

// Formato cru devolvido pelo PostgREST.
interface LinhaViewSalva {
  id: string;
  tela: ViewSalvaTela;
  nome: string;
  filtros: unknown;
  criado_em: string;
  updated_at: string;
}

function normalizar<TFiltros>(
  linha: LinhaViewSalva,
  sanitizar: (filtros: unknown) => TFiltros,
): ViewSalva<TFiltros> {
  return {
    id: linha.id,
    tela: linha.tela,
    nome: linha.nome,
    filtros: sanitizar(linha.filtros),
    criadoEm: linha.criado_em,
    atualizadoEm: linha.updated_at,
  };
}

// Erro de unicidade (usuario_id, tela, nome) só deveria acontecer numa corrida
// entre duas abas — o upsert de `salvar` já evita o caso normal de "salvar
// com nome repetido". `renomear` ainda pode bater nele.
function mensagemErro(erro: { code?: string; message: string }, fallback: string): string {
  if (erro.code === '23505') return 'Já existe uma view com esse nome nesta tela.';
  return erro.message || fallback;
}

interface UseViewsSalvasResult<TFiltros> {
  views: ViewSalva<TFiltros>[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Cria a view, ou sobrescreve os filtros se já existir uma com esse nome. */
  salvar: (nome: string, filtros: TFiltros) => Promise<string | null>;
  renomear: (id: string, nome: string) => Promise<string | null>;
  excluir: (id: string) => Promise<string | null>;
}

export function useViewsSalvas<TFiltros>(
  tela: ViewSalvaTela,
  sanitizar: (filtros: unknown) => TFiltros,
): UseViewsSalvasResult<TFiltros> {
  const [views, setViews] = useState<ViewSalva<TFiltros>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Descarta respostas de buscas antigas, mesma guarda de useContasReceber.
  const buscaAtual = useRef(0);
  // `sanitizar` chega como lambda inline dos chamadores; o ref evita que uma
  // identidade nova a cada render dispare refetch em loop.
  const sanitizarRef = useRef(sanitizar);
  sanitizarRef.current = sanitizar;

  const refetch = useCallback(async () => {
    const reqId = ++buscaAtual.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: erro } = await supabase
        .from('fat_views_salvas')
        .select('id, tela, nome, filtros, criado_em, updated_at')
        .eq('tela', tela)
        .order('nome');
      if (reqId !== buscaAtual.current) return;
      if (erro) throw new Error(erro.message);

      setViews((data as unknown as LinhaViewSalva[] ?? []).map((l) => normalizar<TFiltros>(l, sanitizarRef.current)));
    } catch (err) {
      if (reqId !== buscaAtual.current) return;
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as views salvas.');
      setViews([]);
    } finally {
      if (reqId === buscaAtual.current) setLoading(false);
    }
  }, [tela, sanitizarRef]);

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [refetch]);

  const salvar = useCallback(async (nome: string, filtros: TFiltros): Promise<string | null> => {
    setError(null);
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) return 'Dê um nome para a view antes de salvar.';
    try {
      const { error: erro } = await supabase
        .from('fat_views_salvas')
        .upsert(
          { tela, nome: nomeLimpo, filtros: filtros as Record<string, unknown> },
          { onConflict: 'usuario_id,tela,nome' },
        );
      if (erro) throw erro;
      await refetch();
      return null;
    } catch (err) {
      const msg = mensagemErro(err as { code?: string; message: string }, 'Não foi possível salvar a view.');
      setError(msg);
      return msg;
    }
  }, [tela, refetch]);

  const renomear = useCallback(async (id: string, nome: string): Promise<string | null> => {
    setError(null);
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) return 'Dê um nome para a view antes de renomear.';
    try {
      const { error: erro } = await supabase
        .from('fat_views_salvas')
        .update({ nome: nomeLimpo })
        .eq('id', id);
      if (erro) throw erro;
      await refetch();
      return null;
    } catch (err) {
      const msg = mensagemErro(err as { code?: string; message: string }, 'Não foi possível renomear a view.');
      setError(msg);
      return msg;
    }
  }, [refetch]);

  const excluir = useCallback(async (id: string): Promise<string | null> => {
    setError(null);
    try {
      const { error: erro } = await supabase.from('fat_views_salvas').delete().eq('id', id);
      if (erro) throw new Error(erro.message);
      await refetch();
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível excluir a view.';
      setError(msg);
      return msg;
    }
  }, [refetch]);

  return { views, loading, error, refetch, salvar, renomear, excluir };
}
