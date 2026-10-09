import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { ANEL_FOCO, CURVA_SAIDA, ROLAGEM } from './estilos';

interface PainelLateralProps {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  /** Ações no topo (Editar, Reajustar...). */
  acoes?: React.ReactNode;
  onFechar: () => void;
  /** Desliga o ESC enquanto um formulário aberto por cima trata o próprio ESC. */
  escAtivo?: boolean;
  children: React.ReactNode;
}

/**
 * Painel deslizante da direita (mesmo esqueleto do DrawerLateral de Qualidade,
 * copiado para não acoplar os módulos). z-[60]: os formulários abertos a
 * partir dele usam z-[70].
 */
const PainelLateral: React.FC<PainelLateralProps> = ({ titulo, subtitulo, acoes, onFechar, escAtivo = true, children }) => {
  useEffect(() => {
    if (!escAtivo) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar, escAtivo]);

  // Entra deslizando (e, dentro de um AnimatePresence, sai deslizando): fundo em
  // fade, painel com a curva de saída do dashboard. Sem AnimatePresence em volta,
  // a saída só desmonta — como antes.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true">
      <motion.div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        onClick={onFechar}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.38, ease: CURVA_SAIDA }}
        className="relative flex h-full w-full sm:max-w-2xl flex-col border-l border-slate-200/50 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-2xl"
      >
        <div className="border-b border-slate-100 dark:border-white/10 px-4 py-4 sm:px-6 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100 break-words">{titulo}</h2>
              {subtitulo && <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitulo}</div>}
            </div>
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className={`shrink-0 rounded-full p-1.5 text-slate-400 transition-[transform,background-color,color] duration-200 hover:rotate-90 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200 ${ANEL_FOCO}`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
        </div>
        <div className={`flex-1 overflow-y-auto px-4 py-5 sm:px-6 space-y-6 ${ROLAGEM}`}>{children}</div>
      </motion.div>
    </div>,
    document.body,
  );
};

export default PainelLateral;
