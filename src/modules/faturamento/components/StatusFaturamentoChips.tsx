import React from 'react';
import type { StatusFaturamentoResumo } from '../types';
import { corStatusFaturamento } from '../utils/corStatusFaturamento';

/** Resumo do Status Faturamento de um lote: um chip por status presente nas
 *  requisições, mais frequente primeiro. A quantidade fica só no tooltip.
 *  Usado nas tabelas de Faturas e de Pendências.
 *  `resumo` ausente (resposta de uma versão anterior da API, vinda de cache) vira
 *  "—" em vez de derrubar a tela inteira. */
const StatusFaturamentoChips: React.FC<{ resumo?: StatusFaturamentoResumo[] }> = ({ resumo = [] }) => (
  <div className="flex flex-wrap gap-1 max-w-[260px]">
    {resumo.length === 0 ? (
      <span className="text-gray-400">—</span>
    ) : (
      resumo.map((s) => (
        <span
          key={s.codigo}
          title={`${s.label}: ${s.qtd} requisiç${s.qtd === 1 ? 'ão' : 'ões'}`}
          className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${corStatusFaturamento(s.codigo, s.label)}`}
        >
          {s.label}
        </span>
      ))
    )}
  </div>
);

export default StatusFaturamentoChips;
