import React, { forwardRef, useState } from 'react';
import { Send } from 'lucide-react';
import { EvaOrb } from './EvaOrb';
import { GlowFrame } from './EvaGlow';
import { MicButton, VoiceNotice } from './ui';
import { EVA_SUGGESTIONS } from '../constants';

interface EvaHeroProps {
  eyebrow: string;
  greeting: string;
  briefing: string;
  thinking: boolean;
  listening: boolean;
  transcript: string;
  voiceNotice: string;
  onAsk: (text?: string) => void;
  onMic: () => void;
}

/** O ref aponta para o campo de pergunta — usado para decidir quando mostrar a barra flutuante. */
export const EvaHero = forwardRef<HTMLDivElement, EvaHeroProps>(
  ({ eyebrow, greeting, briefing, thinking, listening, transcript, voiceNotice, onAsk, onMic }, inputAnchorRef) => {
    const [draft, setDraft] = useState('');
    const submit = () => { onAsk(draft); setDraft(''); };
    const value = listening ? transcript : draft;

    return (
      <div className="relative flex flex-col items-center text-center pt-7 animate-fade-in-up">
        <div
          className="absolute -top-10 left-1/2 w-[560px] h-[300px] -ml-[280px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(99,102,241,.14), rgba(236,72,153,.06) 45%, rgba(255,255,255,0) 70%)' }}
        />
        <button
          type="button"
          onClick={() => onAsk()}
          aria-label="Abrir conversa com a EVA"
          className="relative w-[104px] h-[104px] flex items-center justify-center"
        >
          <EvaOrb size={96} speed={thinking || listening ? 2.2 : 1} />
        </button>

        <p className="relative mt-[22px] text-[10px] font-bold tracking-[.08em] uppercase text-slate-500 dark:text-slate-400">{eyebrow}</p>
        <h2 className="relative mt-1.5 text-[30px] leading-tight font-bold tracking-[-.02em] bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
          {greeting}
        </h2>
        <p className="relative mt-2 max-w-[620px] text-sm leading-[1.55] text-gray-500 dark:text-gray-400 [text-wrap:pretty]">{briefing}</p>

        <div ref={inputAnchorRef} className="relative w-full max-w-[660px] mt-6">
          <GlowFrame halo radius={20} thickness={2} opacity={1}
            innerClassName="flex items-center gap-3 py-2 pr-2 pl-3.5 bg-white/[.94] dark:bg-slate-900/[.94]">
            <div className="w-[26px] h-[26px] flex-shrink-0 flex items-center justify-center"><EvaOrb size={22} /></div>
            <input
              value={value}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder={listening ? 'Ouvindo… fale sua pergunta' : 'Pergunte à EVA sobre tasks, projetos ou reuniões'}
              className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-slate-800 dark:text-slate-100 py-2 placeholder:text-slate-400"
            />
            <MicButton active={listening} onClick={onMic} size={40} />
            <button type="button" onClick={submit} title="Enviar"
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30 active:scale-95 transition-all">
              <Send className="w-4 h-4" />
            </button>
          </GlowFrame>
        </div>

        {voiceNotice && <VoiceNotice className="relative mt-3">{voiceNotice}</VoiceNotice>}

        <div className="relative flex flex-wrap justify-center gap-2 mt-3.5">
          {EVA_SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => onAsk(s)}
              className="px-3 py-1.5 rounded-full border border-white/60 bg-white/60 backdrop-blur-md text-xs font-medium text-slate-600 shadow-sm hover:bg-white hover:text-slate-800 hover:border-blue-500/30 transition-all dark:bg-slate-800/60 dark:border-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100">
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  },
);
EvaHero.displayName = 'EvaHero';
