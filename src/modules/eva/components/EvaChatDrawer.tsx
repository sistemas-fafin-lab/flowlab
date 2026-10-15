import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, X } from 'lucide-react';
import { EvaOrb } from './EvaOrb';
import { GlowFrame } from './EvaGlow';
import { MicButton, VoiceNotice } from './ui';
import { PropostaChatCard } from './PropostaChatCard';
import { EVA_SUGGESTIONS } from '../constants';
import type { ChatMessage, PropostaEva } from '../types';

interface Props {
  open: boolean;
  thinking: boolean;
  messages: ChatMessage[];
  onClose: () => void;
  onSend: (text: string) => void;
  listening: boolean;
  transcript: string;
  voiceNotice: string;
  onMic?: () => void;
  /** Propostas (D28): gestor executa, os demais mandam para a fila. */
  podeAprovar?: boolean;
  nome?: (id: string) => string;
  onConfirmar?: (p: PropostaEva) => void;
  onDescartar?: (p: PropostaEva) => void;
  /** Abre o card citado pelo código. */
  onOpenCard?: (codigo: string) => void;
}

const semNome = () => 'alguém';

/** Drawer de conversa (portal no body, mesmo padrão do CategoryEditorModal do Layout). */
export const EvaChatDrawer: React.FC<Props> = ({
  open, thinking, messages, onClose, onSend, listening, transcript, voiceNotice, onMic,
  podeAprovar = false, nome = semNome, onConfirmar, onDescartar, onOpenCard,
}) => {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking, open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  // Uma pergunta por vez: enquanto a EVA pensa, o rascunho espera.
  const submit = () => { if (!draft.trim() || thinking) return; onSend(draft); setDraft(''); };

  return ReactDOM.createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="eva-overlay"
            className="fixed inset-0 z-40 bg-slate-900/[.18] backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          />
          <motion.aside
            key="eva-drawer"
            role="dialog"
            aria-label="Conversa com a EVA"
            className="fixed top-4 right-4 bottom-4 w-[440px] max-w-[calc(100vw-2rem)] z-50 flex flex-col rounded-3xl border border-white/60 dark:border-gray-700/50 bg-white/85 dark:bg-gray-900/85 backdrop-blur-2xl shadow-2xl shadow-slate-900/20 overflow-hidden"
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="flex items-center gap-3 py-4 pr-4 pl-5 border-b border-gray-200/80 dark:border-gray-700/80 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800">
              <div className="w-10 h-10 flex items-center justify-center"><EvaOrb size={36} speed={thinking || listening ? 2.5 : 1} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-slate-800 dark:text-slate-100">EVA</p>
                <p className="text-xs text-slate-500">{listening ? 'Ouvindo…' : thinking ? 'Analisando board, projetos e reuniões…' : 'Agente de TI · online'}</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Fechar" className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
              {messages.map((m) =>
                m.from === 'eva' ? (
                  <div key={m.id} className="flex gap-2.5 items-start max-w-[92%] animate-fade-in-up">
                    <div className="w-6 h-6 flex-shrink-0 mt-0.5 flex items-center justify-center"><EvaOrb size={22} /></div>
                    <div className="min-w-0 flex flex-col gap-1.5">
                      <div className={`px-3.5 py-2.5 rounded-2xl rounded-tl-md border shadow-[0_1px_2px_rgba(0,0,0,.04)] text-[13px] leading-[1.55] whitespace-pre-line [text-wrap:pretty] ${
                        m.falhou
                          ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200'
                          : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                      }`}>
                        {m.text}
                      </div>
                      {onOpenCard && m.cardsCitados && m.cardsCitados.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {m.cardsCitados.map((c) => (
                            <button key={c} type="button" onClick={() => onOpenCard(c)} title={`Abrir ${c}`}
                              className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:border-blue-500/40 transition-colors">
                              {c}
                            </button>
                          ))}
                        </div>
                      )}
                      {m.propostas?.map((p) => (
                        <PropostaChatCard
                          key={p.id}
                          p={p}
                          podeAprovar={podeAprovar}
                          nome={nome}
                          onConfirmar={() => onConfirmar?.(p)}
                          onDescartar={() => onDescartar?.(p)}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="self-end max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-tr-md bg-gradient-to-r from-blue-500 to-blue-600 text-white text-[13px] leading-normal shadow-md shadow-blue-500/25 animate-fade-in-up">
                    {m.text}
                  </div>
                ),
              )}
              {thinking && (
                <div className="flex gap-2.5 items-center">
                  <div className="w-6 h-6 flex items-center justify-center"><EvaOrb size={22} speed={2.5} /></div>
                  <div className="flex gap-1 px-3.5 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="eva-anim w-1.5 h-1.5 rounded-full bg-indigo-500" style={{ animation: `eva-dot 1.2s ${i * 0.15}s ease-in-out infinite` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 pt-3 pb-4 border-t border-gray-200/80 dark:border-gray-700/80">
              {voiceNotice && <VoiceNotice className="mb-2">{voiceNotice}</VoiceNotice>}
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {EVA_SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => onSend(s)}
                    className="px-2.5 py-[5px] rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-blue-500/40 hover:text-slate-800 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
              <GlowFrame innerClassName="flex items-center gap-2 py-1.5 pr-1.5 pl-3.5 bg-white dark:bg-slate-900">
                <input
                  autoFocus
                  value={listening ? transcript : draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                  placeholder={listening ? 'Ouvindo… fale sua pergunta' : 'Escreva para a EVA'}
                  className="flex-1 min-w-0 bg-transparent outline-none text-sm text-slate-800 dark:text-slate-100 py-2 placeholder:text-slate-400"
                />
                {onMic && <MicButton active={listening} onClick={onMic} size={36} />}
                <button type="button" onClick={submit} title="Enviar"
                  className="w-9 h-9 flex items-center justify-center rounded-[10px] bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/25 active:scale-95 transition-transform">
                  <Send className="w-[15px] h-[15px]" />
                </button>
              </GlowFrame>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};

/** Brilho colorido nas bordas da tela enquanto a EVA responde (efeito Siri). */
export const EvaEdgeGlow: React.FC<{ active: boolean }> = ({ active }) =>
  active
    ? ReactDOM.createPortal(
        <div className="eva-anim fixed inset-0 z-[60] pointer-events-none" style={{ animation: 'eva-edge 1.6s linear infinite' }} />,
        document.body,
      )
    : null;
