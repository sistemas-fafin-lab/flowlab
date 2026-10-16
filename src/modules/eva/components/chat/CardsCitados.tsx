import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import type { CardVisual, PessoaVisual } from '../../domain/respostaVisual';
import { MOLDURA_BLOCO, TEXTO_DO_TOM } from './tons';

/** Até `max` avatares sobrepostos, com "+n" para o resto. */
export const Avatares: React.FC<{ pessoas: PessoaVisual[]; max?: number; tamanho?: number }> = ({ pessoas, max = 2, tamanho = 22 }) => {
  if (!pessoas.length) return null;
  const visiveis = pessoas.slice(0, max);
  const resto = pessoas.length - visiveis.length;
  return (
    <span className="flex items-center -space-x-1.5" title={pessoas.map((p) => p.nome).join(', ')}>
      {visiveis.map((p) => (
        <span
          key={p.id}
          className="flex items-center justify-center rounded-full ring-2 ring-white dark:ring-slate-800 text-white font-bold"
          style={{ width: tamanho, height: tamanho, background: p.gradiente, fontSize: tamanho * 0.4 }}
        >
          {p.iniciais}
        </span>
      ))}
      {resto > 0 && (
        <span
          className="flex items-center justify-center rounded-full ring-2 ring-white dark:ring-slate-800 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200 font-bold"
          style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.4 }}
        >
          +{resto}
        </span>
      )}
    </span>
  );
};

/** Um card citado (D34): coluna, prazo legível, prioridade na borda e quem cuida. Abre o card. */
export const CardMini: React.FC<{ card: CardVisual; onOpen?: (codigo: string) => void; compacto?: boolean }> = ({ card, onOpen, compacto = false }) => (
  <button
    type="button"
    onClick={() => onOpen?.(card.codigo)}
    disabled={!onOpen}
    title={`${card.codigo} · ${card.titulo} · prioridade ${card.prioridadeRotulo.toLowerCase()}`}
    className={`group w-full flex items-stretch text-left overflow-hidden ${compacto ? 'rounded-xl bg-slate-50/80 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900/70' : `${MOLDURA_BLOCO} hover:border-blue-500/40`} transition-colors disabled:cursor-default`}
  >
    <span aria-hidden className="w-[3px] flex-shrink-0" style={{ background: card.prioridadeCor }} />
    <span className={`flex-1 min-w-0 ${compacto ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
      <span className="flex items-center gap-1.5 text-[11px] leading-4">
        <span className="font-bold text-blue-600 dark:text-blue-400">{card.codigo}</span>
        {!compacto && (
          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 truncate">
            <span aria-hidden className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: card.colunaCor }} />
            {card.colunaRotulo}
          </span>
        )}
        <span className={`ml-auto inline-flex items-center gap-1 font-medium whitespace-nowrap ${TEXTO_DO_TOM[card.prazo.tom]}`}>
          {card.prazo.tom === 'perigo' && <Clock className="w-3 h-3" />}
          {card.prazo.texto}
        </span>
      </span>
      <span className={`block truncate font-semibold text-slate-800 dark:text-slate-100 ${compacto ? 'text-[12px]' : 'mt-0.5 text-[12.5px]'}`}>{card.titulo}</span>
    </span>
    {card.responsaveis.length > 0 && (
      <span className={`flex items-center ${compacto ? 'pr-2.5' : 'pr-3'}`}>
        <Avatares pessoas={card.responsaveis} tamanho={compacto ? 18 : 22} />
      </span>
    )}
  </button>
);

const MAX_VISIVEIS = 4;

/** Os cards que a EVA citou, como cartões; passando de 4, o resto abre num clique. */
export const CardsCitados: React.FC<{ cards: CardVisual[]; onOpen?: (codigo: string) => void }> = ({ cards, onOpen }) => {
  const [todos, setTodos] = useState(false);
  if (!cards.length) return null;
  const visiveis = todos ? cards : cards.slice(0, MAX_VISIVEIS);
  return (
    <div className="flex flex-col gap-1.5">
      {visiveis.map((c) => <CardMini key={c.id} card={c} onOpen={onOpen} />)}
      {cards.length > visiveis.length && (
        <button type="button" onClick={() => setTodos(true)} className="self-start px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline">
          Ver mais {cards.length - visiveis.length}
        </button>
      )}
    </div>
  );
};
