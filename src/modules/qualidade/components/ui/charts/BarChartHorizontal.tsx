import { useState } from 'react';

export interface BarraDado {
  rotulo: string;
  valor: number;
}

interface BarChartHorizontalProps {
  dados: BarraDado[];
  /** Uma métrica, uma cor — nunca uma por categoria (identity não é o que este gráfico codifica). */
  cor?: { light: string; dark: string };
  formatarValor?: (valor: number) => string;
  tema: 'light' | 'dark';
}

const CORES_PADRAO = { light: '#2a78d6', dark: '#3987e5' };

/**
 * Barras horizontais, uma cor só (magnitude de UMA métrica por categoria —
 * nunca "uma cor por barra", que codificaria identidade onde não há
 * identidade nenhuma, só rótulo). Rótulo direto em cada barra — sem eixo
 * numérico, sem grade — e tooltip on hover com o valor exato.
 */
export function BarChartHorizontal({ dados, cor = CORES_PADRAO, formatarValor, tema }: BarChartHorizontalProps) {
  const [emFoco, setEmFoco] = useState<number | null>(null);
  const corAtual = tema === 'dark' ? cor.dark : cor.light;
  const maior = Math.max(1, ...dados.map((d) => d.valor));
  const fmt = formatarValor ?? ((v: number) => String(v));

  if (dados.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-slate-400">Sem dados no período.</p>;
  }

  return (
    <div className="space-y-2.5" role="img" aria-label="Gráfico de barras horizontais">
      {dados.map((item, indice) => (
        <div
          key={item.rotulo}
          className="group relative flex items-center gap-3"
          onMouseEnter={() => setEmFoco(indice)}
          onMouseLeave={() => setEmFoco((atual) => (atual === indice ? null : atual))}
        >
          <span className="w-32 shrink-0 truncate text-sm text-slate-700 dark:text-slate-300" title={item.rotulo}>
            {item.rotulo}
          </span>
          <div className="h-2.5 flex-1 rounded-full bg-gray-100 dark:bg-white/5">
            <div
              className="h-2.5 rounded-full transition-[width] duration-300"
              style={{ width: `${(item.valor / maior) * 100}%`, backgroundColor: corAtual }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-sm font-medium text-slate-900 dark:text-white">
            {fmt(item.valor)}
          </span>
          {emFoco === indice && (
            <div
              role="tooltip"
              className="glass-surface pointer-events-none absolute -top-9 left-32 z-10 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-lg dark:text-slate-100"
            >
              {item.rotulo}: {fmt(item.valor)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
