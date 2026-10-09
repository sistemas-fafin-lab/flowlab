import React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { CURVA_SAIDA } from '../ui/estilos';
import { VIDRO } from '../ui/Widget';

/**
 * Tons do selo e do brilho do canto, como os tiles do ITHubDashboard (um tom
 * por tile). É moldura, não dado: nenhuma série nem status usa essas cores.
 */
const TONS = {
  violeta: { selo: 'from-violet-500 to-purple-600 shadow-violet-500/30 ring-violet-500/20', brilho: 'bg-violet-500' },
  azul: { selo: 'from-blue-500 to-blue-600 shadow-blue-500/30 ring-blue-500/20', brilho: 'bg-blue-500' },
  indigo: { selo: 'from-indigo-500 to-violet-600 shadow-indigo-500/30 ring-indigo-500/20', brilho: 'bg-indigo-500' },
  ceu: { selo: 'from-sky-500 to-blue-600 shadow-sky-500/30 ring-sky-500/20', brilho: 'bg-sky-500' },
  ambar: { selo: 'from-amber-400 to-orange-500 shadow-orange-500/30 ring-orange-500/20', brilho: 'bg-orange-500' },
  esmeralda: { selo: 'from-emerald-500 to-teal-600 shadow-emerald-500/30 ring-emerald-500/20', brilho: 'bg-emerald-500' },
  ardosia: { selo: 'from-slate-400 to-slate-500 shadow-slate-500/20 ring-slate-500/15', brilho: 'bg-slate-400' },
} as const;

export type TomKpi = keyof typeof TONS;

interface KpiTileProps {
  rotulo: string;
  valor: React.ReactNode;
  sufixo?: string;
  sub?: React.ReactNode;
  /** Abaixo de tudo, na largura do tile (medidor, link de vencidas). */
  extra?: React.ReactNode;
  /** Canto superior direito, ao lado do selo (sparkline). */
  canto?: React.ReactNode;
  icone: LucideIcon;
  tom: TomKpi;
  /** Ordem no grid: escalona a entrada (50 ms entre tiles). */
  indice: number;
}

/**
 * Stat tile no padrão do ITHubDashboard: selo em gradiente com anel, valor
 * grande, rótulo em caixa-alta, brilho no canto e leve elevação ao passar o
 * mouse. O valor em reais pede um corpo menor que o 5xl dos contadores do Hub.
 */
const KpiTile: React.FC<KpiTileProps> = ({ rotulo, valor, sufixo, sub, extra, canto, icone: Icone, tom, indice }) => {
  const t = TONS[tom];
  // Entrada no invólucro (framer) e elevação no cartão (CSS, como no Hub): se as
  // duas ficassem no mesmo elemento, o atraso da entrada atrasaria o hover.
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: CURVA_SAIDA, delay: 0.1 + indice * 0.05 }}
      className="h-full"
    >
      <div
        className={`${VIDRO} group relative h-full overflow-hidden rounded-3xl p-5 transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-900/[0.06] dark:hover:shadow-black/40`}
      >
        <div
          className={`pointer-events-none absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 transition-opacity duration-300 group-hover:opacity-35 ${t.brilho}`}
        />
        <div className="relative flex items-start justify-between gap-3">
          <span className={`inline-flex w-10 h-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg ring-4 ${t.selo}`} aria-hidden="true">
            <Icone className="w-5 h-5 text-white" />
          </span>
          {canto && <div className="min-w-0">{canto}</div>}
        </div>
        {/* No xl são 3 tiles ao lado do menu lateral (~260px de texto a 1280px): o corpo
            cai para 2xl ali e volta a 1.75rem só no 2xl. O número nunca quebra; o sufixo
            desce de linha se faltar espaço — nada é cortado pelo overflow do brilho. */}
        <p className="relative mt-4 flex flex-wrap items-baseline gap-x-1 text-2xl sm:text-[1.75rem] xl:text-2xl 2xl:text-[1.75rem] font-extrabold tracking-tight leading-none text-slate-900 dark:text-white">
          <span className="whitespace-nowrap">{valor}</span>
          {sufixo && <span className="text-sm font-semibold tracking-normal text-slate-400 dark:text-slate-500">{sufixo}</span>}
        </p>
        <p className="relative mt-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{rotulo}</p>
        {sub && <div className="relative mt-1.5 text-xs text-slate-500 dark:text-slate-400">{sub}</div>}
        {extra && <div className="relative mt-3">{extra}</div>}
      </div>
    </motion.div>
  );
};

export default KpiTile;
