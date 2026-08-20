import { Table2, TrendingUp } from 'lucide-react';
import { useState } from 'react';

export interface PontoSerieLinha {
  x: string;
  y: number;
}

export interface SerieLinha {
  id: string;
  nome: string;
  cor: { light: string; dark: string };
  pontos: PontoSerieLinha[];
}

interface LineChartMultiSerieProps {
  series: SerieLinha[];
  tema: 'light' | 'dark';
  formatarX?: (x: string) => string;
}

const LARGURA = 640;
const ALTURA = 220;
const MARGEM = { topo: 16, base: 28, esquerda: 8, direita: 96 };

function formatarMesPadrao(x: string): string {
  const [ano, mes] = x.split('-');
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${nomes[Number(mes) - 1]}/${ano?.slice(2)}`;
}

/** Abrevia valores grandes do eixo (12000 → "12k") — só o rótulo do eixo, nunca o valor exato mostrado no tooltip/tabela. */
function formatarEixoY(valor: number): string {
  return valor >= 1000 ? `${(valor / 1000).toFixed(valor % 1000 === 0 ? 0 : 1)}k` : String(valor);
}

/** `s.id` pode conter espaço/acento (ex: "Eduarda Fabri") — id de SVG referenciado via url() não pode ter espaço não escapado. */
function idGradiente(id: string): string {
  return `gradiente-${id.replace(/[^a-zA-Z0-9-]/g, '-')}`;
}

/** Curva suave (Catmull-Rom → Bézier) — mesma leitura de dado, só sem quinas retas entre os pontos. */
function caminhoSuave(pontosXY: { x: number; y: number }[]): string {
  if (pontosXY.length < 2) {
    return pontosXY.length === 1 ? `M ${pontosXY[0]!.x} ${pontosXY[0]!.y}` : '';
  }
  let d = `M ${pontosXY[0]!.x} ${pontosXY[0]!.y}`;
  for (let i = 0; i < pontosXY.length - 1; i++) {
    const p0 = pontosXY[i - 1] ?? pontosXY[i]!;
    const p1 = pontosXY[i]!;
    const p2 = pontosXY[i + 1]!;
    const p3 = pontosXY[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * Linha multi-série com cor fixa por identidade (uma pessoa = uma cor,
 * sempre a mesma, nunca por ranking) — legenda sempre visível (≥2 séries),
 * rótulo direto no fim de cada linha (≤4 séries, cabe rotular todas),
 * crosshair + tooltip ao passar o mouse, e alternância para tabela (leitura
 * sem depender de cor).
 */
export function LineChartMultiSerie({ series, tema, formatarX = formatarMesPadrao }: LineChartMultiSerieProps) {
  const [indiceFoco, setIndiceFoco] = useState<number | null>(null);
  const [verTabela, setVerTabela] = useState(false);

  const categorias = [...new Set(series.flatMap((s) => s.pontos.map((p) => p.x)))].sort();

  if (categorias.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-slate-400">Sem dados no período.</p>;
  }

  const valoresPorSerie = series.map((s) => {
    const mapa = new Map(s.pontos.map((p) => [p.x, p.y]));
    return categorias.map((c) => mapa.get(c) ?? 0);
  });

  const maiorValor = Math.max(1, ...valoresPorSerie.flat());
  const areaLargura = LARGURA - MARGEM.esquerda - MARGEM.direita;
  const areaAltura = ALTURA - MARGEM.topo - MARGEM.base;

  function coordX(indice: number): number {
    return categorias.length === 1
      ? MARGEM.esquerda + areaLargura / 2
      : MARGEM.esquerda + (indice / (categorias.length - 1)) * areaLargura;
  }
  function coordY(valor: number): number {
    return MARGEM.topo + areaAltura - (valor / maiorValor) * areaAltura;
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maiorValor * f));

  // Rótulos diretos no fim de cada linha podem colidir quando duas séries
  // terminam com o mesmo valor (ou muito perto) — empurra os de baixo pra
  // baixo até ter uma folga mínima, na ordem em que aparecem no eixo Y.
  const GAP_MINIMO_ROTULO = 11;
  const rotulosOrdenados = series
    .map((s, indice) => {
      const valores = valoresPorSerie[indice]!;
      return { indice, y: coordY(valores[valores.length - 1] ?? 0) };
    })
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < rotulosOrdenados.length; i++) {
    const anterior = rotulosOrdenados[i - 1]!;
    const atual = rotulosOrdenados[i]!;
    if (atual.y - anterior.y < GAP_MINIMO_ROTULO) {
      atual.y = anterior.y + GAP_MINIMO_ROTULO;
    }
  }
  const yRotuloPorIndiceSerie = new Map(rotulosOrdenados.map((r) => [r.indice, r.y]));

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
                <th className="py-1 pr-3 font-medium">Mês</th>
                {series.map((s) => (
                  <th key={s.id} className="py-1 pr-3 font-medium">
                    {s.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categorias.map((cat, indiceCat) => (
                <tr key={cat} className="border-t border-gray-100 dark:border-white/10">
                  <td className="py-1 pr-3 text-slate-700 dark:text-slate-300">{formatarX(cat)}</td>
                  {valoresPorSerie.map((valores, indiceSerie) => (
                    <td key={series[indiceSerie]!.id} className="py-1 pr-3 text-slate-900 dark:text-white">
                      {valores[indiceCat]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${LARGURA} ${ALTURA}`}
            className="w-full"
            role="img"
            aria-label="Número de cortesias por autorizador ao longo do tempo"
            onMouseLeave={() => setIndiceFoco(null)}
          >
            <defs>
              {series.map((s) => {
                const cor = tema === 'dark' ? s.cor.dark : s.cor.light;
                return (
                  <linearGradient key={s.id} id={idGradiente(s.id)} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={cor} stopOpacity={tema === 'dark' ? 0.35 : 0.28} />
                    <stop offset="100%" stopColor={cor} stopOpacity={0} />
                  </linearGradient>
                );
              })}
            </defs>

            {yTicks.map((tick) => (
              <g key={tick}>
                <line
                  x1={MARGEM.esquerda}
                  x2={LARGURA - MARGEM.direita}
                  y1={coordY(tick)}
                  y2={coordY(tick)}
                  className="stroke-gray-200 dark:stroke-white/10"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
                <text x={MARGEM.esquerda} y={coordY(tick) - 3} className="fill-gray-400 text-[9px] dark:fill-slate-500">
                  {formatarEixoY(tick)}
                </text>
              </g>
            ))}

            {categorias.map((cat, indice) => (
              <text
                key={cat}
                x={coordX(indice)}
                y={ALTURA - 8}
                textAnchor="middle"
                className="fill-gray-400 text-[9px] dark:fill-slate-500"
              >
                {formatarX(cat)}
              </text>
            ))}

            {indiceFoco !== null && (
              <line
                x1={coordX(indiceFoco)}
                x2={coordX(indiceFoco)}
                y1={MARGEM.topo}
                y2={MARGEM.topo + areaAltura}
                className="stroke-gray-300 dark:stroke-white/20"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}

            {series.map((s, indiceSerie) => {
              const cor = tema === 'dark' ? s.cor.dark : s.cor.light;
              const pontos = valoresPorSerie[indiceSerie]!;
              const pontosXY = pontos.map((v, i) => ({ x: coordX(i), y: coordY(v) }));
              const dLinha = caminhoSuave(pontosXY);
              const ultimo = pontos.length - 1;
              const baseY = MARGEM.topo + areaAltura;
              const dArea = pontosXY.length > 1
                ? `${dLinha} L ${pontosXY[ultimo]!.x} ${baseY} L ${pontosXY[0]!.x} ${baseY} Z`
                : '';
              return (
                <g key={s.id}>
                  {dArea && <path d={dArea} fill={`url(#${idGradiente(s.id)})`} stroke="none" />}
                  <path d={dLinha} fill="none" stroke={cor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  {pontos.map((v, i) => (
                    <circle
                      key={i}
                      cx={coordX(i)}
                      cy={coordY(v)}
                      r={indiceFoco === i ? 4.5 : 2.5}
                      fill={cor}
                      className="stroke-white dark:stroke-gray-800"
                      strokeWidth={1.5}
                    />
                  ))}
                  <text x={coordX(ultimo) + 6} y={(yRotuloPorIndiceSerie.get(indiceSerie) ?? coordY(pontos[ultimo]!)) + 3} className="text-[9px] font-medium" fill={cor}>
                    {s.nome.split(' ')[0]}
                  </text>
                </g>
              );
            })}

            {categorias.map((_cat, indice) => (
              <rect
                key={indice}
                x={coordX(indice) - areaLargura / Math.max(1, categorias.length - 1) / 2}
                y={MARGEM.topo}
                width={areaLargura / Math.max(1, categorias.length - 1)}
                height={areaAltura}
                fill="transparent"
                onMouseEnter={() => setIndiceFoco(indice)}
              />
            ))}
          </svg>

          {indiceFoco !== null && (
            <div
              role="tooltip"
              className="glass-surface pointer-events-none absolute top-2 rounded-lg px-3 py-2 text-xs shadow-lg"
              style={{ left: `min(${(coordX(indiceFoco) / LARGURA) * 100}%, 70%)` }}
            >
              <p className="mb-1 font-semibold text-slate-800 dark:text-slate-100">{formatarX(categorias[indiceFoco]!)}</p>
              {series.map((s, indiceSerie) => (
                <p key={s.id} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: tema === 'dark' ? s.cor.dark : s.cor.light }}
                    aria-hidden
                  />
                  {s.nome}: <span className="font-medium text-slate-900 dark:text-white">{valoresPorSerie[indiceSerie]![indiceFoco]}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {!verTabela && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
          {series.map((s) => {
            const cor = tema === 'dark' ? s.cor.dark : s.cor.light;
            return (
              <span key={s.id} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <svg width="20" height="10" viewBox="0 0 20 10" aria-hidden>
                  <line x1="0" y1="5" x2="7" y2="5" stroke={cor} strokeWidth={2} />
                  <circle cx="10" cy="5" r="2.5" fill={cor} />
                  <line x1="13" y1="5" x2="20" y2="5" stroke={cor} strokeWidth={2} />
                </svg>
                {s.nome}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
