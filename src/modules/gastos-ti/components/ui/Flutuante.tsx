import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CURVA_SAIDA } from './estilos';

const MARGEM = 8;
const DISTANCIA = 8;

interface BalaoFlutuanteProps {
  /** Elemento ao qual o balão se ancora (null = fechado). */
  ancora: HTMLElement | null;
  children: React.ReactNode;
  id?: string;
  /** Largura máxima do balão. */
  largura?: number;
}

/**
 * Balão flutuante em vidro escuro, por portal com `position: fixed` (nenhum
 * `overflow` de cartão o corta). Prefere ficar acima da âncora e desce quando
 * não cabe; fica dentro da janela na horizontal. Acompanha rolagem e resize.
 */
export const BalaoFlutuante: React.FC<BalaoFlutuanteProps> = ({ ancora, children, id, largura = 280 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [posicao, setPosicao] = useState<{ left: number; top: number; acima: boolean } | null>(null);

  const posicionar = useCallback(() => {
    if (!ancora || !ref.current) return;
    const r = ancora.getBoundingClientRect();
    const { offsetWidth: w, offsetHeight: h } = ref.current;
    const acima = r.top - h - DISTANCIA >= MARGEM;
    const top = acima ? r.top - h - DISTANCIA : r.bottom + DISTANCIA;
    const left = Math.max(MARGEM, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - MARGEM));
    setPosicao({ left, top, acima });
  }, [ancora]);

  // Mede antes de pintar: o balão nasce invisível fora da tela e já aparece no
  // lugar. Ao fechar, a última posição fica (a saída anima onde ele estava).
  useLayoutEffect(() => {
    if (!ancora) return;
    posicionar();
    window.addEventListener('scroll', posicionar, true);
    window.addEventListener('resize', posicionar);
    return () => {
      window.removeEventListener('scroll', posicionar, true);
      window.removeEventListener('resize', posicionar);
    };
  }, [ancora, posicionar, children]);

  return createPortal(
    <AnimatePresence>
      {ancora && (
        <motion.div
          key="balao"
          ref={ref}
          id={id}
          role="tooltip"
          initial={{ opacity: 0, scale: 0.96, y: posicao?.acima === false ? -4 : 4 }}
          animate={{ opacity: posicao ? 1 : 0, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
          transition={{ duration: 0.16, ease: CURVA_SAIDA }}
          style={{ position: 'fixed', left: posicao?.left ?? -9999, top: posicao?.top ?? -9999, maxWidth: largura, transformOrigin: posicao?.acima === false ? 'top center' : 'bottom center' }}
          className="z-[10001] pointer-events-none rounded-xl px-3 py-2 text-xs leading-relaxed text-slate-100 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-xl ring-1 ring-white/10 shadow-[0_12px_32px_-6px_rgba(15,23,42,0.45)]"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

interface DicaProps {
  conteudo: React.ReactNode;
  children: React.ReactNode;
  /** Envolve com `div` (linhas, blocos) em vez de `span` (texto, ícones). */
  bloco?: boolean;
  className?: string;
  largura?: number;
}

/**
 * Dica em vidro no lugar do `title` do navegador: aparece com 120 ms de hover
 * ou no foco do teclado (de qualquer filho focável) e some com Esc, como pede a
 * WCAG 1.4.13. É complemento visual — o texto acessível fica no aria-label de quem a usa.
 */
const Dica: React.FC<DicaProps> = ({ conteudo, children, bloco = false, className = '', largura }) => {
  const [ancora, setAncora] = useState<HTMLElement | null>(null);
  const atraso = useRef<number>();
  const id = useId();
  const Tag = bloco ? 'div' : 'span';

  const mostrar = (el: HTMLElement, imediato = false) => {
    window.clearTimeout(atraso.current);
    if (imediato) setAncora(el);
    else atraso.current = window.setTimeout(() => setAncora(el), 120);
  };
  const esconder = () => {
    window.clearTimeout(atraso.current);
    setAncora(null);
  };

  useEffect(() => {
    if (!ancora) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && setAncora(null);
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [ancora]);

  useEffect(() => () => window.clearTimeout(atraso.current), []);

  return (
    <Tag
      className={`${bloco ? 'block' : 'inline-flex'} ${className}`}
      onMouseEnter={(e: React.MouseEvent<HTMLElement>) => mostrar(e.currentTarget)}
      onMouseLeave={esconder}
      // Clique/toque fecha: senão a dica fica por cima do que o clique abriu (ex.: o painel do drill-down).
      onPointerDown={esconder}
      onFocus={(e: React.FocusEvent<HTMLElement>) => (e.target as HTMLElement).matches(':focus-visible') && mostrar(e.currentTarget, true)}
      onBlur={esconder}
    >
      {children}
      <BalaoFlutuante ancora={ancora} id={id} largura={largura}>
        {conteudo}
      </BalaoFlutuante>
    </Tag>
  );
};

export default Dica;
