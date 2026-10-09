import React, { useMemo } from 'react';
import { CalendarClock } from 'lucide-react';
import { formatCurrency } from '../../../../utils/paymentUtils';
import { competenciaDaData, ehCompetencia, formatarCompetencia, somarMeses } from '../../domain/competencia';
import { equivalenteMensal, ocorrenciasNoIntervalo, type DespesaRecorrente } from '../../domain/recorrencia';

interface PreviaOcorrenciasProps {
  /** null enquanto o formulário ainda não tem valor, recorrência, início e vencimento válidos. */
  despesa: DespesaRecorrente | null;
  /** 'YYYY-MM-DD' */
  hoje: string;
}

const QUANTIDADE = 6;

const formatarData = (iso: string): string => {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
};

/**
 * Próximas 6 ocorrências enquanto a despesa é cadastrada, para quem cadastra
 * ver na hora se a recorrência ficou certa (plano §7). Despesa com início no
 * passado mostra a partir do mês atual; futura, a partir do início.
 */
const PreviaOcorrencias: React.FC<PreviaOcorrenciasProps> = ({ despesa, hoje }) => {
  const previa = useMemo(() => {
    if (!despesa || !ehCompetencia(despesa.competenciaInicio)) return null;
    const atual = competenciaDaData(hoje) as string;
    const desde = despesa.competenciaInicio > atual ? despesa.competenciaInicio : atual;
    const doze = ocorrenciasNoIntervalo(despesa, desde, somarMeses(desde, 11));
    return {
      proximas: ocorrenciasNoIntervalo(despesa, desde, somarMeses(desde, 12 * QUANTIDADE)).slice(0, QUANTIDADE),
      totalDozeMeses: doze.reduce((soma, o) => soma + o.valorPrevisto, 0),
      equivalente: equivalenteMensal(despesa, desde),
    };
  }, [despesa, hoje]);

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-800/40 p-4">
      <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <CalendarClock className="w-4 h-4" /> Prévia das próximas cobranças
      </h4>

      {!previa ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Preencha valor, recorrência, mês inicial e dia de vencimento para ver a prévia.
        </p>
      ) : previa.proximas.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Nenhuma cobrança a partir deste mês: a despesa já terminou.
        </p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-slate-200/70 dark:divide-slate-700/60">
            {previa.proximas.map((o) => (
              <li key={o.competencia} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span className="text-slate-700 dark:text-slate-200">{formatarCompetencia(o.competencia)}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">vence {formatarData(o.vencimento)}</span>
                <span className="ml-auto font-medium text-slate-800 dark:text-slate-100 tabular-nums">
                  {formatCurrency(o.valorPrevisto)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Equivalente mensal</dt>
              <dd className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {previa.equivalente === null ? 'não entra (única)' : formatCurrency(previa.equivalente)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Próximos 12 meses</dt>
              <dd className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {formatCurrency(previa.totalDozeMeses)}
              </dd>
            </div>
          </dl>
        </>
      )}
    </div>
  );
};

export default PreviaOcorrencias;
