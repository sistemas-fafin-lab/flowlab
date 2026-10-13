import React from 'react';
import { Check, type LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  titulo: string;
  descricao: string;
  /** O que a aba vai conter, para quem a abre antes de ela existir. */
  itens: string[];
}

/** Estado vazio explícito das abas que ainda não foram construídas (nunca uma tela em branco). */
const EmBreve: React.FC<Props> = ({ icon: Icon, titulo, descricao, itens }) => (
  <div
    className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/50 dark:border-slate-700/50 rounded-3xl shadow-sm p-8 sm:p-10 animate-fade-in-up"
    style={{ animationDelay: '0.2s' }}
  >
    <div className="max-w-lg mx-auto text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
        <Icon className="w-7 h-7 text-indigo-600 dark:text-indigo-300" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{titulo}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{descricao}</p>
      <ul className="mt-6 space-y-2 text-left">
        {itens.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-indigo-500 dark:text-indigo-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

export default EmBreve;
