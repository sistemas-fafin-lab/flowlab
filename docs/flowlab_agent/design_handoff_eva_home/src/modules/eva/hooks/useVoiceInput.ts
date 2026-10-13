import { useCallback, useEffect, useRef, useState } from 'react';

/** Onde o ditado foi iniciado — define qual campo mostra a transcrição. */
export type VoiceTarget = 'hero' | 'chat' | 'float';

// Tipos mínimos da Web Speech API (não fazem parte do lib.dom do TS)
interface SpeechResultLike { isFinal: boolean; 0: { transcript: string } }
interface SpeechEventLike { resultIndex: number; results: ArrayLike<SpeechResultLike> }
interface SpeechRecognitionLike {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: ((e: SpeechEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
}
type SpeechCtor = new () => SpeechRecognitionLike;

const getCtor = (): SpeechCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const ERRORS: Record<string, string> = {
  'not-allowed': 'Não foi possível acessar o microfone. Libere a permissão no navegador e tente novamente.',
  'service-not-allowed': 'Não foi possível acessar o microfone. Libere a permissão no navegador e tente novamente.',
  'no-speech': 'Não ouvi nada. Toque no microfone e fale sua pergunta.',
  'audio-capture': 'Nenhum microfone encontrado. Conecte um microfone e tente novamente.',
  network: 'O ditado precisa de conexão com a internet. Verifique a rede e tente novamente.',
};

/**
 * Ditado por voz (pt-BR) com a Web Speech API. Ao terminar de falar, chama onFinal(texto).
 * Chrome/Edge suportam; Firefox não — nesse caso exibe aviso.
 */
export function useVoiceInput(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [target, setTarget] = useState<VoiceTarget | null>(null);
  const [transcript, setTranscript] = useState('');
  const [notice, setNoticeState] = useState('');
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>();
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const setNotice = useCallback((msg: string) => {
    clearTimeout(noticeTimer.current);
    setNoticeState(msg);
    if (msg) noticeTimer.current = setTimeout(() => setNoticeState(''), 6000);
  }, []);

  useEffect(() => () => {
    clearTimeout(noticeTimer.current);
    recRef.current?.abort();
  }, []);

  const toggle = useCallback((t: VoiceTarget) => {
    if (recRef.current) { recRef.current.stop(); return; }
    const Ctor = getCtor();
    if (!Ctor) { setNotice('Ditado por voz não é suportado neste navegador. Use o Chrome ou o Edge.'); return; }

    const rec = new Ctor();
    rec.lang = 'pt-BR';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = '';

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
      }
      setTranscript(`${finalText} ${interim}`.trim());
    };
    rec.onerror = (e) => {
      if (e.error !== 'aborted') setNotice(ERRORS[e.error] ?? 'O ditado foi interrompido. Tente novamente.');
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      setTarget(null);
      setTranscript('');
      const text = finalText.trim();
      if (text) onFinalRef.current(text);
    };

    try {
      rec.start();
      recRef.current = rec;
      setTranscript('');
      setNotice('');
      setListening(true);
      setTarget(t);
    } catch {
      setNotice('Não foi possível iniciar o ditado. Tente novamente.');
    }
  }, [setNotice]);

  return {
    supported: !!getCtor(),
    listening,
    target,
    transcript,
    notice,
    toggle,
    /** true se o ditado está ativo no campo informado */
    isActive: (t: VoiceTarget) => listening && target === t,
  };
}

export type VoiceState = ReturnType<typeof useVoiceInput>;
