import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { EstadoOrdenacao } from './ordenacao';

function IconeOrdenacao({ ativo, direcao }: { ativo: boolean; direcao: EstadoOrdenacao['direcao'] }) {
  if (!ativo || !direcao) return <ArrowUpDown className="w-3 h-3 opacity-40" aria-hidden />;
  return direcao === 'asc' ? (
    <ArrowUp className="w-3 h-3" aria-hidden />
  ) : (
    <ArrowDown className="w-3 h-3" aria-hidden />
  );
}

export function CabecalhoOrdenavel<Coluna extends string>({
  coluna,
  titulo,
  ordenacao,
  onClick,
  align = 'left',
  className = '',
}: {
  coluna: Coluna;
  titulo: React.ReactNode;
  ordenacao: EstadoOrdenacao;
  onClick: (coluna: Coluna) => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  const ativo = ordenacao.coluna === coluna;
  return (
    <th className={`px-5 py-3 font-bold ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}>
      <button
        type="button"
        onClick={() => onClick(coluna)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-slate-700 dark:hover:text-slate-200 ${
          align === 'right' ? 'flex-row-reverse' : ''
        }`}
      >
        {titulo}
        <IconeOrdenacao ativo={ativo} direcao={ativo ? ordenacao.direcao : null} />
      </button>
    </th>
  );
}
