import React from 'react';
import { AlertTriangle, CheckCircle2, FolderOpen, KanbanSquare, MessageCircle } from 'lucide-react';
import type { StatCardData, StatKey } from '../types';

// Mesmo padrão de statCards do ITHubDashboard
const STYLE: Record<StatKey, { icon: React.ComponentType<{ className?: string }>; color: string; shadow: string; ring: string; flare: string }> = {
  open: { icon: KanbanSquare, color: 'bg-gradient-to-br from-blue-500 to-blue-600', shadow: 'shadow-blue-500/30', ring: 'ring-blue-500/20', flare: 'bg-blue-500' },
  overdue: { icon: AlertTriangle, color: 'bg-gradient-to-br from-red-500 to-rose-600', shadow: 'shadow-red-500/30', ring: 'ring-red-500/20', flare: 'bg-red-500' },
  done: { icon: CheckCircle2, color: 'bg-gradient-to-br from-emerald-500 to-green-600', shadow: 'shadow-emerald-500/30', ring: 'ring-emerald-500/20', flare: 'bg-emerald-500' },
  today: { icon: CheckCircle2, color: 'bg-gradient-to-br from-emerald-500 to-green-600', shadow: 'shadow-emerald-500/30', ring: 'ring-emerald-500/20', flare: 'bg-emerald-500' },
  charges: { icon: MessageCircle, color: 'bg-gradient-to-br from-violet-500 to-violet-600', shadow: 'shadow-violet-500/30', ring: 'ring-violet-500/20', flare: 'bg-violet-500' },
  projects: { icon: FolderOpen, color: 'bg-gradient-to-br from-violet-500 to-violet-600', shadow: 'shadow-violet-500/30', ring: 'ring-violet-500/20', flare: 'bg-violet-500' },
};

export const EvaStatCards: React.FC<{ stats: StatCardData[] }> = ({ stats }) => (
  <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
    {stats.map((card, i) => {
      const st = STYLE[card.key];
      const Icon = st.icon;
      return (
        <div
          key={card.key}
          className="relative overflow-hidden bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/50 dark:border-slate-700/50 rounded-3xl p-5 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 animate-fade-in-up"
          style={{ animationDelay: `${0.1 + i * 0.06}s` }}
        >
          <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 ${st.flare}`} />
          <div className={`relative w-10 h-10 ${st.color} rounded-xl flex items-center justify-center shadow-lg ${st.shadow} ring-4 ${st.ring} mb-4`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="text-[44px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-none mb-2 tabular-nums">{card.value}</div>
          <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{card.label}</p>
          <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">{card.hint}</p>
        </div>
      );
    })}
  </div>
);
