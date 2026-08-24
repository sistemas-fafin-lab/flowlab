import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export interface BoardUserOption {
  id: string;
  name: string;
}

/**
 * Lista de usuários para o seletor de responsável do card — restrita a quem
 * tem um cargo vinculado a este board (`custom_roles.board_id`), o mesmo
 * critério usado pela RLS de `board_tickets` (ver migration
 * 20260821120000_board_multidepartamento.sql).
 */
export function useBoardUsers(boardId: string | null) {
  const [users, setUsers] = useState<BoardUserOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!boardId) {
      setUsers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, name, custom_roles!inner(board_id)')
        .eq('custom_roles.board_id', boardId)
        .order('name');
      if (cancelled) return;
      setUsers((data ?? []).map((u) => ({ id: u.id, name: u.name })));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [boardId]);

  return { users, loading };
}
