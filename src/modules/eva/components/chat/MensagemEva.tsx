import React, { useEffect, useMemo, useRef } from 'react';
import { EvaOrb } from '../EvaOrb';
import { PropostaChatCard } from '../PropostaChatCard';
import { AvisoChatCard } from '../AvisoChatCard';
import {
  blocosDoTexto, cardPorCodigo, cardsCitados, codigosNosBlocos, cortarTexto, tamanhoDoTexto, type ContextoVisual,
} from '../../domain/respostaVisual';
import type { AvisoEva, ChatMessage, PropostaEva } from '../../types';
import { TextoEva } from './TextoEva';
import { CardsCitados } from './CardsCitados';
import { BlocosEva } from './BlocosEva';
import { ProximosPassos } from './ProximosPassos';
import { useRevelacao } from './useRevelacao';

export interface PropsMensagemEva {
  m: ChatMessage;
  /** O que o Início já leu; sem ele (ainda carregando), os cards citados ficam como códigos. */
  ctx?: ContextoVisual | null;
  thinking: boolean;
  podeAprovar: boolean;
  nome: (id: string) => string;
  onConfirmar?: (p: PropostaEva) => void;
  onDescartar?: (p: PropostaEva) => void;
  onEnviarAviso?: (a: AvisoEva, texto: string) => void;
  onDescartarAviso?: (a: AvisoEva) => void;
  onOpenCard?: (codigo: string) => void;
  onSend: (texto: string) => void;
  podeCobrar?: boolean;
  onCobrar?: (codigo: string) => Promise<boolean>;
  onNavegar?: (para: string) => void;
  /** O texto está crescendo: o drawer acompanha rolando. */
  aoAvancar?: () => void;
}

/** Uma resposta da EVA (D34): o texto aparece como fala; cartões, blocos e botões entram depois. */
export const MensagemEva: React.FC<PropsMensagemEva> = ({
  m, ctx, thinking, podeAprovar, nome, onConfirmar, onDescartar, onEnviarAviso, onDescartarAviso, onOpenCard, onSend,
  podeCobrar, onCobrar, onNavegar, aoAvancar,
}) => {
  const blocosTexto = useMemo(() => blocosDoTexto(m.text), [m.text]);
  const total = useMemo(() => tamanhoDoTexto(blocosTexto), [blocosTexto]);
  const { limite, pronto } = useRevelacao(m.id, total, !!m.nova && !m.falhou, aoAvancar);
  const visiveis = useMemo(() => (pronto ? blocosTexto : cortarTexto(blocosTexto, limite)), [blocosTexto, limite, pronto]);
  // Card que o bloco de agenda ou de projeto já mostra não se repete como cartão.
  const citados = useMemo(() => {
    if (!ctx) return [];
    const nosBlocos = codigosNosBlocos(m.blocos ?? [], ctx);
    return cardsCitados((m.cardsCitados ?? []).filter((c) => !nosBlocos.has(c.toUpperCase())), ctx);
  }, [ctx, m.cardsCitados, m.blocos]);
  const cardExiste = (codigo: string) => !!ctx && !!cardPorCodigo(ctx, codigo);
  // Os cartões e blocos entram depois do texto: o drawer acompanha também essa entrada.
  const aoAvancarRef = useRef(aoAvancar);
  aoAvancarRef.current = aoAvancar;
  useEffect(() => {
    if (!pronto || !m.nova) return;
    const quadro = requestAnimationFrame(() => aoAvancarRef.current?.());
    return () => cancelAnimationFrame(quadro);
  }, [pronto, m.nova]);

  return (
    <div className="flex gap-2.5 items-start w-full animate-fade-in-up">
      <div className="w-6 h-6 flex-shrink-0 mt-0.5 flex items-center justify-center"><EvaOrb size={22} /></div>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div
          className={`self-start max-w-full px-3.5 py-2.5 rounded-2xl rounded-tl-md border shadow-[0_1px_2px_rgba(0,0,0,.04)] text-[13px] leading-[1.55] [text-wrap:pretty] ${
            m.falhou
              ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200'
              : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200'
          }`}
        >
          {/* Leitor de tela recebe o texto inteiro; a fala aparecendo é só visual. */}
          <span className="sr-only">{m.text}</span>
          <div aria-hidden>
            <TextoEva blocos={visiveis} cardExiste={cardExiste} onOpenCard={onOpenCard} />
          </div>
        </div>

        {pronto && !m.falhou && (
          <div className="flex flex-col gap-1.5 animate-fade-in-up">
            {ctx ? (
              <CardsCitados cards={citados} onOpen={onOpenCard} />
            ) : onOpenCard && m.cardsCitados && m.cardsCitados.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {m.cardsCitados.map((c) => (
                  <button key={c} type="button" onClick={() => onOpenCard(c)} title={`Abrir ${c}`}
                    className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:border-blue-500/40 transition-colors">
                    {c}
                  </button>
                ))}
              </div>
            )}
            {ctx && m.blocos && m.blocos.length > 0 && <BlocosEva blocos={m.blocos} ctx={ctx} onOpenCard={onOpenCard} onNavegar={onNavegar} />}
            {m.propostas?.map((p) => (
              <PropostaChatCard key={p.id} p={p} podeAprovar={podeAprovar} nome={nome} onConfirmar={() => onConfirmar?.(p)} onDescartar={() => onDescartar?.(p)} />
            ))}
            {m.avisos?.map((a) => (
              <AvisoChatCard key={a.id} a={a} onEnviar={(texto) => onEnviarAviso?.(a, texto)} onDescartar={() => onDescartarAviso?.(a)} />
            ))}
            {m.proximosPassos && m.proximosPassos.length > 0 && (
              <ProximosPassos
                passos={m.proximosPassos}
                ocupado={thinking}
                podeCobrar={podeCobrar}
                onPerguntar={onSend}
                onOpenCard={onOpenCard}
                onCobrar={onCobrar}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
