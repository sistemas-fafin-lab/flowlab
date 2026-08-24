import React, { useMemo, useState } from 'react';
import { Inbox, ListTodo, Play, Eye, CheckCircle2, KanbanSquare, Plus } from 'lucide-react';
import { Draggable, type DragStart, type DragUpdate, type DropResult } from '@hello-pangea/dnd';
import { KanbanBoard, type KanbanBoardColumnConfig } from '../../../components/shared/KanbanBoard';
import ConfirmDialog from '../../../components/ConfirmDialog';
import Notification from '../../../components/Notification';
import Select from '../../../components/Select';
import { useAuth } from '../../../hooks/useAuth';
import { useNotification } from '../../../hooks/useNotification';
import { useBoardAccess } from '../hooks/useBoardAccess';
import { useBoards } from '../hooks/useBoards';
import { useBoardTickets } from '../hooks/useBoardTickets';
import { BoardAccessDenied } from './BoardAccessDenied';
import { BoardTicketCard } from './BoardTicketCard';
import { BoardTicketFormModal } from './BoardTicketFormModal';
import type { BoardTicket, BoardTicketInput, KanbanStatus } from '../types';

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

type FormState = { mode: 'create'; column: KanbanStatus } | { mode: 'edit'; ticket: BoardTicket } | null;

/**
 * Tela "Board" — kanban do departamento do usuário logado. Ações de
 * escrita (criar/editar/mover/excluir) só ficam disponíveis quando
 * `canManage` é `true` (cargo com `canManageBoard`, ou `canManageAllBoards`
 * — ver `resolveBoardAccess`); a RLS de `board_tickets` bloqueia a escrita de
 * qualquer forma, então esconder os botões aqui é só UX, não a defesa real.
 * Quem tem `canManageAllBoards` vê um seletor de boards, mesmo havendo só um
 * cadastrado; caindo no primeiro board da lista por padrão.
 */
const BoardPage: React.FC = () => {
  const { userProfile } = useAuth();
  const access = useBoardAccess();
  const { boards, loading: loadingBoards } = useBoards();
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);

  const targetBoardId = useMemo(() => {
    if (access.kind === 'single') return access.boardId;
    if (access.kind === 'all') return selectedBoardId ?? boards[0]?.id ?? null;
    return null;
  }, [access, boards, selectedBoardId]);

  const canManage = access.kind === 'all' ? true : access.kind === 'single' ? access.canManage : false;

  const {
    tickets,
    loading: loadingTickets,
    error,
    createTicket,
    updateTicket,
    deleteTicket,
    moveTicket,
  } = useBoardTickets(targetBoardId, userProfile?.id ?? null);

  const { notification, showError, showSuccess, hideNotification } = useNotification();

  const [formState, setFormState] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<BoardTicket | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draggingOverColumn, setDraggingOverColumn] = useState<KanbanStatus | null>(null);
  const [isAnyDragging, setIsAnyDragging] = useState(false);

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

  const handleDragStart = (start: DragStart) => {
    setIsAnyDragging(true);
    setDraggingOverColumn(start.source.droppableId as KanbanStatus);
  };

  const handleDragUpdate = (update: DragUpdate) => {
    setDraggingOverColumn((update.destination?.droppableId as KanbanStatus | undefined) ?? null);
  };

  const handleDragEnd = async (result: DropResult) => {
    setIsAnyDragging(false);
    setDraggingOverColumn(null);

    const { source, destination, draggableId } = result;
    if (!destination) return;

    const { error: moveError } = await moveTicket(
      draggableId,
      source.droppableId as KanbanStatus,
      source.index,
      destination.droppableId as KanbanStatus,
      destination.index,
    );
    if (moveError) showError('Erro ao mover card', moveError);
  };

  const handleFormSubmit = async (input: BoardTicketInput) => {
    if (!formState) return;
    setSubmitting(true);
    const { error: submitError } =
      formState.mode === 'create'
        ? await createTicket(formState.column, input)
        : await updateTicket(formState.ticket.id, input);
    setSubmitting(false);

    if (submitError) {
      showError(formState.mode === 'create' ? 'Erro ao criar card' : 'Erro ao salvar card', submitError);
      return;
    }
    showSuccess(formState.mode === 'create' ? 'Card criado!' : 'Card atualizado!');
    setFormState(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);

    const { error: deleteError } = await deleteTicket(target.id);
    if (deleteError) showError('Erro ao excluir card', deleteError);
    else showSuccess('Card excluído!');
  };

  return (
    <div className="space-y-5 h-full">
      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent flex items-center gap-2.5">
            <KanbanSquare className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            {board?.label ?? 'Board'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {canManage ? 'Colunas e cards do seu board.' : 'Colunas e cards do seu board (somente visualização).'}
          </p>
        </div>

        {access.kind === 'all' && (
          <Select
            ariaLabel="Selecionar board"
            value={targetBoardId ?? ''}
            onChange={setSelectedBoardId}
            options={boards.map((b) => ({ value: b.id, label: b.label }))}
            controlClass="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-900 dark:text-gray-100"
            wrapperClass="shrink-0 min-w-[10rem]"
          />
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <KanbanBoard
        columns={COLUMNS}
        onDragStart={canManage ? handleDragStart : undefined}
        onDragUpdate={canManage ? handleDragUpdate : undefined}
        onDragEnd={canManage ? handleDragEnd : () => {}}
        draggingOverColumn={draggingOverColumn}
        isAnyDragging={isAnyDragging}
        getItemCount={(columnId) => ticketsByColumn[columnId as KanbanStatus]?.length ?? 0}
        isColumnEmpty={(columnId) => (ticketsByColumn[columnId as KanbanStatus]?.length ?? 0) === 0}
        emptyStateLabel="Nenhum card"
        renderColumnHeaderExtra={
          canManage
            ? (columnId) => (
                <button
                  type="button"
                  onClick={() => setFormState({ mode: 'create', column: columnId as KanbanStatus })}
                  className="mb-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50/60 dark:hover:bg-violet-900/15 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-600 transition-all duration-200"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar card
                </button>
              )
            : undefined
        }
        renderColumnContent={(columnId) =>
          (ticketsByColumn[columnId as KanbanStatus] ?? []).map((ticket, index) =>
            canManage ? (
              <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`outline-none block w-full ${snapshot.isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                  >
                    <BoardTicketCard
                      ticket={ticket}
                      onEdit={(t) => setFormState({ mode: 'edit', ticket: t })}
                      onDelete={(t) => setDeleteTarget(t)}
                    />
                  </div>
                )}
              </Draggable>
            ) : (
              <BoardTicketCard key={ticket.id} ticket={ticket} />
            ),
          )
        }
      />

      {formState && (
        <BoardTicketFormModal
          ticket={formState.mode === 'edit' ? formState.ticket : null}
          createInColumn={formState.mode === 'create' ? formState.column : null}
          boardId={targetBoardId}
          submitting={submitting}
          onSubmit={handleFormSubmit}
          onClose={() => setFormState(null)}
        />
      )}

      <ConfirmDialog
        isOpen={deleteTarget != null}
        title="Excluir card"
        message={`Tem certeza que deseja excluir "${deleteTarget?.title}"? Essa ação não pode ser desfeita.`}
        confirmText="Excluir"
        type="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default BoardPage;
