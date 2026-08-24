// Módulo Board — kanban genérico multi-departamento.
// Ver .scratch/board-multidepartamento/spec.md.

export { resolveBoardAccess } from './domain/resolveBoardAccess';
export type { BoardAccess, ResolveBoardAccessInput } from './domain/resolveBoardAccess';

export { default as BoardPage } from './components/BoardPage';
export { useBoards } from './hooks/useBoards';
export type { Board, BoardTicket, BoardTicketPriority, KanbanStatus } from './types';
