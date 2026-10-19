import React from 'react';
import { CalendarClock } from 'lucide-react';
import type { RefechamentoAplis } from '../types';
import { formatData } from '../utils/formato';

// Aviso da aba Títulos: títulos cujo lote foi refechado no apLIS depois da
// emissão (.scratch/faturamento-pendencias-e-refechamento). Só aponta — quem
// tem canManageBilling aplica a emissão nova no "Atualizar"
// (RefechamentosAplicadosAviso); quem só visualiza fica com este aviso.

interface Props {
  refechamentos: RefechamentoAplis[];
  /** Quem pode editar ganha a dica de que o "Atualizar" aplica. */
  podeAplicar: boolean;
}

const RefechamentosAplisAviso: React.FC<Props> = ({ refechamentos, podeAplicar }) => {
  const quantidade = refechamentos.length;
  if (quantidade === 0) return null;

  return (
    <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-300">
      <p className="font-medium flex items-center gap-2">
        <CalendarClock className="w-4 h-4" />
        {quantidade} {quantidade === 1 ? 'título com lote refechado' : 'títulos com lote refechado'} no apLIS
      </p>
      <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
        {refechamentos.map((r) => (
          <li key={r.idNota} className="flex flex-wrap gap-x-2">
            <span>{r.operadora}</span>
            <span className="text-amber-700/80 dark:text-amber-300/80">
              {r.lotes.length === 1 ? 'lote' : 'lotes'} {r.lotes.join(', ')}
            </span>
            <span className="tabular-nums">
              emissão {formatData(r.emissaoAtual)} → fechamento {formatData(r.emissaoNova)}
            </span>
          </li>
        ))}
      </ul>
      {podeAplicar && (
        <p className="mt-2 text-xs">Clique em Atualizar para levar esses títulos ao mês do fechamento.</p>
      )}
    </div>
  );
};

export default RefechamentosAplisAviso;
