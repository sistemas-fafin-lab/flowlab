import React, { useMemo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import { useComparativosConversao } from '../hooks/useComparativosConversao';
import { formatCompetencia, formatPercentual } from '../utils/formato';
import type { ConversaoMes } from '../utils/conversaoRequisicoes';
import BarrasHorizontaisPorConvenio from './BarrasHorizontaisPorConvenio';

// Aba Comparativos → Conversão de requisições (issue 07). Aptas × faturadas por mês da data
// de solicitação: totais dos 3 meses, o % de conversão dos convênios com mais aptas no mês
// de referência em barras horizontais e a tabela com todos. Sem aptas no mês, o % é "—".

interface Props {
  mes: string;
}

const MAX_CONVENIOS_NO_GRAFICO = 15;

const TH = 'px-3 py-2 font-normal text-xs text-gray-500 dark:text-gray-400';
const TD = 'px-3 py-2 tabular-nums text-right text-gray-700 dark:text-gray-300';

const inteiro = (n: number) => n.toLocaleString('pt-BR');
const percentual = (p: number | null) => (p === null ? '—' : formatPercentual(p));
const eixoPercentual = (p: number) => `${p}%`;

// Cada medida com o rótulo curto (cabeçalho por mês da tabela) e o longo (linha de totais).
const COLUNAS: { rotulo: string; rotuloTotal: string; valor: (m: ConversaoMes) => string; destaque?: boolean }[] = [
  { rotulo: 'Aptas', rotuloTotal: 'Requisições aptas', valor: (m) => inteiro(m.aptas) },
  { rotulo: 'Faturadas', rotuloTotal: 'Faturadas', valor: (m) => inteiro(m.faturadas) },
  { rotulo: '%', rotuloTotal: '% de conversão', valor: (m) => percentual(m.percentual), destaque: true },
  { rotulo: 'Sem lote', rotuloTotal: 'Aptas sem lote', valor: (m) => inteiro(m.semLote) },
];

const TotaisDosMeses: React.FC<{ totais: ConversaoMes[] }> = ({ totais }) => (
  <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="bg-gray-50 dark:bg-gray-700/40">
        <tr>
          <th className={`${TH} text-left`}>Total (todos os convênios)</th>
          {totais.map((m) => <th key={m.mes} className={`${TH} text-right`}>{formatCompetencia(m.mes)}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
        {COLUNAS.map((linha) => (
          <tr key={linha.rotulo}>
            <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{linha.rotuloTotal}</td>
            {totais.map((m) => (
              <td key={m.mes} className={`${TD} ${linha.destaque ? 'font-medium text-gray-900 dark:text-gray-100' : ''}`}>
                {linha.valor(m)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ConversaoRequisicoesComparativo: React.FC<Props> = ({ mes }) => {
  const { totais, convenios, loading, erro, recarregar } = useComparativosConversao(mes);
  const meses = totais.map((t) => t.mes);

  // Os convênios já vêm ordenados pelas aptas do mês de referência.
  const linhasGrafico = useMemo(
    () =>
      convenios
        .filter((c) => (c.meses[0]?.aptas ?? 0) > 0)
        .slice(0, MAX_CONVENIOS_NO_GRAFICO)
        .map((c) => ({
          convenio: c.nome ?? 'Não identificado',
          valores: Object.fromEntries(c.meses.map((m) => [m.mes, m.percentual])),
        })),
    [convenios],
  );

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Conversão de requisições</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Aptas = requisições de convênio (fora Particular e Cortesia), com evento cobrável e procedimento, pelo mês da data de solicitação,
          nas fontes consideradas da sub-aba "Sem lote". Faturada = está hoje em lote que não é cancelado nem prejuízo, mesmo de um mês
          posterior, ou já foi cobrada por RPS avulso. Aptas sem lote = aptas − faturadas.
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
      ) : convenios.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
          Nenhuma requisição apta nos 3 meses comparados.
        </div>
      ) : (
        <>
          <TotaisDosMeses totais={totais} />

          {linhasGrafico.length > 0 && (
            <>
              <BarrasHorizontaisPorConvenio linhas={linhasGrafico} meses={meses} formatarEixo={eixoPercentual} dominio={[0, 100]} />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                % de conversão dos {Math.min(linhasGrafico.length, MAX_CONVENIOS_NO_GRAFICO)} convênios com mais aptas em {formatCompetencia(mes)}; a tabela lista todos.
              </p>
            </>
          )}

          <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/40">
                <tr>
                  <th rowSpan={2} className={`${TH} text-left align-bottom`}>Convênio</th>
                  {meses.map((m) => (
                    <th key={m} colSpan={COLUNAS.length} className={`${TH} text-center font-medium`}>{formatCompetencia(m)}</th>
                  ))}
                </tr>
                <tr>
                  {meses.flatMap((m) => COLUNAS.map((c) => <th key={`${m}-${c.rotulo}`} className={`${TH} text-right`}>{c.rotulo}</th>))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {convenios.map((c) => (
                  <tr key={c.fontePagadoraId ?? `sem-id-${c.nome}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100 truncate max-w-[280px]">{c.nome ?? 'Não identificado'}</td>
                    {c.meses.flatMap((m) =>
                      COLUNAS.map((col) => (
                        <td key={`${m.mes}-${col.rotulo}`} className={`${TD} ${col.destaque ? 'font-medium text-gray-900 dark:text-gray-100' : ''}`}>
                          {col.valor(m)}
                        </td>
                      )),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};

export default ConversaoRequisicoesComparativo;
