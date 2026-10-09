import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Table2, type LucideIcon } from 'lucide-react';
import Segmentado, { type OpcaoSegmento } from './Segmentado';
import { CURVA_SAIDA } from './estilos';

export const VIDRO = 'bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/50 dark:border-slate-700/50 shadow-sm';

type Modo = 'grafico' | 'tabela';

const MODOS: OpcaoSegmento<Modo>[] = [
  { valor: 'grafico', rotulo: 'Gráfico', icone: BarChart3, dica: 'Ver como gráfico' },
  { valor: 'tabela', rotulo: 'Tabela', icone: Table2, dica: 'Ver como tabela (os mesmos números)' },
];

interface WidgetProps {
  titulo: string;
  sub?: string;
  /** Ícone do selo em gradiente ao lado do título (como nos cartões do ITHubDashboard). */
  icone?: LucideIcon;
  /** Tabela equivalente ao gráfico (dataviz: todo gráfico tem uma). Ativa o alternador Gráfico/Tabela. */
  tabela?: React.ReactNode;
  acao?: React.ReactNode;
  className?: string;
  /** Posição no painel: escalona de leve a entrada dos cartões que aparecem juntos. */
  atraso?: number;
  children: React.ReactNode;
}

/**
 * Cartão de vidro do dashboard, no visual dos cartões de gráfico do
 * ITHubDashboard. Entra uma vez só, quando rola para a vista (nunca de novo ao
 * trocar filtro ou visão), e troca gráfico ↔ tabela num fade curto.
 */
const Widget: React.FC<WidgetProps> = ({ titulo, sub, icone: Icone, tabela, acao, className = '', atraso = 0, children }) => {
  const [modo, setModo] = useState<Modo>('grafico');
  const verTabela = modo === 'tabela' && Boolean(tabela);
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.55, ease: CURVA_SAIDA, delay: (atraso % 3) * 0.06 }}
      className={`${VIDRO} rounded-3xl p-5 sm:p-6 flex flex-col transition-shadow duration-300 hover:shadow-xl hover:shadow-slate-900/[0.04] dark:hover:shadow-black/30 ${className}`}
      aria-label={titulo}
    >
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-3 min-w-0">
          {Icone && (
            <span className="flex-shrink-0 p-2 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/25" aria-hidden="true">
              <Icone className="w-4 h-4 text-white" />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">{titulo}</h3>
            {sub && <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {acao}
          {tabela && <Segmentado<Modo> opcoes={MODOS} valor={modo} onMudar={setModo} ariaLabel={`Ver ${titulo} como`} tamanho="sm" />}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={verTabela ? 'tabela' : 'grafico'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: CURVA_SAIDA }}
            className="h-full"
          >
            {verTabela ? tabela : children}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.section>
  );
};

export default Widget;
