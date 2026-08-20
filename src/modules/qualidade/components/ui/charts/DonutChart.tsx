import { Table2, TrendingUp } from 'lucide-react';
import { useState } from 'react';

export interface FatiaDonut {
  rotulo: string;
  valor: number;
}

interface DonutChartProps {
  dados: FatiaDonut[];
  tema: 'light' | 'dark';
  formatarValor?: (valor: number) => string;
  /** Nome do rótulo agregado — nunca conta como um dos "top N" coloridos. */
  rotuloOutros?: string;
}

/**
 * Só as 3 primeiras cores categóricas do tema validam CVD-safety em pares
 * quaisquer (não só adjacentes) — pizza/donut compara qualquer fatia com
 * qualquer outra, então é um contexto "all-pairs" (skill dataviz,
 * `palette.md` § Categorical). Por isso o corte é sempre top 3 + "Outros"
 * em cinza neutro, nunca mais fatias coloridas do que isso.
 */
const CORES_TOP3: { light: string; dark: string }[] = [
  { light: '#2a78d6', dark: '#3987e5' }, // slot 1 — azul
  { light: '#eb6834', dark: '#d95926' }, // slot 2 — laranja
  { light: '#1baf7a', dark: '#199e70' }, // slot 3 — aqua
];
const COR_OUTROS = { light: '#9ca3af', dark: '#64748b' };
const MAX_FATIAS_COLORIDAS = 3;

const TAMANHO = 200;
const RAIO = 80;
const ESPESSURA = 28;
const CENTRO = TAMANHO / 2;

function paraCoordenadasArco(anguloGraus: number): { x: number; y: number } {
  const anguloRad = ((anguloGraus - 90) * Math.PI) / 180;
  return { x: CENTRO + RAIO * Math.cos(anguloRad), y: CENTRO + RAIO * Math.sin(anguloRad) };
}

function caminhoDoArco(anguloInicio: number, anguloFim: number): string {
  const inicio = paraCoordenadasArco(anguloFim);
  const fim = paraCoordenadasArco(anguloInicio);
  const arcoGrande = anguloFim - anguloInicio > 180 ? 1 : 0;
  return `M ${inicio.x} ${inicio.y} A ${RAIO} ${RAIO} 0 ${arcoGrande} 0 ${fim.x} ${fim.y}`;
}

/**
 * Donut de participação (top 3 + "Outros") — nunca mais que isso, mesmo
 * espírito de `references/anti-patterns.md`: "parte-todo só de relance, ≤ 6
 * segmentos", combinado ao teto de 3 cores all-pairs-seguras. Legenda +
 * tabela sempre disponíveis (nenhuma fatia depende só da cor para ser lida).
 */
export function DonutChart({ dados, tema, formatarValor, rotuloOutros = 'Outros' }: DonutChartProps) {
  const [fatiaEmFoco, setFatiaEmFoco] = useState<number | null>(null);
  const [verTabela, setVerTabela] = useState(false);
  const fmt = formatarValor ?? ((v: number) => String(v));

  if (dados.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-slate-400">Sem dados no período.</p>;
  }

  const ordenados = [...dados].sort((a, b) => b.valor - a.valor);
  const principais = ordenados.slice(0, MAX_FATIAS_COLORIDAS);
  const restante = ordenados.slice(MAX_FATIAS_COLORIDAS);
  const totalOutros = restante.reduce((soma, item) => soma + item.valor, 0);

  const fatias = [
    ...principais.map((item, indice) => ({
      rotulo: item.rotulo,
      valor: item.valor,
      cor: tema === 'dark' ? CORES_TOP3[indice]!.dark : CORES_TOP3[indice]!.light,
      detalhe: null as FatiaDonut[] | null,
    })),
    ...(totalOutros > 0
      ? [{ rotulo: rotuloOutros, valor: totalOutros, cor: tema === 'dark' ? COR_OUTROS.dark : COR_OUTROS.light, detalhe: restante }]
      : []),
  ];

  const total = fatias.reduce((soma, f) => soma + f.valor, 0);
  let anguloAcumulado = 0;
  const arcos = fatias.map((fatia) => {
    const anguloInicio = anguloAcumulado;
    const anguloFatia = (fatia.valor / total) * 360;
    anguloAcumulado += anguloFatia;
    return { ...fatia, anguloInicio, anguloFim: anguloAcumulado };
  });

  return (
    <div>
      <div className="mb-2 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setVerTabela((v) => !v)}
          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-white/5"
        >
          {verTabela ? <TrendingUp className="h-3.5 w-3.5" aria-hidden /> : <Table2 className="h-3.5 w-3.5" aria-hidden />}
          {verTabela ? 'Ver gráfico' : 'Ver tabela'}
        </button>
      </div>

      {verTabela ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-gray-500 dark:text-slate-400">
                <th className="py-1 pr-3 font-medium">Motivo</th>
                <th className="py-1 pr-3 font-medium">Quantidade</th>
                <th className="py-1 pr-3 font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((item) => (
                <tr key={item.rotulo} className="border-t border-gray-100 dark:border-white/10">
                  <td className="py-1 pr-3 text-slate-700 dark:text-slate-300">{item.rotulo}</td>
                  <td className="py-1 pr-3 text-slate-900 dark:text-white">{fmt(item.valor)}</td>
                  <td className="py-1 pr-3 text-slate-900 dark:text-white">{((item.valor / total) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center">
          <div className="relative shrink-0" onMouseLeave={() => setFatiaEmFoco(null)}>
            <svg viewBox={`0 0 ${TAMANHO} ${TAMANHO}`} className="w-44" role="img" aria-label="Ocorrências por motivo — participação">
              {arcos.map((arco, indice) => (
                <path
                  key={arco.rotulo}
                  d={caminhoDoArco(arco.anguloInicio, arco.anguloFim)}
                  fill="none"
                  stroke={arco.cor}
                  strokeWidth={fatiaEmFoco === indice ? ESPESSURA + 6 : ESPESSURA}
                  className="transition-[stroke-width] duration-150"
                  onMouseEnter={() => setFatiaEmFoco(indice)}
                />
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-slate-900 dark:text-white">{fmt(total)}</span>
              <span className="text-[10px] text-gray-500 dark:text-slate-400">total</span>
            </div>
            {fatiaEmFoco !== null && (
              <div
                role="tooltip"
                className="glass-surface pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-lg dark:text-slate-100"
              >
                {arcos[fatiaEmFoco]!.rotulo}: {fmt(arcos[fatiaEmFoco]!.valor)} ({((arcos[fatiaEmFoco]!.valor / total) * 100).toFixed(1)}%)
                {arcos[fatiaEmFoco]!.detalhe && (
                  <p className="mt-1 max-w-[14rem] whitespace-normal text-[11px] font-normal text-slate-500 dark:text-slate-400">
                    {arcos[fatiaEmFoco]!.detalhe!.map((d) => d.rotulo).join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>

          <ul className="space-y-1.5">
            {arcos.map((arco, indice) => (
              <li
                key={arco.rotulo}
                className="flex items-center gap-2 text-sm"
                onMouseEnter={() => setFatiaEmFoco(indice)}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: arco.cor }} aria-hidden />
                <span className="text-slate-700 dark:text-slate-300">{arco.rotulo}</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {fmt(arco.valor)} ({((arco.valor / total) * 100).toFixed(1)}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
