import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { GlassCard, SectionHeader, Segmented, StatusBadge } from './ui';
import { PRIORITY_CONFIG } from '../constants';
import type { OverdueRow } from '../hooks/useEvaHome';
import type { OverdueFilter } from '../types';

interface Props {
  rows: OverdueRow[];
  filter: OverdueFilter;
  onFilterChange: (f: OverdueFilter) => void;
  onCharge: (row: OverdueRow) => void;
  footer?: React.ReactNode;
}

export const OverdueCard: React.FC<Props> = ({ rows, filter, onFilterChange, onCharge, footer }) => (
  <GlassCard>
    <SectionHeader
      icon={AlertTriangle}
      tone="from-red-500 to-rose-600 shadow-red-500/25"
      title="Atrasadas e cobranças"
      subtitle="EVA cobra pelo WhatsApp em nome do gestor"
      right={
        <Segmented<OverdueFilter>
          size="sm"
          value={filter}
          onChange={onFilterChange}
          options={[{ value: 'all', label: 'Todas' }, { value: 'critical', label: 'Crítica e alta' }]}
        />
      }
    />
    <div className="flex flex-col gap-1.5 flex-1">
      {rows.map((r) => {
        const pr = PRIORITY_CONFIG[r.priority];
        return (
          <div key={r.id} className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-700/40 transition-colors">
            <span title={pr.label} className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: pr.color, boxShadow: `0 0 0 4px ${pr.ring}` }} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate">{r.title}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{r.project} · {r.memberName}</p>
              <p className={`mt-1 text-[11px] ${r.charged ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>{r.statusText}</p>
            </div>
            <StatusBadge tone="danger">{r.lateLabel}</StatusBadge>
            <button
              type="button"
              disabled={r.charged}
              onClick={() => onCharge(r)}
              className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold whitespace-nowrap flex-shrink-0 border transition-colors ${
                r.charged
                  ? 'cursor-default border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:border-slate-300'
              }`}
            >
              {r.charged ? 'Cobrada' : r.isMine ? 'Lembrar' : 'Cobrar'}
            </button>
          </div>
        );
      })}
    </div>
    {footer}
  </GlassCard>
);
