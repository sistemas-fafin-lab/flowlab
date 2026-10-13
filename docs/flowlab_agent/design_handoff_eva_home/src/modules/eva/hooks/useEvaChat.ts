import { useCallback, useEffect, useRef, useState } from 'react';
import { evaService } from '../services/evaService';
import { INITIAL_CHAT } from '../mocks';
import type { ChatMessage } from '../types';

let seq = 0;
const uid = () => `msg-${Date.now()}-${seq++}`;

export function useEvaChat() {
  const [open, setOpen] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_CHAT);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  /** Abre o drawer e, se houver texto, envia como pergunta. */
  const ask = useCallback(async (text?: string) => {
    setOpen(true);
    const q = (text ?? '').trim();
    if (!q) return;
    setMessages((m) => [...m, { id: uid(), from: 'me', text: q }]);
    setThinking(true);
    try {
      const answer = await evaService.ask(q);
      if (alive.current) setMessages((m) => [...m, { id: uid(), from: 'eva', text: answer }]);
    } catch {
      if (alive.current) setMessages((m) => [...m, { id: uid(), from: 'eva', text: 'Não consegui consultar o board agora. Tente novamente em alguns segundos.' }]);
    } finally {
      if (alive.current) setThinking(false);
    }
  }, []);

  return { open, setOpen, thinking, messages, ask, close: () => setOpen(false) };
}

export type EvaChatState = ReturnType<typeof useEvaChat>;
