import React from 'react';
import { CalendarX } from 'lucide-react';

// Selo cinza "fora da janela" do Calendário de envios: só informativo.

const SeloForaDaJanela: React.FC = () => (
  <span
    title="A data prevista ou a de envio cai fora da janela da regra do convênio. Só informativo."
    className="inline-flex items-center gap-1 px-1.5 py-px text-[10px] font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
  >
    <CalendarX className="w-3 h-3" />
    fora da janela
  </span>
);

export default SeloForaDaJanela;
