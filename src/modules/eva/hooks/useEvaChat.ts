import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { evaService } from '../services/evaService';
import { agenteAdmin } from '../services/agenteAdmin';
import { FALHA_CHAT, historicoParaEnvio, mensagemInicial } from '../domain/chatReplies';
import type { ChatMessage, EvaView, PropostaEva } from '../types';

let seq = 0;
const uid = () => `msg-${Date.now()}-${seq++}`;

/** Erro de rede (fetch não chegou ao servidor) vira a mensagem do handoff; o resto vem do servidor. */
const textoDoErro = (e: unknown) => (e instanceof TypeError || !(e instanceof Error) ? FALHA_CHAT : e.message);

interface Opcoes {
  primeiroNome: string;
  view: EvaView;
  /** Gestor confirma e a EVA executa; os demais mandam a proposta para a fila (D28). */
  podeAprovar: boolean;
  /** analisada_em da última reunião, para a abertura do drawer. */
  ultimaReuniaoEm: string | null;
  /** Chamado depois que uma proposta foi executada, para o Início reler o board. */
  onExecutada?: () => void;
}

/** Chat com a EVA (issue 16): pergunta pela ação `agente-perguntar`; nada muda sem confirmação. */
export function useEvaChat({ primeiroNome, view, podeAprovar, ultimaReuniaoEm, onExecutada }: Opcoes) {
  const [open, setOpen] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [conversa, setConversa] = useState<ChatMessage[]>([]);
  /** Nomes das pessoas citadas nas propostas (o Início só conhece quem tem card). */
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const conversaRef = useRef(conversa);
  conversaRef.current = conversa;
  const ocupado = useRef(false);
  const alive = useRef(true);
  const onExecutadaRef = useRef(onExecutada);
  onExecutadaRef.current = onExecutada;

  useEffect(() => () => { alive.current = false; }, []);

  const abertura = useMemo<ChatMessage>(
    () => ({ id: 'abertura', from: 'eva', text: mensagemInicial(primeiroNome, ultimaReuniaoEm) }),
    [primeiroNome, ultimaReuniaoEm],
  );
  const messages = useMemo(() => [abertura, ...conversa], [abertura, conversa]);

  /** Abre o drawer e, se houver texto, pergunta à EVA. Uma pergunta por vez. */
  const ask = useCallback(async (text?: string) => {
    setOpen(true);
    const q = (text ?? '').trim();
    if (!q || ocupado.current) return;
    ocupado.current = true;
    const historico = historicoParaEnvio(conversaRef.current);
    setConversa((m) => [...m, { id: uid(), from: 'me', text: q }]);
    setThinking(true);
    try {
      const r = await evaService.ask(q, view, historico);
      if (!alive.current) return;
      const propostas: PropostaEva[] = r.propostas.map((p) => ({ ...p, id: uid(), estado: 'aberta' }));
      setNomes((n) => ({ ...n, ...r.nomes }));
      setConversa((m) => [...m, { id: uid(), from: 'eva', text: r.resposta, cardsCitados: r.cardsCitados, propostas }]);
    } catch (e) {
      if (!alive.current) return;
      setConversa((m) => [...m, { id: uid(), from: 'eva', text: textoDoErro(e), falhou: true }]);
    } finally {
      ocupado.current = false;
      if (alive.current) setThinking(false);
    }
  }, [view]);

  const mudarProposta = useCallback((id: string, mudanca: Partial<PropostaEva>) => {
    setConversa((m) => m.map((msg) => (msg.propostas?.some((p) => p.id === id)
      ? { ...msg, propostas: msg.propostas.map((p) => (p.id === id ? { ...p, ...mudanca } : p)) }
      : msg)));
  }, []);

  /** Gestor: aprova e executa numa transação só. Demais: envia para a fila (RN18). */
  const confirmar = useCallback(async (p: PropostaEva) => {
    if (p.estado !== 'aberta') return;
    mudarProposta(p.id, { estado: 'enviando', erro: undefined });
    try {
      await agenteAdmin.propor({ tipo: p.tipo, cardId: p.card_id, proposta: p.proposta, trecho: p.trecho, origem: 'chat', aprovar: podeAprovar });
      if (!alive.current) return;
      mudarProposta(p.id, { estado: podeAprovar ? 'executada' : 'na_fila' });
      if (podeAprovar) onExecutadaRef.current?.();
    } catch (e) {
      if (!alive.current) return;
      mudarProposta(p.id, { estado: 'aberta', erro: e instanceof Error ? e.message : 'Não consegui registrar a proposta.' });
    }
  }, [podeAprovar, mudarProposta]);

  const descartar = useCallback((p: PropostaEva) => {
    if (p.estado === 'aberta') mudarProposta(p.id, { estado: 'descartada', erro: undefined });
  }, [mudarProposta]);

  return { open, setOpen, thinking, messages, nomes, ask, confirmar, descartar, close: () => setOpen(false) };
}

export type EvaChatState = ReturnType<typeof useEvaChat>;
