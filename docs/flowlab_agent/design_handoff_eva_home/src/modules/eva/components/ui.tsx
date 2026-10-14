import React from 'react';
import { Mic } from 'lucide-react';
import type { BadgeTone } from '../types';

// Mesmo triplet do Badge do design system: bg {cor}-500/10 · texto {cor}-600 · borda {cor}-500/20
const TONES: Record<BadgeTone, string> = {
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  danger: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  neutral: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20',
};

export const StatusBadge: React.FC<React.PropsWithChildren<{ tone?: BadgeTone }>> = ({ tone = 'neutral', children }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-[3px] text-[11px] font-semibold rounded-full border tracking-[.01em] whitespace-nowrap flex-shrink-0 ${TONES[tone]}`}>
    <span className="w-1.5 h-1.5 rounded-full bg-current" />
    {children}
  </span>
);

/** Card de vidro do módulo de TI (mesmas classes do ITHubDashboard) */
export const GlassCard: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className = '', children }) => (
  <div className={`bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/50 dark:border-slate-700/50 rounded-3xl p-6 shadow-sm flex flex-col ${className}`}>
    {children}
  </div>
);

interface SectionHeaderProps {
  icon: React.ComponentType<{ className?: string }>;
  /** Classes do gradiente + glow do ícone, ex.: "from-blue-500 to-violet-600 shadow-blue-500/25" */
  tone: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ icon: Icon, tone, title, subtitle, right }) => (
  <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
    <div className="flex items-center gap-3">
      <div className={`p-2 bg-gradient-to-br rounded-xl shadow-lg ${tone}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <h4 className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">{title}</h4>
        {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>}
      </div>
    </div>
    {right}
  </div>
);

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

/** Seletor segmentado do Hub de Aplicações (Sites/Apps) */
export function Segmented<T extends string>({
  options, value, onChange, size = 'md',
}: { options: SegmentedOption<T>[]; value: T; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="flex bg-slate-200/50 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-1 shadow-inner border border-white/20 dark:border-slate-700/30">
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`inline-flex items-center gap-1.5 font-semibold rounded-lg transition-all duration-200 ${
            size === 'sm' ? 'px-3 py-[5px] text-xs' : 'px-4 py-1.5 text-sm'
          } ${
            value === v
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </button>
      ))}
    </div>
  );
}

/** Botão de microfone: fica vermelho com anel enquanto o ditado está ativo. */
export const MicButton: React.FC<{ active: boolean; onClick: () => void; size?: number }> = ({ active, onClick, size = 40 }) => (
  <button
    type="button"
    onClick={onClick}
    title={active ? 'Parar ditado' : 'Falar com a EVA'}
    aria-pressed={active}
    style={{ width: size, height: size }}
    className={`flex-shrink-0 flex items-center justify-center rounded-xl transition-all duration-200 ${
      active
        ? 'bg-red-500/10 text-red-500 ring-4 ring-red-500/[.12]'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
    }`}
  >
    <Mic className={size >= 40 ? 'w-[18px] h-[18px]' : 'w-4 h-4'} />
  </button>
);

export const VoiceNotice: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className = '', children }) => (
  <p role="status" className={`text-xs text-red-600 dark:text-red-400 ${className}`}>{children}</p>
);

export const Avatar: React.FC<{ initials: string; gradient: string; size?: number }> = ({ initials, gradient, size = 22 }) => (
  <span
    className="rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
    style={{ width: size, height: size, background: gradient }}
  >
    {initials}
  </span>
);
