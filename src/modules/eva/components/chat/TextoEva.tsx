import React from 'react';
import type { BlocoTexto, Parte } from '../../domain/respostaVisual';

interface Props {
  blocos: BlocoTexto[];
  /** O código é de um card do board? Então vira link. */
  cardExiste?: (codigo: string) => boolean;
  onOpenCard?: (codigo: string) => void;
}

const ParteEva: React.FC<{ p: Parte } & Omit<Props, 'blocos'>> = ({ p, cardExiste, onOpenCard }) => {
  if (p.tipo === 'card' && onOpenCard && cardExiste?.(p.valor)) {
    return (
      <button
        type="button"
        onClick={() => onOpenCard(p.valor)}
        title={`Abrir ${p.valor}`}
        className="inline font-semibold text-blue-600 dark:text-blue-400 underline decoration-blue-500/30 underline-offset-2 hover:decoration-blue-500 transition-colors"
      >
        {p.valor}
      </button>
    );
  }
  return <span className={p.negrito || p.tipo === 'card' ? 'font-semibold text-slate-900 dark:text-white' : undefined}>{p.valor}</span>;
};

/**
 * O texto da EVA com a formatação leve (D34): parágrafos, listas, **negrito** e códigos de card
 * que abrem o card. Nada vem como HTML: cada pedaço é texto desenhado pelo React.
 */
export const TextoEva: React.FC<Props> = ({ blocos, cardExiste, onOpenCard }) => {
  const linha = (partes: Parte[]) => partes.map((p, j) => <ParteEva key={j} p={p} cardExiste={cardExiste} onOpenCard={onOpenCard} />);
  return (
    <div className="flex flex-col gap-2">
      {blocos.map((b, i) =>
        b.tipo === 'paragrafo' ? (
          <p key={i}>
            {b.linhas.map((l, j) => <React.Fragment key={j}>{j > 0 && <br />}{linha(l)}</React.Fragment>)}
          </p>
        ) : b.ordenada ? (
          <ol key={i} className="flex flex-col gap-1 pl-4 list-decimal marker:text-indigo-400 marker:font-semibold">
            {b.itens.map((it, j) => <li key={j} className="pl-0.5">{linha(it)}</li>)}
          </ol>
        ) : (
          <ul key={i} className="flex flex-col gap-1 pl-4 list-disc marker:text-indigo-400">
            {b.itens.map((it, j) => <li key={j} className="pl-0.5">{linha(it)}</li>)}
          </ul>
        ),
      )}
    </div>
  );
};
