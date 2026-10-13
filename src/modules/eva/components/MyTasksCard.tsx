import React from 'react';
import { Calendar, Check } from 'lucide-react';
import { GlassCard, SectionHeader, StatusBadge } from './ui';
import type { DailyTask } from '../types';

interface Props {
  tasks: DailyTask[];
  doneCount: number;
  /** Marcar conclui o card de verdade (D23); desmarcar reabre. */
  onToggle: (id: string) => void;
  footer?: React.ReactNode;
}

// D23: as tasks do dia são cards (vencem hoje ou já venceram). Sem integração de
// agenda, o lugar do horário do protótipo fica com o código do card.
export const MyTasksCard: React.FC<Props> = ({ tasks, doneCount, onToggle, footer }) => (
  <GlassCard>
    <SectionHeader
      icon={Calendar}
      tone="from-cyan-500 to-blue-500 shadow-cyan-500/25"
      title="Minhas tasks do dia"
      subtitle={tasks.length === 0 ? 'Nada vence hoje' : `${doneCount} de ${tasks.length} concluídas`}
    />
    <div className="flex flex-col gap-1 flex-1">
      {tasks.length === 0 && (
        <p className="px-3 py-6 text-center text-[13px] text-slate-400 dark:text-slate-500">
          Nenhum card seu vence hoje nem está atrasado.
        </p>
      )}
      {tasks.map((t) => (
        <button
          key={t.id}
          type="button"
          role="checkbox"
          aria-checked={t.done}
          onClick={() => onToggle(t.id)}
          className="flex items-start gap-3 px-3 py-2.5 rounded-[14px] text-left w-full hover:bg-slate-50/90 dark:hover:bg-slate-800/50 transition-colors"
        >
          <span
            className={`w-5 h-5 mt-px rounded-md flex-shrink-0 flex items-center justify-center transition-all duration-200 ${
              t.done
                ? 'bg-gradient-to-br from-blue-500 to-indigo-500 shadow-md shadow-blue-500/30'
                : 'bg-white dark:bg-slate-900 border-[1.5px] border-slate-300 dark:border-slate-600'
            }`}
          >
            {t.done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
          </span>
          <span className="flex-1 min-w-0">
            <span className={`block text-[13px] font-medium ${t.done ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100'}`}>{t.title}</span>
            <span className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              <b className="font-semibold text-slate-600 dark:text-slate-300 tabular-nums">{t.codigo}</b>
              {t.project}
            </span>
          </span>
          {t.late && !t.done && <StatusBadge tone="danger">Atrasada</StatusBadge>}
        </button>
      ))}
    </div>
    {footer}
  </GlassCard>
);
