import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import Select from '../../../components/Select';
import DatePicker from '../../../components/DatePicker';
import { useBoardUsers } from '../hooks/useBoardUsers';
import type { BoardTicket, BoardTicketInput, BoardTicketPriority, KanbanStatus } from '../types';

const CAMPO =
  'mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100';

const PRIORITY_OPTIONS: { value: BoardTicketPriority; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

function emptyInput(): BoardTicketInput {
  return { title: '', description: null, responsible_id: null, due_date: null, priority: 'medium' };
}

function inputFromTicket(ticket: BoardTicket): BoardTicketInput {
  return {
    title: ticket.title,
    description: ticket.description,
    responsible_id: ticket.responsible_id,
    due_date: ticket.due_date,
    priority: ticket.priority,
  };
}

interface BoardTicketFormModalProps {
  /** Card em edição, ou `null` para criar um card novo em `createInColumn`. */
  ticket: BoardTicket | null;
  createInColumn: KanbanStatus | null;
  submitting: boolean;
  onSubmit: (input: BoardTicketInput) => void;
  onClose: () => void;
}

export const BoardTicketFormModal: React.FC<BoardTicketFormModalProps> = ({
  ticket,
  createInColumn,
  submitting,
  onSubmit,
  onClose,
}) => {
  const { users } = useBoardUsers();
  const isEdit = ticket != null;
  const [input, setInput] = useState<BoardTicketInput>(() => (ticket ? inputFromTicket(ticket) : emptyInput()));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setInput(ticket ? inputFromTicket(ticket) : emptyInput());
    setFormError(null);
  }, [ticket, createInColumn]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.title.trim()) {
      setFormError('Título é obrigatório.');
      return;
    }
    setFormError(null);
    onSubmit({ ...input, title: input.title.trim(), description: input.description?.trim() || null });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            {isEdit ? 'Editar card' : 'Novo card'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <label className="block text-xs text-gray-500 dark:text-gray-400">
            Título *
            <input
              type="text"
              value={input.title}
              onChange={(e) => setInput((prev) => ({ ...prev, title: e.target.value }))}
              className={CAMPO}
              autoFocus
            />
          </label>

          <label className="block text-xs text-gray-500 dark:text-gray-400">
            Descrição
            <textarea
              value={input.description ?? ''}
              onChange={(e) => setInput((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className={CAMPO}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs text-gray-500 dark:text-gray-400">
              Responsável
              <Select
                value={input.responsible_id ?? ''}
                onChange={(v) => setInput((prev) => ({ ...prev, responsible_id: v || null }))}
                options={[{ value: '', label: 'Sem responsável' }, ...users.map((u) => ({ value: u.id, label: u.name }))]}
                controlClass={CAMPO}
              />
            </label>

            <label className="block text-xs text-gray-500 dark:text-gray-400">
              Prazo
              <DatePicker
                value={input.due_date ?? ''}
                onChange={(v) => setInput((prev) => ({ ...prev, due_date: v || null }))}
                controlClass={CAMPO}
                allowClear
              />
            </label>
          </div>

          <label className="block text-xs text-gray-500 dark:text-gray-400">
            Prioridade
            <Select
              value={input.priority}
              onChange={(v) => setInput((prev) => ({ ...prev, priority: v as BoardTicketPriority }))}
              options={PRIORITY_OPTIONS}
              controlClass={CAMPO}
            />
          </label>

          {formError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Salvar' : 'Criar card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BoardTicketFormModal;
