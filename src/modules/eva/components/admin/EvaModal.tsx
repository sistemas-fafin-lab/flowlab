import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

interface Props {
  aberto: boolean;
  titulo: string;
  subtitulo?: string;
  onFechar: () => void;
  rodape?: React.ReactNode;
  largura?: string;
  children: React.ReactNode;
}

/** Modal da administração da EVA (estrutura padrão do projeto: overlay + cabeçalho/corpo/rodapé). */
const EvaModal: React.FC<Props> = ({ aberto, titulo, subtitulo, onFechar, rodape, largura = 'max-w-lg', children }) => {
  useEffect(() => {
    if (!aberto) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [aberto, onFechar]);

  if (!aberto) return null;
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${largura} max-h-[calc(100vh-2rem)] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-white/60 dark:border-slate-700/60 shadow-2xl animate-fade-in-up`}
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{titulo}</h3>
            {subtitulo && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitulo}</p>}
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
        {rodape && <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-b-3xl flex justify-end gap-2">{rodape}</div>}
      </div>
    </div>,
    document.body,
  );
};

export default EvaModal;
