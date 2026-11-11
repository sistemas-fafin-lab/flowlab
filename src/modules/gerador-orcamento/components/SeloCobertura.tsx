import React from 'react';
import { Check, X } from 'lucide-react';

/** Selo da Conferência de cobertura num exame: no carrinho e na leitura do pedido. */
const SeloCobertura: React.FC<{ coberto: boolean; convenio: string }> = ({ coberto, convenio }) =>
  coberto ? (
    <span
      title={`Coberto pela ${convenio}`}
      className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-px text-[10px] font-semibold rounded-full bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
    >
      <Check className="w-3 h-3" /> Coberto
    </span>
  ) : (
    <span
      title={`Não coberto pela ${convenio}`}
      className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-px text-[10px] font-semibold rounded-full bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
    >
      <X className="w-3 h-3" /> Não coberto
    </span>
  );

export default SeloCobertura;
