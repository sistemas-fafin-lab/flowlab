import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { AvisoEva } from '../hooks/useEvaHome';
import { JANELA_DESFAZER_MS } from '../hooks/useEvaHome';

interface Props {
  aviso: AvisoEva | null;
  onClose: () => void;
}

/** Aviso curto no rodapé da tela, com "Desfazer" quando a ação permite (D23). */
export const EvaToast: React.FC<Props> = ({ aviso, onClose }) => {
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(onClose, aviso.desfazer ? JANELA_DESFAZER_MS : 4000);
    return () => clearTimeout(t);
  }, [aviso, onClose]);

  return ReactDOM.createPortal(
    <AnimatePresence>
      {aviso && (
        <motion.div
          key={aviso.id}
          role="status"
          aria-live="polite"
          className="fixed left-1/2 bottom-6 z-[55] -translate-x-1/2 flex items-center gap-3 pl-4 pr-2 py-2 rounded-2xl bg-slate-900/90 dark:bg-slate-800/95 text-white shadow-2xl shadow-slate-900/30 backdrop-blur-md max-w-[calc(100vw-2rem)]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2 }}
        >
          {aviso.tom === 'erro'
            ? <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            : <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
          <span className="text-[13px]">{aviso.texto}</span>
          {aviso.desfazer ? (
            <button
              type="button"
              onClick={() => { aviso.desfazer?.(); onClose(); }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-300 hover:bg-white/10 transition-colors"
            >
              Desfazer
            </button>
          ) : (
            <span className="w-2" />
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
