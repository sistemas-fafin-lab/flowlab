// Tipos do módulo Board — kanban genérico multi-departamento.
// Ver .scratch/board-multidepartamento/spec.md.

export type KanbanStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';

export type BoardTicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Board {
  id: string;
  slug: string;
  label: string;
}

export interface BoardTicket {
  id: string;
  board_id: string;
  title: string;
  description: string | null;
  responsible_id: string | null;
  responsible_name: string | null;
  due_date: string | null;
  priority: BoardTicketPriority;
  kanban_status: KanbanStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}
