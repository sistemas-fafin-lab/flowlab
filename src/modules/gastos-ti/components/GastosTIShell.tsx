import React from 'react';
import { NavLink } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { Coins, LayoutDashboard, Receipt, CalendarRange, Target, type LucideIcon } from 'lucide-react';
import { ANEL_FOCO_INTERNO } from './ui/estilos';

// Cada aba é uma rota própria (/it/gastos/*) para o link ser compartilhável e o
// "voltar" do navegador funcionar. O menu lateral tem um subitem só ("Gastos de
// TI"), marcado com matchNested no Layout para continuar ativo em todas elas.
const ABAS: { to: string; rotulo: string; Icon: LucideIcon }[] = [
  { to: '/it/gastos', rotulo: 'Dashboard', Icon: LayoutDashboard },
  { to: '/it/gastos/despesas', rotulo: 'Despesas', Icon: Receipt },
  { to: '/it/gastos/mes-a-mes', rotulo: 'Mês a mês', Icon: CalendarRange },
  { to: '/it/gastos/orcamento', rotulo: 'Orçamento', Icon: Target },
];

interface GastosTIShellProps {
  subtitulo: string;
  /** Botões do canto direito do cabeçalho (ex.: "Nova despesa", "Exportar"). */
  acoes?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Cabeçalho + abas comuns às quatro telas do módulo, no visual do ITHubDashboard.
 * O MotionConfig faz o framer-motion obedecer ao "reduzir movimento" do sistema
 * (o CSS global só pega animações CSS): deslocamentos e escalas saem, o fade fica.
 */
const GastosTIShell: React.FC<GastosTIShellProps> = ({ subtitulo, acoes, children }) => (
  <MotionConfig reducedMotion="user">
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up">
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 bg-violet-500 rounded-2xl blur-xl opacity-40" />
            <div className="relative w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-violet-500/30 ring-4 ring-violet-500/15">
              <Coins className="w-7 h-7 text-white" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
              Gastos de TI
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitulo}</p>
          </div>
        </div>
        {acoes && <div className="flex items-center gap-2">{acoes}</div>}
      </div>

      <nav
        aria-label="Seções de Gastos de TI"
        className="overflow-x-auto animate-fade-in-up"
        style={{ animationDelay: '0.1s' }}
      >
        <div className="inline-flex bg-slate-200/50 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-1 shadow-inner border border-white/20 dark:border-slate-700/30">
          {ABAS.map(({ to, rotulo, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 ${ANEL_FOCO_INTERNO} ${
                  isActive
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`
              }
            >
              <Icon className="w-3.5 h-3.5" />
              {rotulo}
            </NavLink>
          ))}
        </div>
      </nav>

      {children}
    </div>
  </MotionConfig>
);

export default GastosTIShell;
