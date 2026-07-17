import React, { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import type { DocumentoCheckin } from '../types';

/**
 * Visualizador das imagens que o paciente enviou, aberto por cima da conferência.
 *
 * Vai num portal para o body por necessidade, não por estilo: o overlay do
 * ConferenciaModal usa backdrop-blur, e backdrop-filter cria bloco de contenção —
 * um `fixed` descendente ficaria preso dentro do modal em vez de cobrir a tela.
 *
 * Só recebe imagens; PDF abre em aba nova (ver DocumentoThumb).
 */
export const DocumentoLightbox: React.FC<{
  documentos: DocumentoCheckin[];
  indice: number;
  onNavegar: (indice: number) => void;
  onClose: () => void;
}> = ({ documentos, indice, onNavegar, onClose }) => {
  const total = documentos.length;
  const doc = documentos[indice];

  const anterior = useCallback(
    () => onNavegar((indice - 1 + total) % total),
    [indice, total, onNavegar],
  );
  const proximo = useCallback(() => onNavegar((indice + 1) % total), [indice, total, onNavegar]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') anterior();
      else if (e.key === 'ArrowRight') proximo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, anterior, proximo]);

  if (!doc) return null;

  return createPortal(
    // z-[60] fica acima do z-50 do ConferenciaModal.
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-[60] animate-fade-in"
      onClick={onClose}
    >
      {/* Barra superior */}
      <div
        className="w-full max-w-4xl flex items-center justify-between gap-3 mb-3 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-medium text-white/90 truncate">{doc.nomeArquivo}</span>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir
          </a>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Imagem + navegação */}
      <div
        className="relative flex items-center justify-center gap-3 min-h-0 flex-1 w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {total > 1 && (
          <button
            onClick={anterior}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        <img
          src={doc.url}
          alt={doc.nomeArquivo}
          className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
        />
        {total > 1 && (
          <button
            onClick={proximo}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {total > 1 && (
        <div className="mt-3 text-xs font-medium text-white/60 shrink-0">
          {indice + 1} / {total}
        </div>
      )}
    </div>,
    document.body,
  );
};
