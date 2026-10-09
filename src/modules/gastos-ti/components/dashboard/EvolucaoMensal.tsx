import React from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import { formatCurrency } from '../../../../utils/paymentUtils';
import { formatarCompetencia } from '../../domain/competencia';
import type { PontoSerie } from '../../domain/finops';
import { SUPERFICIE_FLUTUANTE, TABELA, TABELA_CAIXA, TABELA_TD, TABELA_TH, TABELA_THEAD, TABELA_TR } from '../ui/estilos';

export interface SerieCategoria {
  chave: string;
  nome: string;
  cor: string;
}

interface EvolucaoMensalProps {
  pontos: PontoSerie[];
  /** Na ordem da paleta (a cor segue a categoria) — a primeira fica embaixo da pilha. */
  series: SerieCategoria[];
  /** Orçamento mensal alinhado com `pontos` (issue 14); null = mês sem orçamento. */
  orcamento?: (number | null)[];
  tema: 'light' | 'dark';
}

/** Tinta secundária da paleta (texto/linha de referência), nunca uma cor de série. */
const TINTA_SECUNDARIA = { light: '#52514e', dark: '#c3c2b7' } as const;

/** Eixo em milhares: valores em reais estouram a largura do eixo (mesmo critério do ContasReceberDashboard). */
const eixoMoeda = (valor: number): string =>
  Math.abs(valor) >= 1000 ? `${(valor / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil` : String(valor);

const SUPERFICIE = { light: '#ffffff', dark: '#0f172a' } as const;

interface LinhaGrafico {
  rotulo: string;
  competencia: string;
  projecao: boolean;
  total: number;
  orcamento: number | null;
  /** Série do topo da pilha neste mês: só ela ganha o canto arredondado. */
  topo: string | null;
  [chave: string]: string | number | boolean | null;
}

interface PropsSegmento {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: LinhaGrafico;
}

/**
 * Segmento da pilha (dataviz): canto de 4px só na ponta de cima da pilha,
 * reto na base; 2px de respiro na cor da superfície separando os segmentos;
 * meses de projeção esmaecidos.
 */
