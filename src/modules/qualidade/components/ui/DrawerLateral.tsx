import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface DrawerLateralProps {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  /** `padrao` = `max-w-3xl`; `larga` = `sm:max-w-xl lg:max-w-4xl` (Cortesias, com grid 2 colunas). */
  largura?: 'padrao' | 'larga';
  aoFechar: () => void;
  /** Rodapé opcional (Cancelar/Salvar + mensagem de erro) — Câncer não tem, salva inline por seção. */
  footer?: ReactNode;
  children: ReactNode;
}

const LARGURA_CLASSE: Record<NonNullable<DrawerLateralProps['largura']>, string> = {
  padrao: 'max-w-3xl',
  larga: 'sm:max-w-xl lg:max-w-4xl',
};

/**
 * Esqueleto comum aos 4 drawers de curadoria de Qualidade: portal → overlay
 * → painel deslizante da direita → header (título/subtítulo + fechar) →
 * corpo → rodapé opcional. Loading/erro/dados do corpo continuam a cargo de
 * cada drawer via `children` — o layout interno (grid, espaçamento) varia
 * demais de um pra outro pra valer a pena forçar aqui.
 */
export function DrawerLateral({ titulo, subtitulo, largura = 'padrao', aoFechar, footer, children }: DrawerLateralProps) {
  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={aoFechar} />
      <div
        className={`relative flex h-full w-full animate-slide-in-right flex-col border-l border-slate-200/50 bg-white/90 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-gray-800/85 ${LARGURA_CLASSE[largura]}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-4 dark:border-white/10 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-gray-800 dark:text-slate-100">{titulo}</h2>
            {subtitulo && <p className="truncate text-sm text-gray-500 dark:text-slate-400">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="shrink-0 rounded-full p-1.5 text-gray-400 transition-all duration-200 hover:rotate-90 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {children}

        {footer}
      </div>
    </div>,
    document.body,
  );
}
