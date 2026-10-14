import React from 'react';
import { RefreshCw, User, Users } from 'lucide-react';
import { Segmented } from './ui';
import type { EvaView, IntegrationStatus } from '../types';

interface EvaControlsProps {
  view: EvaView;
  onViewChange: (v: EvaView) => void;
  integrations: IntegrationStatus[];
  loading?: boolean;
  onRefresh?: () => void;
}

export const EvaControls: React.FC<EvaControlsProps> = ({ view, onViewChange, integrations, loading, onRefresh }) => (
  <div className="flex items-center justify-between gap-4 flex-wrap">
    <Segmented<EvaView>
      value={view}
      onChange={onViewChange}
      options={[
        { value: 'team', label: 'Equipe', icon: Users },
        { value: 'me', label: 'Minha visão', icon: User },
      ]}
    />
    <div className="flex items-center gap-2 flex-wrap">
      {integrations.map((it) => (
        <div key={it.id} className="inline-flex items-center gap-2 px-3 py-[7px] rounded-xl bg-white/60 dark:bg-slate-900/60 border border-white/50 dark:border-slate-700/50 backdrop-blur-2xl text-xs text-slate-600 dark:text-slate-300">
          <span className={`w-2 h-2 rounded-full ${it.online ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <b className="font-semibold text-slate-800 dark:text-slate-100">{it.name}</b>
          {it.detail}
        </div>
      ))}
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        title="Atualizar"
        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-all disabled:opacity-50 border border-transparent hover:border-slate-200/60 dark:hover:border-slate-600/60"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  </div>
);
