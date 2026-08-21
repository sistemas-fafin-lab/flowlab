import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Board } from '../types';

/** Catálogo de boards (tabela pequena, leitura liberada a qualquer autenticado). */
export function useBoards() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error: fetchError } = await supabase
        .from('boards')
        .select('id, slug, label')
        .order('label');

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setBoards((data ?? []) as Board[]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { boards, loading, error };
}
