import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface DocumentoModalShellProps {
  tituloId: string;
  sobretitulo: string;
  titulo: string;
  onClose: () => void;
  /** Bloqueia ESC, clique fora e o X (ex.: envio em andamento). */
  bloqueado?: boolean;
  larguraClassName?: string;
  rodape?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Modal sobre a ficha ou o Meu perfil. Portal no body (o layout tem ancestral
 * com transform) e ESC tratado na captura da window: assim o ESC fecha só este
 * modal, sem chegar ao listener da ficha no document.
 */
const DocumentoModalShell: React.FC<DocumentoModalShellProps> = ({
  tituloId,
  sobretitulo,
  titulo,
  onClose,
  bloqueado = false,
  larguraClassName = 'sm:max-w-[880px]',
  rodape,
  children,
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (!bloqueado) onClose();
    };
    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [onClose, bloqueado]);

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-stretch sm:items-center justify-center z-50 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && !bloqueado && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className={`bg-white dark:bg-slate-900 sm:rounded-3xl shadow-2xl w-full sm:max-h-[85vh] flex flex-col overflow-hidden ${larguraClassName}`}
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-slate-700/50">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{sobretitulo}</p>
            <h2 id={tituloId} className="text-lg font-semibold text-gray-900 dark:text-white">{titulo}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={bloqueado}
            title="Fechar"
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
        {rodape && (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-100 dark:border-slate-700/50 flex justify-end gap-2">{rodape}</div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default DocumentoModalShell;
