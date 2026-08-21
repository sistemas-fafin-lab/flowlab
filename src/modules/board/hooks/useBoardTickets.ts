import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { BoardTicket, BoardTicketInput, KanbanStatus } from '../types';

type BoardTicketRow = Omit<BoardTicket, 'responsible_name'> & {
  responsible: { name: string } | null;
};

type MutationResult = { error: string | null };

/**
 * Cards de um board. `boardId` nulo (ainda resolvendo o board de acesso
 * "all", ou sem acesso) faz o hook não buscar nada. `userId` é usado como
 * `created_by` ao criar cards — a escrita em si é sempre validada pela RLS
 * (ver migration `board_multidepartamento`), estas mutações só refletem o
 * resultado no estado local.
 */
export function useBoardTickets(boardId: string | null, userId: string | null) {
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

  const createTicket = useCallback(
    async (kanbanStatus: KanbanStatus, input: BoardTicketInput): Promise<MutationResult> => {
      if (!boardId || !userId) return { error: 'Board ou usuário inválido.' };

      const { error: insertError } = await supabase.from('board_tickets').insert({
        board_id: boardId,
        kanban_status: kanbanStatus,
        created_by: userId,
        ...input,
      });

      if (insertError) return { error: insertError.message };

      await fetchTickets();
      return { error: null };
    },
    [boardId, userId, fetchTickets],
  );

  const updateTicket = useCallback(
    async (id: string, input: BoardTicketInput): Promise<MutationResult> => {
      // `.select('id')` é o único jeito de perceber um UPDATE que a policy de
      // RLS filtrou silenciosamente (0 linhas afetadas, sem erro do Postgrest)
      // — ex: permissão revogada ou cargo repontado para outro board enquanto
      // a tela já estava aberta em outra aba.
      const { data, error: updateError } = await supabase.from('board_tickets').update(input).eq('id', id).select('id');
      if (updateError) return { error: updateError.message };
      if (!data || data.length === 0) return { error: 'Sem permissão para editar este card.' };

      await fetchTickets();
      return { error: null };
    },
    [fetchTickets],
  );

  const deleteTicket = useCallback(
    async (id: string): Promise<MutationResult> => {
      setTickets((prev) => prev.filter((t) => t.id !== id));

      const { data, error: deleteError } = await supabase.from('board_tickets').delete().eq('id', id).select('id');

      // Em erro ou RLS silenciosamente bloqueando (0 linhas), refaz a busca em
      // vez de restaurar um snapshot local — um snapshot capturado antes desta
      // chamada perderia qualquer outra mutação otimista aplicada por cima
      // enquanto esta requisição estava em voo (ex: outro card movido/excluído
      // em paralelo). Mesmo padrão do board de TI (`ITKanbanBoard.fetchRequests`).
      if (deleteError || !data || data.length === 0) {
        await fetchTickets();
        return { error: deleteError?.message ?? 'Sem permissão para excluir este card.' };
      }
      return { error: null };
    },
    [fetchTickets],
  );

  const moveTicket = useCallback(
    async (id: string, kanbanStatus: KanbanStatus): Promise<MutationResult> => {
      setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, kanban_status: kanbanStatus } : t)));

      const { data, error: updateError } = await supabase
        .from('board_tickets')
        .update({ kanban_status: kanbanStatus })
        .eq('id', id)
        .select('id');

      if (updateError || !data || data.length === 0) {
        await fetchTickets();
        return { error: updateError?.message ?? 'Sem permissão para mover este card.' };
      }
      return { error: null };
    },
    [fetchTickets],
  );

  return { tickets, loading, error, refetch: fetchTickets, createTicket, updateTicket, deleteTicket, moveTicket };
}
