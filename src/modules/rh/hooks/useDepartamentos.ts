import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Departamento } from '../types';

interface DepartamentoRow {
  id: string;
  nome: string;
  ativo: boolean;
  aprovador_sc_id: string | null;
  departamento_responsaveis: { colaborador_id: string }[] | null;
}

const mapDepartamento = (row: DepartamentoRow): Departamento => ({
  id: row.id,
  nome: row.nome,
  ativo: row.ativo,
  aprovadorScId: row.aprovador_sc_id,
  responsavelIds: (row.departamento_responsaveis ?? []).map((r) => r.colaborador_id),
});

/** Erro do Postgres/PostgREST em mensagem para a tela; o 23505 é o índice único do nome. */
const mensagemDeErro = (erro: { code?: string; message: string }): string =>
  erro.code === '23505' ? 'Já existe um departamento com esse nome.' : erro.message;

interface UseDepartamentosResult {
  departamentos: Departamento[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** As mutações devolvem a mensagem de erro, ou null se ok. */
  criar: (nome: string) => Promise<string | null>;
  renomear: (id: string, nome: string) => Promise<string | null>;
  /** Desativar é barrado pelo banco enquanto houver colaborador ativo no departamento. */
  definirAtivo: (id: string, ativo: boolean) => Promise<string | null>;
  definirAprovador: (id: string, colaboradorId: string | null) => Promise<string | null>;
  adicionarResponsavel: (id: string, colaboradorId: string) => Promise<string | null>;
  removerResponsavel: (id: string, colaboradorId: string) => Promise<string | null>;
}

export function useDepartamentos(): UseDepartamentosResult {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchDepartamentos = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('departamentos')
        .select('id, nome, ativo, aprovador_sc_id, departamento_responsaveis(colaborador_id)')
        .order('nome', { ascending: true });

      if (fetchError) throw fetchError;
      if (requestIdRef.current !== requestId) return;

      setDepartamentos(((data as DepartamentoRow[] | null) ?? []).map(mapDepartamento));
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      console.error('Erro ao carregar departamentos:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os departamentos.');
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartamentos();
  }, [fetchDepartamentos]);

  /** Roda a escrita e recarrega a lista; devolve a mensagem de erro, ou null. */
  const executar = useCallback(
    async (escrita: PromiseLike<{ error: { code?: string; message: string } | null }>): Promise<string | null> => {
      try {
        const { error: erro } = await escrita;
        if (erro) return mensagemDeErro(erro);
        await fetchDepartamentos();
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : 'Não foi possível salvar.';
      }
    },
    [fetchDepartamentos],
  );

  const criar = useCallback(
    (nome: string) => executar(supabase.from('departamentos').insert({ nome: nome.trim() })),
    [executar],
  );

  const renomear = useCallback(
    (id: string, nome: string) => executar(supabase.from('departamentos').update({ nome: nome.trim() }).eq('id', id)),
    [executar],
  );

  const definirAtivo = useCallback(
    (id: string, ativo: boolean) => executar(supabase.from('departamentos').update({ ativo }).eq('id', id)),
    [executar],
  );

  const definirAprovador = useCallback(
    (id: string, colaboradorId: string | null) =>
      executar(supabase.from('departamentos').update({ aprovador_sc_id: colaboradorId }).eq('id', id)),
    [executar],
  );

  const adicionarResponsavel = useCallback(
    (id: string, colaboradorId: string) =>
      executar(supabase.from('departamento_responsaveis').insert({ departamento_id: id, colaborador_id: colaboradorId })),
    [executar],
  );

  const removerResponsavel = useCallback(
    (id: string, colaboradorId: string) =>
      executar(
        supabase.from('departamento_responsaveis').delete().eq('departamento_id', id).eq('colaborador_id', colaboradorId),
      ),
    [executar],
  );

  return {
    departamentos,
    loading,
    error,
    refetch: fetchDepartamentos,
    criar,
    renomear,
    definirAtivo,
    definirAprovador,
    adicionarResponsavel,
    removerResponsavel,
  };
}
