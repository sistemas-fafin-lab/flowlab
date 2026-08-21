import React from 'react';
import { User, CalendarClock } from 'lucide-react';
import type { BoardTicket, BoardTicketPriority } from '../types';

const PRIORITY_CONFIG: Record<BoardTicketPriority, { label: string; badge: string; dot: string }> = {
  low:      { label: 'Baixa',   badge: 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300',       dot: 'bg-gray-400' },
  medium:   { label: 'Média',   badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',       dot: 'bg-blue-500' },
  high:     { label: 'Alta',    badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  critical: { label: 'Crítica', badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',           dot: 'bg-red-500' },
};

function formatDueDate(dueDate: string | null): string | null {
  if (!dueDate) return null;
  return new Date(`${dueDate}T00:00:00`).toLocaleDateString('pt-BR');
}

/** Card apresentacional e read-only — sem drag handle, sem ações (ver ticket 05). */
export const BoardTicketCard: React.FC<{ ticket: BoardTicket }> = ({ ticket }) => {
  const priority = PRIORITY_CONFIG[ticket.priority];
  const dueDate = formatDueDate(ticket.due_date);

  return (
    <div className="relative w-full rounded-2xl border p-3 select-none bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
      <p className="text-sm font-medium text-slate-900 dark:text-white line-clamp-2 mb-2 leading-snug">{ticket.title}</p>

      {ticket.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{ticket.description}</p>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-md ${priority.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
          {priority.label}
        </span>
        {dueDate && (
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
            <CalendarClock className="w-3 h-3" />
            {dueDate}
          </span>
        )}
      </div>

      {ticket.responsible_name && (
        <div className="flex items-center gap-1.5 mt-2 min-w-0">
          <User className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{ticket.responsible_name}</span>
        </div>
      )}
    </div>
  );
};

export default BoardTicketCard;
