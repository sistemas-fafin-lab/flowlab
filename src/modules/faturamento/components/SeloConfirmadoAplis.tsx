import React from 'react';
import { BadgeCheck } from 'lucide-react';

// Selo "confirmado no apLIS" do Calendário de envios: o backup tem o lote do envio.

const SeloConfirmadoAplis: React.FC<{ lote: number }> = ({ lote }) => (
  <span
    title={`O lote ${lote} aparece como enviado no backup do apLIS.`}
    className="inline-flex items-center gap-1 px-1.5 py-px text-[10px] font-medium rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
  >
    <BadgeCheck className="w-3 h-3" />
    confirmado no apLIS
  </span>
);

export default SeloConfirmadoAplis;
