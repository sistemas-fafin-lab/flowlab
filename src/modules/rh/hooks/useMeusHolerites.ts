import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { gerarSignedUrlHolerite } from '../holeritesStorage';

export interface MeuHolerite {
  id: string;
  /** "YYYY-MM-DD" */
  competencia: string;
  arquivoPath: string;
}

interface UseMeusHoleritesResult {
  loading: boolean;
  error: string | null;
  /** false quando o usuário logado não tem colaborador vinculado (colaboradores.user_profile_id) — estado vazio dedicado, não erro. */
  temColaboradorVinculado: boolean;
  holerites: MeuHolerite[];
  refetch: () => Promise<void>;
  baixar: (arquivoPath: string) => Promise<string | null>;
}

/** Autoatendimento (issue 05) — lista só os próprios holerites, via RLS (colaboradores.user_profile_id = auth.uid()). */
export function useMeusHolerites(): UseMeusHoleritesResult {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [temColaboradorVinculado, setTemColaboradorVinculado] = useState(false);
  const [holerites, setHolerites] = useState<MeuHolerite[]>([]);

  const fetchMeusHolerites = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data: colaborador, error: erroColaborador } = await supabase
        .from('colaboradores')
        .select('id')
        .eq('user_profile_id', user.id)
        .maybeSingle();
      if (erroColaborador) throw erroColaborador;

      if (!colaborador) {
        setTemColaboradorVinculado(false);
        setHolerites([]);
        return;
      }
      setTemColaboradorVinculado(true);

      const { data, error: erroHolerites } = await supabase
        .from('colaborador_holerites')
        .select('id, competencia, arquivo_path')
        .eq('colaborador_id', colaborador.id)
        .order('competencia', { ascending: false });
      if (erroHolerites) throw erroHolerites;

      setHolerites(
        (data ?? []).map((row) => ({ id: row.id, competencia: row.competencia, arquivoPath: row.arquivo_path })),
      );
    } catch (err) {
      console.error('Erro ao carregar meus holerites:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar seus holerites.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMeusHolerites();
  }, [fetchMeusHolerites]);

  return { loading, error, temColaboradorVinculado, holerites, refetch: fetchMeusHolerites, baixar: gerarSignedUrlHolerite };
}
