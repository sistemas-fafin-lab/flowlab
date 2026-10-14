import React from 'react';
import { FolderOpen } from 'lucide-react';
import { GlassCard, SectionHeader, StatusBadge } from './ui';
import { PROJECT_STATUS_CONFIG } from '../constants';
import type { ProjectSummary } from '../types';

export const ProjectsCard: React.FC<{ projects: ProjectSummary[]; footer?: React.ReactNode }> = ({ projects, footer }) => (
  <GlassCard>
    <SectionHeader
      icon={FolderOpen}
      tone="from-indigo-500 to-violet-600 shadow-indigo-500/25"
      title="Projetos em andamento"
      subtitle="Progresso do sprint atual"
    />
    <div className="flex flex-col gap-2 flex-1">
      {projects.length === 0 && (
        <p className="px-4 py-6 text-center text-[13px] text-slate-400 dark:text-slate-500">
          Nenhum projeto com sprint ativa ou card aberto.
        </p>
      )}
      {projects.map((p) => {
        const st = PROJECT_STATUS_CONFIG[p.status];
        const pct = Math.round((p.done / Math.max(p.total, 1)) * 100);
        return (
          <div key={p.id} className="flex flex-wrap items-center gap-x-5 gap-y-2.5 px-4 py-3.5 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-700/40 transition-colors">
            <div className="flex-[1_1_240px] min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
                <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
              </div>
              <p className="mt-[3px] text-xs text-slate-500 dark:text-slate-400">{p.sprint} · {p.done}/{p.total} tasks · {p.due === '—' ? 'sem prazo' : `prazo ${p.due}`}</p>
            </div>
            <div className="flex-[1_1_160px] max-w-[260px] flex items-center gap-2.5">
              <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: st.bar }} />
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 w-[34px] text-right tabular-nums">{pct}%</span>
            </div>
          </div>
        );
      })}
    </div>
    {footer}
  </GlassCard>
);
