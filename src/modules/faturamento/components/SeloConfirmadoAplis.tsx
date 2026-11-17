import React from 'react';
import { BadgeCheck } from 'lucide-react';
import { textoLotes } from '../utils/lotesAplis';

// Selo "confirmado no apLIS" do Calendário de envios: o backup tem o lote do envio.

const SeloConfirmadoAplis: React.FC<{ lotes: readonly number[] }> = ({ lotes }) => (
  <span
    title={`Enviado no backup do apLIS: ${textoLotes(lotes)}.`}
    className="inline-flex items-center gap-1 px-1.5 py-px text-[10px] font-medium rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
  >
    <BadgeCheck className="w-3 h-3" />
    confirmado no apLIS
  </span>
);

export default SeloConfirmadoAplis;
