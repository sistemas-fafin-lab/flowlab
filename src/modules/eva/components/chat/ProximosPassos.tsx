import React, { useState } from 'react';
import { Check, ExternalLink, Loader2, MessageCircle, Send } from 'lucide-react';
import type { PassoChat } from '../../domain/blocos';

interface Props {
  passos: PassoChat[];
  /** Enquanto a EVA pensa, perguntar de novo espera. */
  ocupado?: boolean;
  /** Gestor com o WhatsApp da EVA ligado: só então "Cobrar" aparece. */
  podeCobrar?: boolean;
  onPerguntar: (texto: string) => void;
  onOpenCard?: (codigo: string) => void;
  /** Cobra pelo mesmo caminho do botão Cobrar das atrasadas (D22); true quando foi para a fila. */
  onCobrar?: (codigo: string) => Promise<boolean>;
}

const CHIP =
  'inline-flex items-center gap-1.5 max-w-full px-3 py-1.5 rounded-full border text-[12px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const CHIP_NORMAL =
  'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-500/40 hover:text-blue-700 dark:hover:text-blue-300';

/** Continuações da conversa (D34): perguntar de novo, abrir um card, cobrar um card atrasado. */
export const ProximosPassos: React.FC<Props> = ({ passos, ocupado, podeCobrar, onPerguntar, onOpenCard, onCobrar }) => {
  const [cobranca, setCobranca] = useState<Record<string, 'enviando' | 'feita'>>({});
  const visiveis = passos.filter((p) => (p.tipo === 'cobrar_card' ? podeCobrar && !!onCobrar : p.tipo === 'abrir_card' ? !!onOpenCard : true));
  if (!visiveis.length) return null;

  const cobrar = async (codigo: string) => {
    if (!onCobrar || cobranca[codigo]) return;
    setCobranca((c) => ({ ...c, [codigo]: 'enviando' }));
    const ok = await onCobrar(codigo).catch(() => false);
    setCobranca((c) => {
      const novo = { ...c };
      if (ok) novo[codigo] = 'feita'; else delete novo[codigo];
      return novo;
    });
  };

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Próximos passos">
      {visiveis.map((p, i) => {
        if (p.tipo === 'perguntar') {
          return (
            <button key={i} type="button" disabled={ocupado} onClick={() => onPerguntar(p.texto)} className={`${CHIP} ${CHIP_NORMAL}`}>
              <MessageCircle className="w-3.5 h-3.5 flex-shrink-0 text-indigo-500" />
              <span className="truncate">{p.texto}</span>
            </button>
          );
        }
        if (p.tipo === 'abrir_card') {
          return (
            <button key={i} type="button" onClick={() => onOpenCard?.(p.codigo)} className={`${CHIP} ${CHIP_NORMAL}`}>
              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" />
              Abrir {p.codigo}
            </button>
          );
        }
        const estado = cobranca[p.codigo];
        return (
          <button
            key={i}
            type="button"
            disabled={!!estado}
            onClick={() => void cobrar(p.codigo)}
            className={`${CHIP} ${estado === 'feita'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 disabled:opacity-100'
              : 'border-emerald-500/30 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10'}`}
          >
            {estado === 'enviando' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : estado === 'feita' ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
            {estado === 'feita' ? `Cobrança de ${p.codigo} na fila` : `Cobrar ${p.codigo} pelo WhatsApp`}
          </button>
        );
      })}
    </div>
  );
};
