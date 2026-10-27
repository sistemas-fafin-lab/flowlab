import React from 'react';
import type { DivergenciaAplis, TituloReceber } from '../types';
import { COR_TIPO, seloDivergencia } from '../utils/conferenciaAplis';

/** Badge de atraso. Só aparece quando há vencimento e o título ainda tem saldo. */
export const Atraso: React.FC<{ titulo: TituloReceber }> = ({ titulo }) => {
  if (titulo.diasAtraso === null || titulo.valorSaldo <= 0) return null;
  if (titulo.status === 'cancelada') return null;

  if (titulo.diasAtraso > 0) {
    return (
      <span className="text-xs text-rose-600 dark:text-rose-400 whitespace-nowrap">
        {titulo.diasAtraso}d em atraso
      </span>
    );
  }
  return (
    <span className="text-xs text-gray-400 whitespace-nowrap">
      vence em {Math.abs(titulo.diasAtraso)}d
    </span>
  );
};

/** Selo do título divergente do apLIS; os dois valores no tooltip. */
export const SeloAplis: React.FC<{ divergencia: DivergenciaAplis }> = ({ divergencia }) => {
  const selo = seloDivergencia(divergencia);
  return (
    <div className="mt-1">
      <span
        title={selo.detalhe}
        className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${COR_TIPO[divergencia.tipo]}`}
      >
        {selo.texto}
      </span>
    </div>
  );
};
