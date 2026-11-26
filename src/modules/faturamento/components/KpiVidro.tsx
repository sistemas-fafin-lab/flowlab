import React from 'react';
import { Info } from 'lucide-react';

// Card de número do Dashboard de Contas a Receber (vidro, ícone em gradiente),
// compartilhado com os cards de valor do Dashboard de glosa.

/** Vidro do Dashboard principal: fundo translúcido, desfoque e borda clara. */
export const VIDRO =
  'bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/50 dark:border-slate-700/50 shadow-sm';

export const Kpi: React.FC<{
  icon: React.ReactNode;
  label: string;
  valor: React.ReactNode;
  sub?: string;
  /** Linha extra sob o `sub` (ex.: observação das requisições não faturáveis). */
  extra?: React.ReactNode;
  /** Explicação do número, num ícone ao lado do rótulo (tooltip nativo). */
  dica?: string;
  cor: string;
  atraso?: number;
  /** Quando presente, o card vira um atalho de navegação (ex.: widget-resumo →
   *  aba Pendências) em vez de só exibir o número. */
  onClick?: () => void;
}> = ({ icon, label, valor, sub, extra, dica, cor, atraso = 0, onClick }) => {
  const clicavel = Boolean(onClick);
  return (
    // h-full: o card preenche a fatia que o widget lhe dá, então redimensionar o
    // widget redimensiona os cards em vez de criar faixa vazia em volta.
    <div
      role={clicavel ? 'button' : undefined}
      tabIndex={clicavel ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        clicavel
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={`relative overflow-hidden h-full flex items-center ${VIDRO} rounded-2xl sm:rounded-3xl px-3 py-3 sm:px-4 hover:shadow-xl hover:border-blue-200/60 dark:hover:border-blue-700/60 transition-all duration-300 hover-lift card-interactive animate-fade-in-up ${clicavel ? 'cursor-pointer' : ''}`}
      style={{ animationDelay: `${atraso * 0.05}s` }}
    >
      <div className="w-full flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span className="truncate">{label}</span>
            {dica && (
              <span title={dica} aria-label={dica} role="img" className="shrink-0 cursor-help normal-case">
                <Info className="w-3.5 h-3.5" />
              </span>
            )}
          </p>
          <p className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
            {valor}
          </p>
          {sub && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{sub}</p>}
          {extra}
        </div>
        <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg flex-shrink-0 bg-gradient-to-br ${cor}`}>
          <span className="text-white">{icon}</span>
        </div>
      </div>
    </div>
  );
};
