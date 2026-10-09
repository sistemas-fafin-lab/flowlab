import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, PiggyBank } from 'lucide-react';
import { formatCurrency } from '../../../../utils/paymentUtils';
import { RECORRENCIA_ROTULO } from '../../constants';
import { formatarCompetencia } from '../../domain/competencia';
import type { Economia } from '../../domain/detalhamento';
import NumeroAnimado from '../ui/NumeroAnimado';
import Vazio from '../ui/Vazio';
import { CURVA_SAIDA, LINK_ACAO } from '../ui/estilos';

const LIMITE_INICIAL = 5;

/**
 * Economias de renegociação (RF25): o número é a peça principal (dataviz: uma
 * história de um número só vira stat, não gráfico); a lista mostra de onde veio.
 */
const EconomiasCard: React.FC<{ economias: Economia[] }> = ({ economias }) => {
  const [todas, setTodas] = useState(false);
  if (economias.length === 0) {
    return <Vazio icone={PiggyBank}>Nenhuma renegociação que baixou o valor no período. Registre como reajuste com o motivo “Renegociação”.</Vazio>;
  }
  const total = economias.reduce((s, e) => s + e.anualizada, 0);
  const visiveis = todas ? economias : economias.slice(0, LIMITE_INICIAL);
  return (
    <div>
      <div className="relative overflow-hidden flex items-center gap-4 rounded-2xl p-4 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent ring-1 ring-emerald-500/20">
        <div className="pointer-events-none absolute -right-8 -top-8 w-28 h-28 rounded-full blur-2xl opacity-25 bg-emerald-500" />
        <span className="relative inline-flex w-11 h-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30 ring-4 ring-emerald-500/20 flex-shrink-0" aria-hidden="true">
          <PiggyBank className="w-5 h-5 text-white" />
        </span>
        <div className="relative">
          <p className="text-[1.75rem] font-extrabold tracking-tight leading-none text-slate-900 dark:text-white">
            <NumeroAnimado valor={total} formatar={formatCurrency} />
            <span className="ml-0.5 text-sm font-semibold tracking-normal text-slate-400 dark:text-slate-500">/ano</span>
          </p>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
            {economias.length} {economias.length === 1 ? 'renegociação' : 'renegociações'} com vigência no período
          </p>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {visiveis.map((e, i) => (
          <motion.li
            key={e.reajusteId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: CURVA_SAIDA, delay: Math.min(i, 8) * 0.04 }}
            className="flex items-start justify-between gap-3 rounded-2xl px-3 py-2.5 text-xs bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-700/40 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{e.despesa.descricao}</p>
              <p className="text-slate-500 dark:text-slate-400 truncate">
                {e.despesa.fornecedorNome} · desde {formatarCompetencia(e.vigenteDesde)} · {formatCurrency(e.anterior)} → {formatCurrency(e.novo)} (
                {RECORRENCIA_ROTULO[e.despesa.recorrencia].toLowerCase()})
              </p>
            </div>
            <span className="flex-shrink-0 font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(e.anualizada)}/ano</span>
          </motion.li>
        ))}
      </ul>
      {economias.length > LIMITE_INICIAL && (
        <button type="button" onClick={() => setTodas((t) => !t)} className={`mt-3 ${LINK_ACAO}`}>
          {todas ? 'Mostrar menos' : `Ver todas as ${economias.length}`}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${todas ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export default EconomiasCard;
