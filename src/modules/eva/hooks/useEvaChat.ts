import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';

let seq = 0;
const uid = () => `msg-${Date.now()}-${seq++}`;

/**
 * Fase 1: o chat com a EVA ainda não está ligado (issue 16, ação `agente-perguntar`).
 * O drawer abre e responde com esse aviso — nunca com uma resposta inventada.
 */
export const AVISO_CHAT_EM_BREVE =
  'O chat comigo chega na próxima etapa. Por enquanto, o Início já mostra o board, as atrasadas, os projetos e as suas tasks do dia.';

export function useEvaChat(primeiroNome = '') {
  const [open, setOpen] = useState(false);
  const [thinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: uid(), from: 'eva', text: `Olá${primeiroNome ? `, ${primeiroNome}` : ''}. ${AVISO_CHAT_EM_BREVE}` },
  ]);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  /** Abre o drawer e, se houver texto, registra a pergunta. */
  const ask = useCallback(async (text?: string) => {
    setOpen(true);
    const q = (text ?? '').trim();
    if (!q) return;
    setMessages((m) => [...m, { id: uid(), from: 'me', text: q }, { id: uid(), from: 'eva', text: AVISO_CHAT_EM_BREVE }]);
  }, []);

  return { open, setOpen, thinking, messages, ask, close: () => setOpen(false) };
}

export type EvaChatState = ReturnType<typeof useEvaChat>;
