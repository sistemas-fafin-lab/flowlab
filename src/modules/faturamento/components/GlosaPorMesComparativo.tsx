import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import { useComparativosGlosaPorMes } from '../hooks/useComparativosGlosaPorMes';
import { formatCompetencia, formatCurrency } from '../utils/formato';

// Aba Comparativos → Glosa por mês de solicitação, de janeiro até o mês de referência.
// Mesma regra da DRE do financeiro (Análise de Faturamento do apLIS, coluna Glosa), para
// os dois números baterem. É outra visão do funil acima: lá a competência é a emissão do título.

interface Props {
  mes: string;
}

const TH = 'px-3 py-2 text-right font-normal text-xs text-gray-500 dark:text-gray-400';
const TD = 'px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300';

const GlosaPorMesComparativo: React.FC<Props> = ({ mes }) => {
  const { meses, total, loading, erro, recarregar } = useComparativosGlosaPorMes(mes);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Glosa por mês de solicitação</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Mesma conta da DRE (Análise de Faturamento do apLIS): líquido − recebido das cobranças com motivo de
          glosa e saldo em aberto, de requisições cobráveis, pelo mês de solicitação. É o que ainda falta
          receber hoje: o valor de um mês cai conforme os recursos são pagos.
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
        <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/40">
              <tr>
                <th className="px-3 py-2 text-left font-normal text-xs text-gray-500 dark:text-gray-400">Mês</th>
                <th className={TH}>Cobranças glosadas</th>
                <th className={TH}>Glosa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {meses.map((m) => (
                <tr key={m.mes} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-3 py-2 text-left text-gray-900 dark:text-gray-100">{formatCompetencia(m.mes)}</td>
                  <td className={TD}>{m.qtdCobrancas}</td>
                  <td className={`${TD} font-medium text-gray-900 dark:text-gray-100`}>{formatCurrency(m.valor)}</td>
                </tr>
              ))}
            </tbody>
            {total && (
              <tfoot className="bg-gray-50 dark:bg-gray-700/40 font-semibold">
                <tr>
                  <td className="px-3 py-2 text-left text-gray-900 dark:text-gray-100">Total</td>
                  <td className={TD}>{total.qtdCobrancas}</td>
                  <td className={`${TD} text-gray-900 dark:text-gray-100`}>{formatCurrency(total.valor)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  );
};

export default GlosaPorMesComparativo;
