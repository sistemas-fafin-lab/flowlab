import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { BUCKET_HOLERITES, gerarSignedUrlHolerite } from '../holeritesStorage';
import type { ColaboradorHolerite } from '../types';

interface HoleriteRow {
  id: string;
  colaborador_id: string;
  competencia: string;
  arquivo_path: string;
  created_at: string;
  colaboradores: { nome: string } | null;
}

const mapHolerite = (row: HoleriteRow): ColaboradorHolerite => ({
  id: row.id,
  colaboradorId: row.colaborador_id,
  colaboradorNome: row.colaboradores?.nome ?? 'Colaborador removido',
  competencia: row.competencia,
  arquivoPath: row.arquivo_path,
  createdAt: row.created_at,
});

interface UseHoleritesEnviadosResult {
  holerites: ColaboradorHolerite[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Gera signed URL de curta duração (60s) pra baixar — nunca expõe o path direto. */
  baixar: (arquivoPath: string) => Promise<string | null>;
  /** Remove o arquivo do bucket e a linha da tabela; retorna mensagem de erro, ou `null` em sucesso. */
  remover: (id: string, arquivoPath: string) => Promise<string | null>;
}

/** Histórico de holerites já enviados (visão RH, `canManageHolerites` via RLS) — filtro por colaborador feito em memória, mesmo padrão de ColaboradoresPage. */
export function useHoleritesEnviados(): UseHoleritesEnviadosResult {
  const [holerites, setHolerites] = useState<ColaboradorHolerite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHolerites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('colaborador_holerites')
        .select('id, colaborador_id, competencia, arquivo_path, created_at, colaboradores(nome)')
        .order('competencia', { ascending: false });
      if (fetchError) throw fetchError;
      setHolerites((data as unknown as HoleriteRow[] | null ?? []).map(mapHolerite));
    } catch (err) {
      console.error('Erro ao carregar holerites enviados:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os holerites enviados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHolerites();
  }, [fetchHolerites]);

  const remover = useCallback(async (id: string, arquivoPath: string): Promise<string | null> => {
    const { error: storageError } = await supabase.storage.from(BUCKET_HOLERITES).remove([arquivoPath]);
    if (storageError) {
      console.error('Erro ao remover arquivo do holerite:', storageError);
      return storageError.message;
    }
    const { error: deleteError } = await supabase.from('colaborador_holerites').delete().eq('id', id);
    if (deleteError) {
      console.error('Erro ao remover holerite:', deleteError);
      return deleteError.message;
    }
    setHolerites((prev) => prev.filter((h) => h.id !== id));
    return null;
  }, []);

  return { holerites, loading, error, refetch: fetchHolerites, baixar: gerarSignedUrlHolerite, remover };
}
