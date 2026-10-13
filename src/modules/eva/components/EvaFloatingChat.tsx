import React from 'react';
import ReactDOM from 'react-dom';
import { Send } from 'lucide-react';
import { EvaOrb } from './EvaOrb';
import { GlowFrame } from './EvaGlow';
import { MicButton, VoiceNotice } from './ui';

interface Props {
  /** Visível quando o campo do hero saiu da tela e o drawer está fechado */
  visible: boolean;
  thinking: boolean;
  listening: boolean;
  transcript: string;
  notice: string;
  onOpen: () => void;
  onAsk: (text: string) => void;
  onMic?: () => void;
}

/** Barra flutuante da EVA (canto inferior direito) que aparece ao rolar a página. */
export const EvaFloatingChat: React.FC<Props> = ({ visible, thinking, listening, transcript, notice, onOpen, onAsk, onMic }) => {
  const [draft, setDraft] = React.useState('');
  const value = listening ? transcript : draft;
  const submit = () => { if (!draft.trim()) return; onAsk(draft); setDraft(''); };

  return ReactDOM.createPortal(
    <div
      aria-hidden={!visible}
      className={`fixed right-6 bottom-6 z-[35] w-[400px] max-w-[calc(100vw-3rem)] transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${
        visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-[.96] pointer-events-none'
      }`}
    >
      {notice && <VoiceNotice className="mx-1 mb-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-900/10">{notice}</VoiceNotice>}
      <GlowFrame halo radius={20} thickness={1.5} opacity={1} className="shadow-2xl shadow-slate-900/25 rounded-[20px]"
        innerClassName="flex items-center gap-2 py-1.5 pr-1.5 pl-2 bg-white/[.94] dark:bg-slate-900/[.94]">
        <button type="button" onClick={onOpen} aria-label="Abrir conversa com a EVA" className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
          <EvaOrb size={32} speed={thinking || listening ? 2.2 : 1} />
        </button>
        <input
          value={value}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder={listening ? 'Ouvindo…' : 'Pergunte à EVA'}
          tabIndex={visible ? 0 : -1}
          className="flex-1 min-w-0 bg-transparent outline-none text-sm text-slate-800 dark:text-slate-100 py-2 placeholder:text-slate-400"
        />
        {onMic && <MicButton active={listening} onClick={onMic} size={36} />}
        <button type="button" onClick={submit} title="Enviar" tabIndex={visible ? 0 : -1}
          className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/25 active:scale-95 transition-transform">
          <Send className="w-[15px] h-[15px]" />
        </button>
      </GlowFrame>
    </div>,
    document.body,
  );
};
