// Modal com as ocorrências vinculadas a 1 card da sub-aba Correlação — abre
// ao clicar num CardCorrelacaoRisco.
// (.scratch/qualidade-riscos-indicadores/issues/05-riscos-correlacao-ocorrencias.md)

import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { CardCorrelacaoRiscoDTO } from '../../types';
import { formatarDataCurta } from './rotulos.js';

interface ModalOcorrenciasDoRiscoProps {
  card: CardCorrelacaoRiscoDTO;
  onFechar: () => void;
}

export function ModalOcorrenciasDoRisco({ card, onFechar }: ModalOcorrenciasDoRiscoProps) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-20 sm:pt-24" role="dialog" aria-modal="true" aria-label="Ocorrências vinculadas">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onFechar} />
      <div className="glass-surface relative flex max-h-[70vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200/50 bg-white/95 shadow-2xl dark:border-white/10 dark:bg-gray-800/95">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{card.riscoIdentificado}</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {card.setorNome ?? '—'} · {card.processo}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-white/5"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {card.ocorrencias.length === 0 && <p className="px-3 py-4 text-sm text-gray-500 dark:text-slate-400">Nenhuma ocorrência vinculada.</p>}
          <ul className="space-y-1 p-1">
            {card.ocorrencias.map((o) => (
              <li key={o.id} className="rounded-xl px-3 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-white/5">
                <p className="text-slate-700 dark:text-slate-300">{o.resumo || '—'}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{formatarDataCurta(o.dtaOcorrencia)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}
