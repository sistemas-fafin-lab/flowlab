import React from 'react';
import { formatCurrency } from '../../../../utils/paymentUtils';
import BarraAnimada from '../ui/BarraAnimada';

interface ParProps {
  titulo: string;
  a: { rotulo: string; valor: number; cor: string };
  b: { rotulo: string; valor: number; cor: string };
}

/**
 * Uma proporção de duas partes como barra 100% rotulada — nunca pizza de duas
 * fatias (dataviz). 2px de respiro entre os segmentos; rótulos com valor e %
 * fora da barra, para não depender de caber dentro dela.
 */
const Par: React.FC<ParProps> = ({ titulo, a, b }) => {
  const total = a.valor + b.valor;
  const pa = total ? (a.valor / total) * 100 : 0;
  const pct = (p: number) => `${p.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`;
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">{titulo}</p>
      {total === 0 ? (
        <p className="text-xs text-slate-400">Sem gasto no período.</p>
      ) : (
        <>
          <div className="flex h-3 gap-0.5" role="img" aria-label={`${a.rotulo} ${pct(pa)}, ${b.rotulo} ${pct(100 - pa)}`}>
            {a.valor > 0 && <BarraAnimada largura={pa} cor={a.cor} className="rounded-l-md" />}
            {b.valor > 0 && <BarraAnimada largura={100 - pa} cor={b.cor} origem="direita" indice={1} className="rounded-r-md" />}
          </div>
          <div className="mt-1.5 flex justify-between gap-3 text-xs">
            {[{ ...a, p: pa }, { ...b, p: 100 - pa }].map((parte, i) => (
              <span key={parte.rotulo} className={`inline-flex items-center gap-1.5 ${i === 1 ? 'flex-row-reverse text-right' : ''}`}>
                <span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: parte.cor }} />
                <span className="text-slate-700 dark:text-slate-200">
                  {parte.rotulo} <strong className="font-semibold text-slate-900 dark:text-white">{pct(parte.p)}</strong>
                  <span className="text-slate-400"> · {formatCurrency(parte.valor)}</span>
                </span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Par;
