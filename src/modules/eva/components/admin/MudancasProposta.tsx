import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { LinhaMudanca } from './propostas';

/** O "antes → depois" de uma proposta: na fila de sugestões, no chat e no diálogo dos comentários. */
const MudancasProposta: React.FC<{ linhas: LinhaMudanca[]; compacto?: boolean }> = ({ linhas, compacto = false }) => (
  <dl className={`grid gap-1.5 ${compacto ? 'text-xs' : 'text-[13px]'}`}>
    {linhas.map((l) => (
      <div key={l.campo} className="flex gap-3">
        <dt className={`${compacto ? 'w-24' : 'w-28'} flex-shrink-0 text-slate-500 dark:text-slate-400`}>{l.campo}</dt>
        <dd className="flex items-center gap-2 flex-wrap text-slate-800 dark:text-slate-100 min-w-0">
          {l.antes !== undefined && (
            <>
              <span className="text-slate-400 dark:text-slate-500 line-through">{l.antes}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </>
          )}
          <span className="[overflow-wrap:anywhere]">{l.depois}</span>
        </dd>
      </div>
    ))}
  </dl>
);

export default MudancasProposta;
