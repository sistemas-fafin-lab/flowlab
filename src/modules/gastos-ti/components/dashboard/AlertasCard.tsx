import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, Info, type LucideIcon } from 'lucide-react';
import type { Alerta, SeveridadeAlerta } from '../../domain/alertas';
import Vazio from '../ui/Vazio';
import { CURVA_SAIDA, LINK_ACAO } from '../ui/estilos';

const ESTILO: Record<SeveridadeAlerta, { icone: LucideIcon; rotulo: string; classe: string; selo: string }> = {
  alta: { icone: AlertCircle, rotulo: 'Alta', classe: 'text-red-600 dark:text-red-400', selo: 'bg-red-50 dark:bg-red-500/10 ring-red-200/70 dark:ring-red-500/20' },
  media: { icone: AlertTriangle, rotulo: 'Média', classe: 'text-amber-600 dark:text-amber-400', selo: 'bg-amber-50 dark:bg-amber-500/10 ring-amber-200/70 dark:ring-amber-500/20' },
  baixa: { icone: Info, rotulo: 'Baixa', classe: 'text-slate-500 dark:text-slate-400', selo: 'bg-slate-100 dark:bg-slate-800 ring-slate-200/70 dark:ring-slate-700/60' },
};

const LIMITE_INICIAL = 6;

/** Alertas por severidade, cada um com ícone + rótulo — a cor de status nunca é a única pista (dataviz). */
const AlertasCard: React.FC<{ alertas: Alerta[] }> = ({ alertas }) => {
  const [todos, setTodos] = useState(false);
  if (alertas.length === 0) {
    return (
      <Vazio icone={CheckCircle2} tom="bom">
        Tudo em dia: nenhuma cobrança vencida, desvio, renovação pendente ou orçamento no limite.
      </Vazio>
    );
  }
  const visiveis = todos ? alertas : alertas.slice(0, LIMITE_INICIAL);
  return (
    <div>
      <ul className="space-y-2">
        {visiveis.map((a, i) => {
          const { icone: Icone, rotulo, classe, selo } = ESTILO[a.severidade];
          return (
            <motion.li
              key={a.chave}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: CURVA_SAIDA, delay: Math.min(i, 8) * 0.04 }}
              className="flex items-start gap-3 rounded-2xl px-3 py-2.5 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-700/40 transition-colors"
            >
              <span className={`flex-shrink-0 inline-flex w-7 h-7 items-center justify-center rounded-lg ring-1 ${selo}`} aria-hidden="true">
                <Icone className={`w-4 h-4 ${classe}`} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  <span className="sr-only">Severidade {rotulo}: </span>
                  {a.titulo}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{a.detalhe}</p>
              </div>
            </motion.li>
          );
        })}
      </ul>
      {alertas.length > LIMITE_INICIAL && (
        <button type="button" onClick={() => setTodos((t) => !t)} className={`mt-3 ${LINK_ACAO}`}>
          {todos ? 'Mostrar menos' : `Ver todos os ${alertas.length} alertas`}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${todos ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export default AlertasCard;
