import React from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, Hand, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../../../../utils/paymentUtils';
import type { Renovacao } from '../../domain/alertas';
import Vazio from '../ui/Vazio';
import { CURVA_SAIDA } from '../ui/estilos';

const formatarData = (iso: string): string => {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
};

/** Contratos que terminam ou renovam nos próximos 90 dias (RF21), do mais próximo ao mais distante. */
const RenovacoesCard: React.FC<{ renovacoes: Renovacao[] }> = ({ renovacoes }) => {
  if (renovacoes.length === 0) return <Vazio icone={CalendarClock}>Nenhum contrato termina nos próximos 90 dias.</Vazio>;
  return (
    <ul className="space-y-2">
      {renovacoes.map((r, i) => (
        <motion.li
          key={r.despesa.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: CURVA_SAIDA, delay: Math.min(i, 8) * 0.04 }}
          className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-700/40 transition-colors"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{r.despesa.descricao}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {r.despesa.fornecedorNome} · termina em {formatarData(r.termino)} · {formatCurrency(r.anualizado)}/ano
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
              {r.dias === 0 ? 'hoje' : `${r.dias} ${r.dias === 1 ? 'dia' : 'dias'}`}
            </span>
            {r.automatica ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ring-1 ring-slate-200/70 dark:ring-slate-700/60">
                <RefreshCw className="w-3 h-3" aria-hidden="true" /> renova sozinha
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 ring-1 ring-amber-200/70 dark:ring-amber-500/20">
                <Hand className="w-3 h-3" aria-hidden="true" /> exige decisão
              </span>
            )}
          </div>
        </motion.li>
      ))}
    </ul>
  );
};

export default RenovacoesCard;
