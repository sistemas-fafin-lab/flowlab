import React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Layers } from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';
import type { InstanciaRecurso, RecursosPorInstancia } from '../types';
import { formatCompetencia, formatCurrency, plural } from '../utils/formato';
import { rotuloInstancia } from '../utils/recursoGlosaVisual';
import { Kpi } from './KpiVidro';
import { Painel, Vazio } from './PainelGlosa';

// Dashboard de glosa → "Recursos por instância"
// (.scratch/glosas-recursos-calendario-pendencias/issues/09): um card por
// instância (1º, 2º e 3º recurso) com quantidade, valor recorrido e recuperado,
// e o valor recorrido por instância nos 6 meses até o período. Conta as
// requisições com instância vigente (a marcada à mão vence a do apLIS), pelo mês
// do lote de faturamento original. Os números vêm prontos do servidor
// (api/_lib/faturamento/glosaRecuperada.ts → recursosPorInstancia).

/** Uma cor por instância, categórica; o gradiente do ícone segue a mesma família. */
const COR: Record<InstanciaRecurso, { barra: string; gradiente: string }> = {
  1: { barra: '#3b82f6', gradiente: 'from-blue-500 to-blue-600' },
  2: { barra: '#8b5cf6', gradiente: 'from-violet-500 to-violet-600' },
  3: { barra: '#14b8a6', gradiente: 'from-teal-500 to-teal-600' },
};

const CHAVE: Record<InstanciaRecurso, 'primeiro' | 'segundo' | 'terceiro'> = { 1: 'primeiro', 2: 'segundo', 3: 'terceiro' };

// Eixo em milhares, como os outros gráficos do Dashboard de glosa.
const eixoMoeda = (valor: number): string =>
  Math.abs(valor) >= 1000 ? `${Math.round(valor / 1000)}k` : String(valor);

interface Props {
  recursos: RecursosPorInstancia;
}

const RecursosPorInstanciaBloco: React.FC<Props> = ({ recursos }) => {
  const { isDark } = useTheme();
  const axisTick = { fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' };
  const gridColor = isDark ? 'rgba(51,65,85,0.4)' : 'rgba(226,232,240,0.8)';
  const cursorBarra = { fill: isDark ? 'rgba(51,65,85,0.35)' : 'rgba(226,232,240,0.6)' };
  const tooltipStyle: React.CSSProperties = {
    background: isDark ? '#0f172a' : '#ffffff',
    border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
    borderRadius: 12,
    fontSize: 12,
  };
  const tooltipItem: React.CSSProperties = { color: isDark ? '#e2e8f0' : '#334155' };
  const tooltipLabel: React.CSSProperties = { color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 };

  const serie = recursos.evolucao.map((m) => ({ ...m, rotulo: formatCompetencia(m.competencia) }));
  const temEvolucao = recursos.evolucao.some((m) => m.primeiro > 0 || m.segundo > 0 || m.terceiro > 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {recursos.cards.map((c, i) => (
            <Kpi
              key={c.instancia}
              icon={<Layers className="w-4 h-4 sm:w-5 sm:h-5" />}
              label={rotuloInstancia(c.instancia)}
              valor={formatCurrency(c.valorRecorrido)}
              sub={`recorrido · ${plural(c.quantidade, 'requisição', 'requisições')}`}
              extra={
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  <span className="font-medium text-green-700 dark:text-green-300">{formatCurrency(c.valorRecuperado)}</span>{' '}
                  recuperado
                </p>
              }
              dica={
                'Requisições cuja instância vigente é esta (a marcada à mão vence a do apLIS), pelo mês do lote de faturamento original. '
                + 'Recorrido: valor recursado (editado ou do apLIS). Recuperado: a regra de "Glosa recuperada". '
                + 'Todo o recurso da requisição conta na instância vigente: o recorrido no 1º de quem chegou ao 2º não se separa.'
              }
              cor={COR[c.instancia].gradiente}
              atraso={i}
            />
        ))}
      </div>

      <Painel titulo="Recursos por instância" sub="Valor recorrido nos últimos 6 meses de faturamento, pela instância vigente">
        {temEvolucao ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="rotulo" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={eixoMoeda} />
                <Tooltip
                  cursor={cursorBarra}
                  contentStyle={tooltipStyle}
                  itemStyle={tooltipItem}
                  labelStyle={tooltipLabel}
                  formatter={(valor: number) => formatCurrency(valor)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {([1, 2, 3] as const).map((instancia) => (
                  <Bar
                    key={instancia}
                    dataKey={CHAVE[instancia]}
                    name={rotuloInstancia(instancia)}
                    fill={COR[instancia].barra}
                    radius={[6, 6, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Vazio icon={<Layers className="w-6 h-6" />} texto="Nenhum recurso com instância nos últimos 6 meses." />
        )}
      </Painel>
    </div>
  );
};

export default RecursosPorInstanciaBloco;
