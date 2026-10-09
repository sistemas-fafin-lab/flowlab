import { useId } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import Dica from './Flutuante';
import { ANEL_FOCO_INTERNO } from './estilos';

export interface OpcaoSegmento<T extends string> {
  valor: T;
  rotulo: string;
  icone?: LucideIcon;
  /** Explicação em dica de vidro (no lugar do `title`). */
  dica?: string;
}

interface SegmentadoProps<T extends string> {
  opcoes: readonly OpcaoSegmento<T>[];
  valor: T;
  onMudar: (v: T) => void;
  ariaLabel: string;
  /** 'sm' = compacto (cabeçalho dos cartões): só o ícone, o rótulo vai no aria-label e na dica. */
  tamanho?: 'sm' | 'md';
}

/**
 * Controle segmentado do ITHubDashboard (trilho em vidro, pílula branca), com
 * a pílula deslizando de uma opção para a outra (layoutId do framer-motion).
 */
function Segmentado<T extends string>({ opcoes, valor, onMudar, ariaLabel, tamanho = 'md' }: SegmentadoProps<T>) {
  const id = useId();
  const sm = tamanho === 'sm';
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      // Uma linha só: no celular o trilho rola de lado (barra escondida), como os segmentados do iOS, em vez de quebrar.
      className="inline-flex max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-slate-200/50 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-1 shadow-inner border border-white/20 dark:border-slate-700/30"
    >
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        const Icone = o.icone;
        const botao = (
          <button
            type="button"
            aria-pressed={ativo}
            aria-label={sm && Icone ? o.rotulo : undefined}
            onClick={() => onMudar(o.valor)}
            className={`relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-colors duration-200 ${ANEL_FOCO_INTERNO} ${sm ? 'px-2 py-1.5 text-[11px]' : 'px-3.5 py-1.5 text-xs'} ${
              ativo ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {ativo && (
              <motion.span
                layoutId={`segmento-${id}`}
                aria-hidden="true"
                className="absolute inset-0 rounded-lg bg-white dark:bg-slate-700 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                transition={{ type: 'spring', stiffness: 520, damping: 40, mass: 0.8 }}
              />
            )}
            {Icone && <Icone className="relative w-3.5 h-3.5" aria-hidden="true" />}
            {!(sm && Icone) && <span className="relative">{o.rotulo}</span>}
          </button>
        );
        return o.dica ? (
          <Dica key={o.valor} conteudo={o.dica} largura={240}>
            {botao}
          </Dica>
        ) : (
          <span key={o.valor} className="inline-flex">
            {botao}
          </span>
        );
      })}
    </div>
  );
}

export default Segmentado;