const segmento = (chave: string, superficie: string) =>
  function Segmento({ x = 0, y = 0, width = 0, height = 0, fill, payload }: PropsSegmento) {
    if (height <= 0 || width <= 0) return null;
    const r = payload?.topo === chave ? Math.min(4, height, width / 2) : 0;
    const d = `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
    return <path d={d} fill={fill} fillOpacity={payload?.projecao ? 0.4 : 1} stroke={superficie} strokeWidth={2} />;
  };

/** Valor primeiro, nome depois, chave de linha na cor da série (dataviz: interação). */
const Dica = ({ active, payload, series }: TooltipContentProps<number, string> & { series: SerieCategoria[] }) => {
  if (!active || !payload?.length) return null;
  const linha = payload[0].payload as LinhaGrafico;
  const presentes = series.filter((s) => Number(linha[s.chave] ?? 0) > 0).reverse();
  return (
    <div className={`${SUPERFICIE_FLUTUANTE} px-3.5 py-2.5 text-xs min-w-[200px]`}>
      <p className="font-semibold text-slate-700 dark:text-slate-200">
        {formatarCompetencia(linha.competencia)}
        {linha.projecao && <span className="ml-1 font-normal text-slate-400">· previsto</span>}
      </p>
      <ul className="mt-1.5 space-y-1">
        {presentes.map((s) => (
          <li key={s.chave} className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: s.cor }} />
            <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{formatCurrency(Number(linha[s.chave]))}</span>
            <span className="text-slate-500 dark:text-slate-400 truncate">{s.nome}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-3">
        <span className="text-slate-500 dark:text-slate-400">Total</span>
        <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{formatCurrency(linha.total)}</span>
      </p>
      {linha.orcamento !== null && (
        <p className="flex justify-between gap-3">
          <span className="text-slate-500 dark:text-slate-400">Orçamento do mês</span>
          <span className="tabular-nums text-slate-700 dark:text-slate-200">{formatCurrency(linha.orcamento)}</span>
        </p>
      )}
    </div>
  );
};

/** Colunas empilhadas por categoria: realizado até o mês atual, previsto (esmaecido) depois. Um eixo só, em R$. */
const EvolucaoMensal: React.FC<EvolucaoMensalProps> = ({ pontos, series, orcamento, tema }) => {
  const superficie = SUPERFICIE[tema];
  const eixo = { fontSize: 11, fill: tema === 'dark' ? '#94a3b8' : '#64748b' };
  const grade = tema === 'dark' ? 'rgba(51,65,85,0.6)' : 'rgba(203,213,225,0.8)';
  const temOrcamento = Boolean(orcamento?.some((v) => v !== null));
  const dados: LinhaGrafico[] = pontos.map((p, i) => {
    const topo = [...series].reverse().find((s) => (p.valores[s.chave] ?? 0) > 0)?.chave ?? null;
    return {
      rotulo: formatarCompetencia(p.competencia).replace('/20', '/'),
      competencia: p.competencia,
      projecao: p.projecao,
      total: p.total,
      orcamento: orcamento?.[i] ?? null,
      topo,
      ...Object.fromEntries(series.map((s) => [s.chave, p.valores[s.chave] ?? 0])),
    };
  });

  return (
    <div className="h-full flex flex-col">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs text-slate-600 dark:text-slate-300" aria-label="Legenda">
        {series.map((s) => (
          <li key={s.chave} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.cor }} />
            {s.nome}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5 text-slate-400">
          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm bg-slate-400/40" />
          projeção (previsto)
        </li>
        {temOrcamento && (
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="w-4 border-t-2 border-dashed" style={{ borderColor: TINTA_SECUNDARIA[tema] }} />
            orçamento mensal
          </li>
        )}
      </ul>
      {/* Altura explícita: com só min-height, o pai fica com altura "auto" e o ResponsiveContainer mede 0 (o gráfico some). */}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dados} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={grade} strokeWidth={1} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="rotulo" tick={eixo} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={eixo} axisLine={false} tickLine={false} tickFormatter={eixoMoeda} width={56} />
            <Tooltip cursor={{ fill: tema === 'dark' ? 'rgba(148,163,184,0.08)' : 'rgba(100,116,139,0.07)', radius: 8 }} content={(props) => <Dica {...(props as TooltipContentProps<number, string>)} series={series} />} />
            {series.map((s) => (
              <Bar key={s.chave} dataKey={s.chave} name={s.nome} stackId="gasto" fill={s.cor} maxBarSize={24} shape={segmento(s.chave, superficie)} isAnimationActive animationDuration={450} animationEasing="ease-out" />
            ))}
            {/* Mesmo eixo, mesma unidade (R$): nunca um segundo eixo. Tracejada porque é um limite. */}
            {temOrcamento && (
              <Line
                dataKey="orcamento"
                name="Orçamento mensal"
                type="linear"
                stroke={TINTA_SECUNDARIA[tema]}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/** Tabela equivalente: meses × categorias, com total. */
export const TabelaEvolucao: React.FC<{ pontos: PontoSerie[]; series: SerieCategoria[]; orcamento?: (number | null)[] }> = ({ pontos, series, orcamento }) => {
  const temOrcamento = Boolean(orcamento?.some((v) => v !== null));
  return (
    <div className={TABELA_CAIXA}>
      <table className={TABELA}>
        <thead className={TABELA_THEAD}>
          <tr>
            <th scope="col" className={`${TABELA_TH} text-left`}>Mês</th>
            {series.map((s) => (
              <th key={s.chave} scope="col" className={`${TABELA_TH} text-right`}>{s.nome}</th>
            ))}
            <th scope="col" className={`${TABELA_TH} text-right`}>Total</th>
            {temOrcamento && <th scope="col" className={`${TABELA_TH} text-right`}>Orçamento</th>}
          </tr>
        </thead>
        <tbody>
          {pontos.map((p, i) => (
            <tr key={p.competencia} className={TABELA_TR}>
              <td className={`${TABELA_TD} whitespace-nowrap`}>
                {formatarCompetencia(p.competencia)}
                {p.projecao && <span className="text-slate-400"> (previsto)</span>}
              </td>
              {series.map((s) => (
                <td key={s.chave} className={`${TABELA_TD} text-right tabular-nums whitespace-nowrap`}>{p.valores[s.chave] ? formatCurrency(p.valores[s.chave]) : '—'}</td>
              ))}
              <td className={`${TABELA_TD} text-right tabular-nums font-semibold whitespace-nowrap`}>{formatCurrency(p.total)}</td>
              {temOrcamento && (
                <td className={`${TABELA_TD} text-right tabular-nums whitespace-nowrap`}>
                  {orcamento?.[i] !== null && orcamento?.[i] !== undefined ? formatCurrency(orcamento[i] as number) : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default EvolucaoMensal;
