import React, { useEffect } from 'react';
import { Eye, FileText, Image, X } from 'lucide-react';
import { useTravarRolagem } from '../hooks/useTravarRolagem';

export interface ImagemAberta {
  url: string;
  nome: string;
}

interface Props {
  imagem: ImagemAberta | null;
  onFechar: () => void;
}

/** Anexo de imagem em tela cheia, com baixar e abrir em nova aba. Fecha no Esc ou clicando fora. */
const VisualizadorImagem: React.FC<Props> = ({ imagem, onFechar }) => {
  useTravarRolagem(!!imagem);
  useEffect(() => {
    if (!imagem) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [imagem, onFechar]);

  if (!imagem) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in p-2 sm:p-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      onClick={onFechar}
    >
      <div className="relative w-full h-full max-w-7xl flex flex-col">
        <div className="flex items-center justify-between mb-2 sm:mb-4 px-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Image className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-white font-semibold text-sm sm:text-lg truncate">{imagem.nome}</h3>
              <p className="text-white/60 text-xs sm:text-sm hidden sm:block">Clique fora da imagem ou tecle Esc para fechar</p>
            </div>
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="w-8 h-8 sm:w-10 sm:h-10 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-all group flex-shrink-0 ml-2"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:scale-110 transition-transform" />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center overflow-hidden min-h-0" onClick={(e) => e.stopPropagation()}>
          <img
            src={imagem.url}
            alt={imagem.nome}
            className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg shadow-2xl"
          />
        </div>

        <div className="flex items-center justify-center gap-2 sm:gap-3 mt-2 sm:mt-4 flex-shrink-0">
          <a
            href={imagem.url}
            download={imagem.nome}
            className="px-3 py-2 sm:px-4 sm:py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center gap-2 transition-all text-xs sm:text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Download</span>
            <span className="sm:hidden">Baixar</span>
          </a>
          <a
            href={imagem.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 sm:px-4 sm:py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center gap-2 transition-all text-xs sm:text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Abrir em nova aba</span>
            <span className="sm:hidden">Nova aba</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default VisualizadorImagem;
