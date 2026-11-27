import React from 'react';

// Moldura dos gráficos do Dashboard de glosa (título, subtítulo, ação à direita)
// e o estado vazio deles.

export const CARD = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5';

export const Painel: React.FC<{ titulo: string; sub?: string; acao?: React.ReactNode; className?: string; children: React.ReactNode }> = ({
  titulo,
  sub,
  acao,
  className = '',
  children,
}) => (
  <div className={`${CARD} flex flex-col ${className}`}>
    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{titulo}</h3>
        {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {acao}
    </div>
    <div className="flex-1 min-h-0">{children}</div>
  </div>
);

export const Vazio: React.FC<{ icon: React.ReactNode; texto: string }> = ({ icon, texto }) => (
  <div className="h-full min-h-[12rem] flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500">
    <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center mb-2">{icon}</div>
    <p className="text-sm">{texto}</p>
  </div>
);
