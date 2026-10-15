import React from 'react';

/**
 * Chave liga/desliga do design system, no lugar do checkbox nativo (que o sistema operacional
 * desenha e não acompanha o tema escuro). É um botão com role="switch": Espaço e Enter alternam,
 * e dentro de um <label> o clique no texto também alterna.
 */

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  /** usado quando não há <label> envolvendo ou apontando para a chave */
  ariaLabel?: string;
  /** dica no hover (ex.: por que está desabilitada) */
  title?: string;
  size?: 'sm' | 'md';
}

// Trilho com p-0.5 e sem borda: a bola anda a largura interna menos o próprio tamanho.
const TAMANHOS = {
  sm: { trilho: 'w-8 h-5', bola: 'w-4 h-4', ligada: 'translate-x-3' },
  md: { trilho: 'w-10 h-6', bola: 'w-5 h-5', ligada: 'translate-x-4' },
} as const;

const Switch: React.FC<SwitchProps> = ({ checked, onChange, disabled, id, ariaLabel, title, size = 'md' }) => {
  const s = TAMANHOS[size];
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex flex-shrink-0 items-center ${s.trilho} p-0.5 rounded-full transition-colors duration-200 outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? 'bg-gradient-to-r from-blue-500 to-indigo-500 shadow-sm shadow-blue-500/30'
          : 'bg-slate-200 dark:bg-slate-700 ring-1 ring-inset ring-slate-300/70 dark:ring-slate-600/70'
      }`}
    >
      <span
        aria-hidden
        className={`${s.bola} rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? s.ligada : 'translate-x-0'}`}
      />
    </button>
  );
};

export default Switch;
