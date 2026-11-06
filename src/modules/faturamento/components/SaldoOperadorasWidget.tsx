import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, BarChart3, Info, RefreshCw } from 'lucide-react';
import { formatCurrency, formatData } from '../utils/formato';
import type { ComparacaoSaldoOperadora, DashboardReceber } from '../types';

// Conteúdo do widget "Saldo por operadora" do Dashboard de Contas a Receber:
// alternador Carteira total / Só emitidas no período, gráfico do saldo do
// sistema (com a fórmula no tooltip), a data da última baixa importada e a
// conferência com o apLIS (sistema × apLIS e a diferença). Só mostra: não
// corrige o saldo nem dá baixa.

export const FORMULA_SALDO = 'Total − Recebido − Glosa acatada';

type LinhaSaldo = DashboardReceber['porOperadora'][number];

interface EstiloGrafico {
  axisTick: { fontSize: number; fill: string };
  gridColor: string;
  tooltipStyle: React.CSSProperties;
  tooltipItem: React.CSSProperties;
  tooltipLabel: React.CSSProperties;
  corSaldo: string;
  eixoMoeda: (valor: number) => string;
}

interface Props {
  /** As 10 maiores operadoras por saldo (já filtradas pelo pai). */
  linhas: LinhaSaldo[];
  somentePeriodo: boolean;
  onAlterarEscopo: (somentePeriodo: boolean) => void;
  /** YYYY-MM-DD da última baixa importada; null sem baixa. */
  ultimaBaixa: string | null;
  comparacao: {
    operadoras: ComparacaoSaldoOperadora[];
    dadoAte: string | null;
    loading: boolean;
    erro: string | null;
    onTentarNovamente: () => void;
  };
  estilo: EstiloGrafico;
}

const OPCOES = [
  { valor: false, rotulo: 'Carteira total' },
  { valor: true, rotulo: 'Só emitidas no período' },
] as const;

const SaldoOperadorasWidget: React.FC<Props> = ({
  linhas,
  somentePeriodo,
  onAlterarEscopo,
  ultimaBaixa,
  comparacao,
  estilo,
}) => {
  const { axisTick, gridColor, tooltipStyle, tooltipItem, tooltipLabel, corSaldo, eixoMoeda } = estilo;

  // A conferência acompanha as operadoras do gráfico, na mesma ordem.
  const porId = new Map(comparacao.operadoras.map((o) => [o.operadoraId, o]));
  const linhasComparacao = linhas.flatMap((l) => {
    const c = porId.get(l.operadoraId);
    return c ? [c] : [];
  });
  const totalFora = linhasComparacao.reduce((soma, c) => soma + c.titulosForaDaComparacao, 0);

  return (
    <div className="h-full overflow-y-auto -mx-1 px-1 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Escopo do saldo"
          className="inline-flex rounded-xl bg-slate-100/80 dark:bg-slate-800/60 p-0.5 text-xs"
        >
          {OPCOES.map((opcao) => (
            <button
              key={opcao.rotulo}
              type="button"
              aria-pressed={somentePeriodo === opcao.valor}
              onClick={() => onAlterarEscopo(opcao.valor)}
              className={`px-3 py-1 rounded-[10px] font-medium transition-colors ${
                somentePeriodo === opcao.valor
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Última baixa importada:{' '}
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {ultimaBaixa ? formatData(ultimaBaixa) : 'nenhuma'}
          </span>
        </p>
      </div>

      <p className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        <Info className="w-3.5 h-3.5 mt-px flex-shrink-0" aria-hidden />
        <span>
          Saldo = {FORMULA_SALDO}. As baixas do apLIS são importadas à mão, então o saldo do sistema
          pode ficar abaixo do apLIS até a próxima importação.
        </span>
      </p>

      <div className="h-56 flex-shrink-0">
        {linhas.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={linhas} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={eixoMoeda} />
              <YAxis type="category" dataKey="nome" tick={axisTick} axisLine={false} tickLine={false} width={130} />
              <Tooltip
                contentStyle={tooltipStyle}
                itemStyle={tooltipItem}
                labelStyle={tooltipLabel}
                formatter={(valor: number) => [formatCurrency(valor), 'Saldo']}
                labelFormatter={(rotulo: string) => `${rotulo} — ${FORMULA_SALDO}`}
              />
              <Bar dataKey="saldo" fill={corSaldo} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500">
            <BarChart3 className="w-6 h-6 mb-2" />
            <p className="text-sm">Nenhuma operadora com saldo.</p>
          </div>
        )}
      </div>

      <section aria-label="Conferência com o apLIS" className="flex-shrink-0">
        <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
          Sistema × apLIS
          {comparacao.dadoAte && (
            <span className="font-normal text-slate-500 dark:text-slate-400">
              {' '}· apLIS até {formatData(comparacao.dadoAte)}
            </span>
          )}
        </h4>

        {comparacao.erro ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden />
            <span className="flex-1 min-w-[12rem]">
              O apLIS não respondeu — o saldo do sistema acima segue valendo, mas não há comparação agora.
            </span>
            <button
              type="button"
              onClick={comparacao.onTentarNovamente}
              className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
            >
              <RefreshCw className="w-3 h-3" aria-hidden /> Tentar novamente
            </button>
          </div>
        ) : comparacao.loading ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Consultando o apLIS…</p>
        ) : linhasComparacao.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Nenhum título comparável com o apLIS neste recorte.</p>
        ) : (
          <>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-700">
                  <th className="text-left font-medium py-1.5">Operadora</th>
                  <th className="text-right font-medium py-1.5">Sistema</th>
                  <th className="text-right font-medium py-1.5">apLIS</th>
                  <th className="text-right font-medium py-1.5">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {linhasComparacao.map((c) => (
                  <tr key={c.operadoraId} className="border-b border-slate-100/70 dark:border-slate-700/50 last:border-0">
                    <td className="py-1.5 text-slate-800 dark:text-slate-100">{c.nome}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatCurrency(c.saldoSistema)}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {c.saldoAplis === null ? '—' : formatCurrency(c.saldoAplis)}
                    </td>
                    <td className={`py-1.5 text-right tabular-nums font-medium ${classeDiferenca(c.situacao)}`}>
                      {c.diferenca === null ? '—' : `${c.diferenca > 0 ? '+' : ''}${formatCurrency(c.diferenca)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              Diferença negativa: o sistema está abaixo do apLIS (falta importar baixa ou criar título).
              Só informativo — não altera o saldo.
              {totalFora > 0 && ` ${totalFora} título(s) com lote fora do apLIS ficam de fora da conferência.`}
            </p>
          </>
        )}
      </section>
    </div>
  );
};

function classeDiferenca(situacao: ComparacaoSaldoOperadora['situacao']): string {
  if (situacao === 'sistema-menor') return 'text-rose-600 dark:text-rose-400';
  if (situacao === 'sistema-maior') return 'text-amber-600 dark:text-amber-400';
  return 'text-slate-500 dark:text-slate-400';
}

export default SaldoOperadorasWidget;
