import React from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';

/** Estado vazio dos cartões: ícone num disco suave + uma frase. Mesmo desenho em todo o painel. */
const Vazio: React.FC<{ children: React.ReactNode; icone?: LucideIcon; tom?: 'neutro' | 'bom' }> = ({ children, icone: Icone = Inbox, tom = 'neutro' }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
    <span
      className={`inline-flex w-11 h-11 items-center justify-center rounded-2xl ${
        tom === 'bom'
          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-200/70 dark:ring-emerald-500/20'
          : 'bg-slate-100/80 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 ring-1 ring-slate-200/70 dark:ring-slate-700/50'
      }`}
      aria-hidden="true"
    >
      <Icone className="w-5 h-5" />
    </span>
    <p className={`max-w-xs text-sm ${tom === 'bom' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>{children}</p>
  </div>
);

export default Vazio;
