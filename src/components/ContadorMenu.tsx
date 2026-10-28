import React from 'react';

/** Contador vermelho ao lado de um item do menu (ex.: envios atrasados). Quem usa esconde quando zero. */
export const ContadorMenu: React.FC<{ valor: number; rotulo: string; className?: string }> = ({ valor, rotulo, className = '' }) => (
  <span
    aria-label={`${valor} ${rotulo}`}
    className={`min-w-[1.25rem] text-center text-[10px] font-bold px-1.5 py-px rounded-full text-white bg-red-500 ${className}`}
  >
    {valor > 99 ? '99+' : valor}
  </span>
);
