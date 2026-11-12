import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Paleta semântica das worklists de Qualidade (Ocorrências, Cortesias, IHQ,
 * Câncer) — mesma tinta translúcida em claro/escuro: fundo ~12%, borda ~30%,
 * texto forte no tema claro e pastel no escuro. Classes estáticas (não
 * interpoladas) para o Tailwind enxergar no build.
 */
export type Tom = 'amber' | 'emerald' | 'blue' | 'indigo' | 'red' | 'rose' | 'purple' | 'slate' | 'apagado';

export const TOM: Record<Tom, { pilula: string; texto: string; solido: string; faixa: string; anel: string }> = {
  amber: {
    pilula: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    texto: 'text-amber-700 dark:text-amber-300',
    solido: 'bg-amber-500',
    faixa: 'shadow-[inset_3px_0_0_theme(colors.amber.500),inset_-1px_0_0_rgba(148,163,184,.2)]',
    anel: 'ring-2 ring-amber-500',
  },
  emerald: {
    pilula: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    texto: 'text-emerald-700 dark:text-emerald-300',
    solido: 'bg-emerald-500',
    faixa: 'shadow-[inset_3px_0_0_theme(colors.emerald.500),inset_-1px_0_0_rgba(148,163,184,.2)]',
    anel: 'ring-2 ring-emerald-500',
  },
  blue: {
    pilula: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
    texto: 'text-blue-700 dark:text-blue-300',
    solido: 'bg-blue-500',
    faixa: 'shadow-[inset_3px_0_0_theme(colors.blue.500),inset_-1px_0_0_rgba(148,163,184,.2)]',
    anel: 'ring-2 ring-blue-500',
  },
  indigo: {
    pilula: 'border-indigo-500/35 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    texto: 'text-indigo-700 dark:text-indigo-300',
    solido: 'bg-indigo-500',
    faixa: 'shadow-[inset_3px_0_0_theme(colors.indigo.500),inset_-1px_0_0_rgba(148,163,184,.2)]',
    anel: 'ring-2 ring-indigo-500',
  },
  red: {
    pilula: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
    texto: 'text-red-700 dark:text-red-300',
    solido: 'bg-red-500',
    faixa: 'shadow-[inset_3px_0_0_theme(colors.red.500),inset_-1px_0_0_rgba(148,163,184,.2)]',
    anel: 'ring-2 ring-red-500',
  },
  rose: {
    pilula: 'border-rose-500/40 bg-rose-500/15 text-rose-800 dark:text-rose-200',
    texto: 'text-rose-800 dark:text-rose-200',
    solido: 'bg-rose-500',
    faixa: 'shadow-[inset_3px_0_0_theme(colors.rose.500),inset_-1px_0_0_rgba(148,163,184,.2)]',
    anel: 'ring-2 ring-rose-500',
  },
  purple: {
    pilula: 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300',
    texto: 'text-purple-700 dark:text-purple-300',
    solido: 'bg-purple-500',
    faixa: 'shadow-[inset_3px_0_0_theme(colors.purple.500),inset_-1px_0_0_rgba(148,163,184,.2)]',
    anel: 'ring-2 ring-purple-500',
  },
  slate: {
    pilula: 'border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300',
    texto: 'text-slate-600 dark:text-slate-300',
    solido: 'bg-slate-400',
    faixa: 'shadow-[inset_3px_0_0_theme(colors.slate.400),inset_-1px_0_0_rgba(148,163,184,.2)]',
    anel: 'ring-2 ring-slate-400',
  },
  apagado: {
    pilula: 'border-slate-500/30 bg-transparent text-gray-500 dark:text-slate-400',
    texto: 'text-gray-500 dark:text-slate-400',
    solido: 'bg-slate-400',
    faixa: 'shadow-[inset_3px_0_0_theme(colors.slate.400),inset_-1px_0_0_rgba(148,163,184,.2)]',
    anel: 'ring-2 ring-slate-400',
  },
};

/** Texto secundário (sub-linha das células). */
export const TEXTO_FRACO = 'text-xs text-gray-500 dark:text-slate-400';
/** Texto principal de destaque (nome do paciente, valor). */
export const TEXTO_FORTE = 'text-gray-900 dark:text-slate-100';

export function Pilula({ tom, icone: Icone, children, title }: { tom: Tom; icone?: LucideIcon; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border py-0.5 text-xs font-semibold ${Icone ? 'pl-2 pr-2.5' : 'px-2.5'} ${TOM[tom].pilula}`}
    >
      {Icone && <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      {children}
    </span>
  );
}

/** Campo de curadoria ainda vazio — tracejado, nunca "—", para deixar claro que falta classificar. */
export function ChipAClassificar() {
  return (
    <span className="inline-flex whitespace-nowrap rounded-md border border-dashed border-blue-300 px-2 text-xs leading-[18px] text-gray-500 dark:border-blue-400/40 dark:text-slate-400">
      A classificar
    </span>
  );
}

/** Etiqueta pequena sem borda (ajustado, divergência, revisão pendente). */
export function Etiqueta({ tom, children }: { tom: Tom; children: ReactNode }) {
  const cor: Partial<Record<Tom, string>> = {
    blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    purple: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
    red: 'bg-red-500/10 text-red-700 dark:text-red-300',
  };
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-medium leading-[18px] ${cor[tom] ?? TOM[tom].pilula}`}>
      {children}
    </span>
  );
}
