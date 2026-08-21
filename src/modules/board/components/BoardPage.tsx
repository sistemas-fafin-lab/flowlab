import React, { useMemo } from 'react';
import { Inbox, ListTodo, Play, Eye, CheckCircle2, KanbanSquare } from 'lucide-react';
import { KanbanBoard, type KanbanBoardColumnConfig } from '../../../components/shared/KanbanBoard';
import { useBoardAccess } from '../hooks/useBoardAccess';
import { useBoards } from '../hooks/useBoards';
import { useBoardTickets } from '../hooks/useBoardTickets';
import { BoardAccessDenied } from './BoardAccessDenied';
import { BoardTicketCard } from './BoardTicketCard';
import type { BoardTicket, KanbanStatus } from '../types';

// Mesmo template fixo de colunas para todos os boards (spec — sem
// customização por departamento no v1).
const COLUMNS: KanbanBoardColumnConfig[] = [
  { id: 'backlog',     label: 'Backlog',      icon: Inbox,        accent: 'text-gray-500 dark:text-gray-400',      dotColor: 'bg-gray-400' },
  { id: 'todo',        label: 'A Fazer',      icon: ListTodo,     accent: 'text-blue-600 dark:text-blue-400',      dotColor: 'bg-blue-500' },
  { id: 'in_progress', label: 'Em Progresso', icon: Play,         accent: 'text-amber-600 dark:text-amber-400',    dotColor: 'bg-amber-500' },
  { id: 'review',      label: 'Revisão',      icon: Eye,          accent: 'text-violet-600 dark:text-violet-400',  dotColor: 'bg-violet-500' },
  { id: 'done',        label: 'Concluído',    icon: CheckCircle2, accent: 'text-emerald-600 dark:text-emerald-400', dotColor: 'bg-emerald-500' },
];

const BoardLoading: React.FC = () => (
  <div className="flex items-center justify-center h-64">
    <div className="flex flex-col items-center">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-violet-600 border-t-transparent" />
      <span className="mt-3 text-gray-500 dark:text-gray-400 font-medium">Carregando quadro…</span>
    </div>
  </div>
);

function groupByColumn(tickets: BoardTicket[]): Record<KanbanStatus, BoardTicket[]> {
  const grouped: Record<KanbanStatus, BoardTicket[]> = {
    backlog: [],
    todo: [],
    in_progress: [],
    review: [],
    done: [],
  };
  tickets.forEach((ticket) => {
    grouped[ticket.kanban_status]?.push(ticket);
  });
  return grouped;
}

/**
 * Tela "Board" — visualização read-only do kanban do departamento do
 * usuário logado. Ações de escrita (criar/mover/editar/excluir) ficam para
 * o ticket 05; seletor para quem enxerga mais de um board (canManageAllBoards
 * com múltiplos boards cadastrados) fica para o ticket 06 — hoje, nesse
 * caso, cai direto no primeiro board da lista.
 */
const BoardPage: React.FC = () => {
  const access = useBoardAccess();
  const { boards, loading: loadingBoards } = useBoards();

  const targetBoardId = useMemo(() => {
    if (access.kind === 'single') return access.boardId;
    if (access.kind === 'all') return boards[0]?.id ?? null;
    return null;
  }, [access, boards]);

  const { tickets, loading: loadingTickets, error } = useBoardTickets(targetBoardId);

  if (access.kind === 'none') {
    return <BoardAccessDenied />;
  }

  if (access.kind === 'all' && loadingBoards) {
    return <BoardLoading />;
  }

  if (access.kind === 'all' && boards.length === 0) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-12">
        Nenhum board cadastrado ainda.
      </div>
    );
  }

  if (loadingTickets) {
    return <BoardLoading />;
  }

  const board = boards.find((b) => b.id === targetBoardId);
  const ticketsByColumn = groupByColumn(tickets);

  return (
    <div className="space-y-5 h-full">
      <div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent flex items-center gap-2.5">
          <KanbanSquare className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          {board?.label ?? 'Board'}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Colunas e cards do seu board.</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <KanbanBoard
        columns={COLUMNS}
        onDragEnd={() => {}}
        getItemCount={(columnId) => ticketsByColumn[columnId as KanbanStatus]?.length ?? 0}
        isColumnEmpty={(columnId) => (ticketsByColumn[columnId as KanbanStatus]?.length ?? 0) === 0}
        emptyStateLabel="Nenhum card"
        renderColumnContent={(columnId) =>
          (ticketsByColumn[columnId as KanbanStatus] ?? []).map((ticket) => (
            <BoardTicketCard key={ticket.id} ticket={ticket} />
          ))
        }
      />
    </div>
  );
};

export default BoardPage;
