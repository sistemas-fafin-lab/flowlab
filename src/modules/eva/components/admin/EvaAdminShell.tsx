import React from 'react';
import { NavLink } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { CalendarClock, ClipboardCheck, Settings, Users, type LucideIcon } from 'lucide-react';
import { usePapeisEva } from '../../hooks/useAgenteAdmin';
import { EvaOrb } from '../EvaOrb';

interface Aba {
  to: string;
  rotulo: string;
  Icon: LucideIcon;
  /** Abas com dados sensíveis (telefones, configuração) só para quem configura a EVA (§7, D31). */
  soQuemConfigura?: boolean;
}

// Cada aba é uma rota própria (/it/eva/*): link compartilhável e "voltar" funcionando.
// O menu lateral tem um subitem só ("EVA"), com matchNested no Layout.
const ABAS: Aba[] = [
  { to: '/it/eva', rotulo: 'Sugestões', Icon: ClipboardCheck },
  { to: '/it/eva/reunioes', rotulo: 'Reuniões', Icon: CalendarClock },
  { to: '/it/eva/membros', rotulo: 'Membros', Icon: Users, soQuemConfigura: true },
  { to: '/it/eva/configuracoes', rotulo: 'Configurações', Icon: Settings, soQuemConfigura: true },
];

interface Props {
  subtitulo: string;
  acoes?: React.ReactNode;
  children: React.ReactNode;
}

/** Cabeçalho + abas da administração da EVA, no visual do Gastos de TI e do Hub. */
const EvaAdminShell: React.FC<Props> = ({ subtitulo, acoes, children }) => {
  const { configura } = usePapeisEva();
  const abas = ABAS.filter((a) => !a.soQuemConfigura || configura);

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-6 pb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center">
              <EvaOrb size={52} />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                EVA
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitulo}</p>
            </div>
          </div>
          {acoes && <div className="flex items-center gap-2">{acoes}</div>}
        </div>

        <nav aria-label="Seções da EVA" className="overflow-x-auto animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="inline-flex bg-slate-200/50 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-1 shadow-inner border border-white/20 dark:border-slate-700/30">
            {abas.map(({ to, rotulo, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
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
};

export default EvaAdminShell;
