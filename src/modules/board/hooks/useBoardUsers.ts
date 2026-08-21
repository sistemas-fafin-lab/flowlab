import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export interface BoardUserOption {
  id: string;
  name: string;
}

/** Lista de usuários para o seletor de responsável do card — sem escopo por board no v1. */
export function useBoardUsers() {
  const [users, setUsers] = useState<BoardUserOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.from('user_profiles').select('id, name').order('name');
      if (cancelled) return;
      setUsers((data ?? []) as BoardUserOption[]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { users, loading };
}
