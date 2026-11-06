import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import { useComparativosFunilGlosa } from '../hooks/useComparativosFunilGlosa';
import { formatCompetencia, formatCurrency } from '../utils/formato';
import { FORA_DE_LOTE } from '../utils/funilGlosa';

// Aba Comparativos → Funil de glosa por competência (mês de emissão do título).
// Faturado → Recebido → Glosa total (= recuperada + acatada + em disputa) → Saldo pendente,
// um quadro por mês, mais a glosa por lote ("Fora de lote" quando não há) e o caixa do mês.

interface Props {
  mes: string;
}

const TH = 'px-3 py-2 text-right font-normal text-xs text-gray-500 dark:text-gray-400';
const TD = 'px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300';

const FunilGlosaComparativo: React.FC<Props> = ({ mes }) => {
  const { funil, recebidoNoMes, loading, erro, recarregar } = useComparativosFunilGlosa(mes);
  const caixaDe = (m: string) => recebidoNoMes.find((c) => c.mes === m)?.valor;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Funil de glosa por competência</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Competência = mês de emissão do título. Faturado = Recebido + Acatada + Em disputa + Saldo pendente.
          A Recuperada é detalhe do Recebido, não soma de novo.
        </p>
      </div>

      {erro ? (
        <div role="alert" className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start justify-between gap-3">
          <span className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {erro}
          </span>
          <button
            type="button"
            onClick={recarregar}
            className="shrink-0 px-3 py-1 rounded-lg border border-red-300 dark:border-red-800 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
          </button>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : (
        <>
          <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/40">
                <tr>
                  <th className="px-3 py-2 text-left font-normal text-xs text-gray-500 dark:text-gray-400">Etapa</th>
                  {funil.map((f) => <th key={f.mes} className={TH}>{formatCompetencia(f.mes)}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {([
                  ['Faturado', (f) => f.faturado, 'font-medium text-gray-900 dark:text-gray-100'],
                  ['Recebido', (f) => f.recebido, ''],
                  ['   da qual, glosa recuperada', (f) => f.recuperada, 'text-xs italic'],
                  ['Glosa total', (f) => f.glosaTotal, 'font-medium text-gray-900 dark:text-gray-100'],
                  ['   Recuperada', (f) => f.recuperada, 'text-xs'],
                  ['   Acatada', (f) => f.acatada, 'text-xs'],
                  ['   Em disputa', (f) => f.emDisputa, 'text-xs'],
                  ['Saldo pendente', (f) => f.saldo, 'font-medium text-gray-900 dark:text-gray-100'],
                ] as [string, (f: (typeof funil)[number]) => number, string][]).map(([rotulo, valor, classe]) => (
                  <tr key={rotulo} className={classe}>
                    <td className="px-3 py-2 text-left whitespace-pre">{rotulo}</td>
                    {funil.map((f) => <td key={f.mes} className={TD}>{formatCurrency(valor(f))}</td>)}
                  </tr>
                ))}
                <tr className="bg-gray-50/60 dark:bg-gray-700/20">
                  <td className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400">
                    Recebido no mês (caixa, qualquer emissão)
                  </td>
                  {funil.map((f) => (
                    <td key={f.mes} className={TD}>
                      {caixaDe(f.mes) === undefined ? '—' : formatCurrency(caixaDe(f.mes) as number)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Glosa e saldo por lote</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              O saldo do título é dividido igualmente entre os lotes dele; glosa e título sem lote ficam em
              “{FORA_DE_LOTE}”.
            </p>
            {funil.map((f) => (
              <details key={f.mes} className="border border-gray-100 dark:border-gray-700 rounded-xl" open={f.mes === mes}>
                <summary className="px-3 py-2 text-sm cursor-pointer text-gray-900 dark:text-gray-100">
                  {formatCompetencia(f.mes)} · {f.lotes.length} {f.lotes.length === 1 ? 'linha' : 'linhas'}
                </summary>
                {f.lotes.length === 0 ? (
                  <p className="px-3 pb-3 text-xs text-gray-500 dark:text-gray-400">Sem glosa nem saldo no mês.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700/40">
                        <tr>
                          <th className="px-3 py-2 text-left font-normal text-xs text-gray-500 dark:text-gray-400">Lote</th>
                          <th className={TH}>Glosa total</th>
                          <th className={TH}>Recuperada</th>
                          <th className={TH}>Acatada</th>
                          <th className={TH}>Em disputa</th>
                          <th className={TH}>Saldo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {f.lotes.map((l) => (
                          <tr key={l.loteId ?? FORA_DE_LOTE} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{l.codigo}</td>
                            <td className={`${TD} font-medium`}>{formatCurrency(l.glosaTotal)}</td>
                            <td className={TD}>{formatCurrency(l.recuperada)}</td>
                            <td className={TD}>{formatCurrency(l.acatada)}</td>
                            <td className={TD}>{formatCurrency(l.emDisputa)}</td>
                            <td className={TD}>{formatCurrency(l.saldo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </details>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default FunilGlosaComparativo;
