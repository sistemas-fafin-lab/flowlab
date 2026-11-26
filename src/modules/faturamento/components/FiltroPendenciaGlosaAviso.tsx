import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { FiltroPendenciaGlosa } from '../types';
import { formatCompetencia } from '../utils/formato';
import { ROTULOS_PENDENCIA } from '../utils/recursoGlosaVisual';

// Faixa sobre as listas "Recursos fora de lote" e "Lotes de recurso" quando há
// filtro de pendência (issue 06): a lista é a do card das Pendências de glosa,
// de todos os meses de faturamento, e o período do cabeçalho não vale.

interface Props {
  filtro: FiltroPendenciaGlosa;
  onFiltro: (filtro: FiltroPendenciaGlosa | null) => void;
}

const FiltroPendenciaGlosaAviso: React.FC<Props> = ({ filtro, onFiltro }) => (
  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
    <p className="text-sm text-amber-800 dark:text-amber-200 flex-1 min-w-[12rem]">
      <span className="font-semibold">{ROTULOS_PENDENCIA[filtro.tipo]}</span>
      {filtro.mes ? <> · vencido em {formatCompetencia(filtro.mes)}</> : <> · todo o período</>}
      {' '}— de todos os meses de faturamento; o período do cabeçalho não filtra esta lista.
    </p>
    {filtro.mes && (
      <button
        type="button"
        onClick={() => onFiltro({ ...filtro, mes: null })}
        className="px-3 py-1 rounded-lg border border-amber-300 dark:border-amber-700 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
      >
        Todo o período
      </button>
    )}
    <button
      type="button"
      onClick={() => onFiltro(null)}
      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-amber-300 dark:border-amber-700 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
    >
      <X className="h-3.5 w-3.5" /> Limpar filtro
    </button>
  </div>
);

export default FiltroPendenciaGlosaAviso;
