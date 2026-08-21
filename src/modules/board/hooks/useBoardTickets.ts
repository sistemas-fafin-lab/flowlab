import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { BoardTicket } from '../types';

type BoardTicketRow = Omit<BoardTicket, 'responsible_name'> & {
  responsible: { name: string } | null;
};

/**
 * Cards de um board. `boardId` nulo (ainda resolvendo o board de acesso
 * "all", ou sem acesso) faz o hook não buscar nada.
 */
export function useBoardTickets(boardId: string | null) {
  const [tickets, setTickets] = useState<BoardTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    if (!boardId) {
      setTickets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('board_tickets')
      .select('*, responsible:user_profiles!responsible_id(name)')
      .eq('board_id', boardId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setTickets(
        ((data ?? []) as unknown as BoardTicketRow[]).map(({ responsible, ...t }) => ({
          ...t,
          responsible_name: responsible?.name ?? null,
        })),
      );
    }
    setLoading(false);
  }, [boardId]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  return { tickets, loading, error, refetch: fetchTickets };
}
