import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, type LucideIcon } from 'lucide-react';

interface ModalFormularioProps {
  titulo: string;
  subtitulo?: string;
  icone: LucideIcon;
  onFechar: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  /** Enquanto grava, ESC e o X não fecham (evita perder o resultado do salvamento). */
  ocupado?: boolean;
  rotuloSalvar: string;
  /** Mensagem geral acima do rodapé (erro do banco, "confira os campos"). */
  erro?: string | null;
  largura?: 'md' | 'lg' | 'xl';
  /** `perigo` deixa o botão de confirmar vermelho (excluir). */
  variante?: 'padrao' | 'perigo';
  children: React.ReactNode;
}

const LARGURAS = { md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' } as const;
const BOTAO_CONFIRMAR = {
  padrao: 'bg-violet-600 hover:bg-violet-700',
  perigo: 'bg-red-600 hover:bg-red-700',
} as const;

/**
 * Moldura dos formulários do módulo (despesa, reajuste, baixa, ajuste). Mesmo
 * vidro do DetailModal, mas com rodapé Cancelar/Salvar e sem fechar ao clicar
 * fora — num formulário grande, um clique errado não pode descartar o que foi
 * digitado.
 */
const ModalFormulario: React.FC<ModalFormularioProps> = ({
  titulo,
  subtitulo,
  icone: Icone,
  onFechar,
  onSubmit,
  ocupado = false,
  rotuloSalvar,
  erro,
  largura = 'lg',
  variante = 'padrao',
  children,
}) => {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !ocupado) onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar, ocupado]);

  return (
    // z-[70]: acima do painel lateral da despesa (z-[60]), de onde reajuste/encerrar/editar são abertos.
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 animate-fade-in">
      <motion.form
        noValidate
        onSubmit={onSubmit}
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-formulario-titulo"
        className={`relative w-full ${LARGURAS[largura]} max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden rounded-3xl border border-white dark:border-slate-700/50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl`}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6 border-b border-slate-200/70 dark:border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30 flex-shrink-0">
              <Icone className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 id="modal-formulario-titulo" className="text-lg font-bold text-slate-900 dark:text-white truncate">
                {titulo}
              </h2>
              {subtitulo && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitulo}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={ocupado}
            aria-label="Fechar"
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-red-50/60 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 scrollbar-thin">{children}</div>

        <div className="flex-shrink-0 border-t border-slate-200/70 dark:border-slate-700/50 bg-slate-50/70 dark:bg-slate-800/50 px-4 py-3 sm:px-6">
          {erro && (
            <p role="alert" className="mb-3 text-sm text-red-700 dark:text-red-300">
              {erro}
            </p>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              type="button"
              onClick={onFechar}
              disabled={ocupado}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 disabled:opacity-40 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={ocupado}
              className={`px-5 py-2 rounded-xl text-sm font-semibold text-white ${BOTAO_CONFIRMAR[variante]} disabled:opacity-60 disabled:cursor-not-allowed transition-colors`}
            >
              {ocupado ? 'Salvando...' : rotuloSalvar}
            </button>
          </div>
        </div>
      </motion.form>
    </div>
  );
};

export default ModalFormulario;
