// Card de 1 risco na sub-aba Correlação — grade da CorrelacaoRiscosOcorrenciasPage.
// (.scratch/qualidade-riscos-indicadores/issues/05-riscos-correlacao-ocorrencias.md)

import { Link2 } from 'lucide-react';
import type { CardCorrelacaoRiscoDTO } from '../../types';

interface CardCorrelacaoRiscoProps {
  card: CardCorrelacaoRiscoDTO;
  onClick: () => void;
}

export function CardCorrelacaoRisco({ card, onClick }: CardCorrelacaoRiscoProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-surface flex flex-col gap-2 rounded-2xl p-4 text-left transition-colors hover:bg-white/90 dark:hover:bg-white/10"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{card.setorNome ?? '—'} · {card.processo}</p>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          <Link2 className="h-3 w-3" aria-hidden />
          {card.ocorrencias.length}
        </span>
      </div>
      <p className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">{card.riscoIdentificado}</p>
    </button>
  );
}
