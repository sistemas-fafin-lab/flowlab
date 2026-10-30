import React, { useState } from 'react';
import { Building2, CalendarDays, ChevronDown, Mail, ShieldCheck, Users } from 'lucide-react';
import { formatCPF } from '../../../utils/cpf';
import type { Colaborador } from '../types';
import { formatDataBR, iniciais } from '../utils/colaboradorFormato';

interface ColaboradorResumoCardProps {
  colaborador: Colaborador;
  /** Classes extras do contêiner (ex.: sticky no Meu perfil). */
  className?: string;
  /** Largura abaixo da qual o card começa recolhido: `md` (modal do RH) ou `min-[940px]` (Meu perfil). */
  recolherAte?: 'md' | 'min-[940px]';
}

// Classes literais (o Tailwind não enxerga classes montadas por interpolação).
const RECOLHIMENTO = {
  md: { botao: 'md:hidden', corpo: 'md:block' },
  'min-[940px]': { botao: 'min-[940px]:hidden', corpo: 'min-[940px]:block' },
} as const;

interface LinhaProps {
  icone: React.ReactNode;
  rotulo: string;
  children: React.ReactNode;
}

const Linha: React.FC<LinhaProps> = ({ icone, rotulo, children }) => (
  <div className="flex items-start gap-3 py-2.5">
    <span className="mt-0.5 text-gray-400 dark:text-gray-500 flex-shrink-0">{icone}</span>
    <div className="min-w-0">
      <div className="text-xs text-gray-500 dark:text-gray-400">{rotulo}</div>
      <div className="text-sm font-medium text-gray-800 dark:text-gray-100 break-words">{children}</div>
    </div>
  </div>
);

const vazio = <span className="font-normal text-gray-400 dark:text-gray-500">—</span>;

/**
 * Card de resumo do colaborador (protótipo: variação B, sem remuneração, sem
 * centro de custo e sem atalho de holerite). Componente puro — usado na ficha
 * do RH e no Meu perfil.
 */
const ColaboradorResumoCard: React.FC<ColaboradorResumoCardProps> = ({ colaborador, className = '', recolherAte = 'md' }) => {
  // Em tela estreita o card começa recolhido (só cabeçalho).
  const [expandido, setExpandido] = useState(false);
  const recolhimento = RECOLHIMENTO[recolherAte];

  return (
    <div className={`rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ${className}`}>
      <div className="flex items-center gap-3 p-4">
        <div className="w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-lg font-semibold flex-shrink-0">
          {iniciais(colaborador.nome)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-gray-800 dark:text-gray-100 truncate">{colaborador.nome}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{colaborador.cargo || 'Cargo não informado'}</div>
        </div>
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          aria-expanded={expandido}
          aria-label={expandido ? 'Ocultar resumo' : 'Ver resumo completo'}
          className={`${recolhimento.botao} p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${expandido ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className={`${expandido ? 'block' : 'hidden'} ${recolhimento.corpo} px-4 pb-3 border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/60`}>
        <Linha icone={<Building2 className="w-4 h-4" />} rotulo="Departamento">
          {colaborador.departamentoNome || vazio}
        </Linha>
        <Linha icone={<CalendarDays className="w-4 h-4" />} rotulo="Data de admissão">
          {formatDataBR(colaborador.dataAdmissao) ?? vazio}
        </Linha>
        <Linha icone={<Users className="w-4 h-4" />} rotulo="Gestor">
          {colaborador.gestor?.nome ?? <span className="font-normal text-gray-400 dark:text-gray-500">Sem gestor definido</span>}
        </Linha>
        <Linha icone={<ShieldCheck className="w-4 h-4" />} rotulo="CPF · somente leitura">
          {colaborador.cpf ? formatCPF(colaborador.cpf) : vazio}
        </Linha>
        <Linha icone={<Mail className="w-4 h-4" />} rotulo="E-mail">
          {colaborador.email || vazio}
        </Linha>
      </div>
    </div>
  );
};

export default ColaboradorResumoCard;
