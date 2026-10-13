import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, KanbanSquare } from 'lucide-react';
import { Avatar, GlassCard, SectionHeader } from './ui';
import { KANBAN_STATUS_COLORS, KANBAN_STATUS_LABELS } from '../constants';
import { GRADIENTE_SEM_RESPONSAVEL } from '../domain/pessoas';
import type { EvaView, KanbanColumnSummary, TeamMember } from '../types';

interface Props {
  view: EvaView;
  columns: KanbanColumnSummary[];
  total: number;
  members: Record<string, TeamMember>;
  onOpenCard: (id: string) => void;
  footer?: React.ReactNode;
}

export const KanbanSummaryCard: React.FC<Props> = ({ view, columns, total, members, onOpenCard, footer }) => (
  <GlassCard>
    <SectionHeader
      icon={KanbanSquare}
      tone="from-blue-500 to-violet-600 shadow-blue-500/25"
      title="Board de TI"
      subtitle={view === 'me' ? `${total} cards seus, por coluna` : `${total} cards na equipe, por coluna`}
      right={
        <Link to="/it/kanban" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <ArrowUpRight className="w-4 h-4" />
          Abrir Board
        </Link>
      }
    />

    <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mb-5 mt-1 bg-slate-100 dark:bg-slate-800">
      {columns.map((c) => (
        <div key={c.key} className="h-full transition-[width] duration-300" style={{ width: `${(c.count / Math.max(total, 1)) * 100}%`, background: KANBAN_STATUS_COLORS[c.key] }} />
      ))}
    </div>

    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
      {columns.map((c) => (
        <div key={c.key} className="flex flex-col gap-2.5 p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: KANBAN_STATUS_COLORS[c.key] }} />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{KANBAN_STATUS_LABELS[c.key]}</span>
            </div>
            <span className="text-[22px] font-extrabold text-slate-900 dark:text-white tabular-nums leading-none">{c.count}</span>
          </div>
          {c.items.length === 0 && (
            <p className="px-1 text-[11px] text-slate-400 dark:text-slate-500">{c.key === 'done' ? 'Nada concluído nesta semana' : 'Coluna vazia'}</p>
          )}
          {c.items.map((it) => {
            const m = it.memberId ? members[it.memberId] : undefined;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onOpenCard(it.id)}
                title={`${it.codigo} · ${m?.name ?? 'Sem responsável'}`}
                className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700/50 shadow-[0_1px_2px_rgba(0,0,0,.03)] text-left hover:border-blue-500/30 transition-colors"
              >
                <Avatar initials={m?.initials ?? '—'} gradient={m?.gradient ?? GRADIENTE_SEM_RESPONSAVEL} />
                <span className="text-xs text-slate-700 dark:text-slate-300 leading-[1.35] line-clamp-2">{it.title}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
    {footer}
  </GlassCard>
);
