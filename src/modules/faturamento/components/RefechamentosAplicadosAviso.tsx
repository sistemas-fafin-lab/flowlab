import React from 'react';
import { CalendarCheck } from 'lucide-react';
import type { RefechamentoAplicado } from '../types';
import { formatData } from '../utils/formato';

// Aviso da aba Títulos depois do "Atualizar": títulos cuja emissão acompanhou
// o refechamento do lote no apLIS (.scratch/faturamento-pendencias-e-refechamento).
// Meta, Dashboard e "Ver títulos do mês" usam a emissão e mudam juntos.

interface Props {
  aplicados: RefechamentoAplicado[];
  onFechar: () => void;
}

const RefechamentosAplicadosAviso: React.FC<Props> = ({ aplicados, onFechar }) => {
  const quantidade = aplicados.length;
  if (quantidade === 0) return null;

  return (
    <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-700 dark:text-blue-300">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium flex items-center gap-2">
          <CalendarCheck className="w-4 h-4" />
          {quantidade} {quantidade === 1 ? 'título mudou' : 'títulos mudaram'} de mês por refechamento no apLIS
        </p>
        <button type="button" onClick={onFechar} className="text-xs underline">fechar</button>
      </div>
      <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
        {aplicados.map((r) => (
          <li key={r.idNota} className="flex flex-wrap gap-x-2">
            <span>{r.operadora}</span>
            <span className="text-blue-700/80 dark:text-blue-300/80">
              {r.lotes.length === 1 ? 'lote' : 'lotes'} {r.lotes.join(', ')}
            </span>
            <span className="tabular-nums">
              emissão {formatData(r.emissaoAntiga)} → {formatData(r.emissaoNova)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RefechamentosAplicadosAviso;
