import React from 'react';
import { CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { descreverProposta, ROTULO_TIPO } from './admin/propostas';
import MudancasProposta from './admin/MudancasProposta';
import type { PropostaEva } from '../types';

interface Props {
  p: PropostaEva;
  ehGestor: boolean;
  nome: (id: string) => string;
  onConfirmar: () => void;
  onDescartar: () => void;
}

/**
 * Proposta da EVA dentro do chat (RN17, D28): mostra o que muda e só executa quando a
 * pessoa confirma. Gestor: "Aprovar e executar". Demais: "Enviar para aprovação".
 */
export const PropostaChatCard: React.FC<Props> = ({ p, ehGestor, nome, onConfirmar, onDescartar }) => {
  const enviando = p.estado === 'enviando';
  return (
    <div className={`mt-1 rounded-2xl border px-3.5 py-3 text-[12px] ${p.estado === 'descartada' ? 'opacity-60 border-slate-200 dark:border-slate-700' : 'border-indigo-200/80 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-500/[.06]'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
        Proposta · {ROTULO_TIPO[p.tipo]}
      </p>
      {p.card && <p className="mt-0.5 text-[13px] font-semibold text-slate-800 dark:text-slate-100">{p.card.codigo} · {p.card.title}</p>}

      <div className="mt-2"><MudancasProposta linhas={descreverProposta(p.tipo, p.proposta, p.card, nome)} compacto /></div>

      {p.avisos.length > 0 && (
        <ul className="mt-2 text-[11px] text-amber-700 dark:text-amber-400 list-disc pl-4">
          {p.avisos.map((a) => <li key={a}>{a}</li>)}
        </ul>
      )}
      {p.erro && <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">{p.erro}</p>}

      {(p.estado === 'aberta' || enviando) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onConfirmar}
            disabled={enviando}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white text-[12px] font-semibold shadow-md shadow-blue-500/25 active:scale-[.98] transition disabled:opacity-60"
          >
            {enviando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {ehGestor ? 'Aprovar e executar' : 'Enviar para aprovação'}
          </button>
          <button
            type="button"
            onClick={onDescartar}
            disabled={enviando}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[12px] font-medium text-slate-600 dark:text-slate-300 transition disabled:opacity-60"
          >
            Descartar
          </button>
        </div>
      )}
      {p.estado === 'executada' && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" /> Aprovada e executada no board.
        </p>
      )}
      {p.estado === 'na_fila' && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[12px] font-medium text-slate-600 dark:text-slate-300">
          <Clock className="w-3.5 h-3.5" /> Enviada para aprovação. Um gestor decide em EVA → Sugestões.
        </p>
      )}
      {p.estado === 'descartada' && <p className="mt-2 text-[11px] text-slate-500">Descartada. Nada mudou.</p>}
    </div>
  );
};
