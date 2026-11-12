import React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '../../../hooks/useTheme';
import { CORES_MESES } from '../utils/comparativos';
import { formatCompetencia } from '../utils/formato';

// Barras horizontais agrupadas da aba Comparativos: convênio no eixo vertical e uma barra por
// mês (referência, M-1, M-2), no estilo do ranking dos Indicadores. O spec pede o mesmo
// componente para a conversão (issue 07) e o volume de envio (issue 09).

const MAX_ROTULO = 28;
const encurtar = (nome: string) => (nome.length > MAX_ROTULO ? `${nome.slice(0, MAX_ROTULO - 1)}…` : nome);

/** Altura que cresce com o número de convênios, para os nomes não se sobreporem. */
const altura = (qtdConvenios: number, qtdMeses: number) => Math.max(qtdConvenios * (qtdMeses * 9 + 14) + 48, 192);

export interface LinhaBarrasPorConvenio {
  convenio: string;
  /** Valor por 'YYYY-MM'; `null` = sem dado no mês (sem barra). */
  valores: Record<string, number | null>;
}

interface Props {
  linhas: LinhaBarrasPorConvenio[];
  /** 'YYYY-MM', na ordem referência, M-1, M-2. */
  meses: string[];
  formatarValor: (valor: number) => string;
  /** Domínio do eixo de valores; padrão: de 0 ao maior valor. */
  dominio?: [number, number];
}

const BarrasHorizontaisPorConvenio: React.FC<Props> = ({ linhas, meses, formatarValor, dominio }) => {
  const { isDark } = useTheme();
  const axisTick = { fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' };
  const tooltipStyle: React.CSSProperties = {
    background: isDark ? '#0f172a' : '#ffffff',
    border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
    borderRadius: 8,
    fontSize: 12,
  };
  const dados = linhas.map((l) => ({ convenio: l.convenio, ...l.valores }));

  return (
    <div className="border border-gray-100 dark:border-gray-700 rounded-2xl p-3" style={{ height: altura(linhas.length, meses.length) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barGap={1}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(51,65,85,0.4)' : 'rgba(226,232,240,0.8)'} horizontal={false} />
          <XAxis type="number" domain={dominio ?? [0, 'auto']} tick={axisTick} axisLine={false} tickLine={false} tickFormatter={formatarValor} />
          <YAxis type="category" dataKey="convenio" tick={axisTick} axisLine={false} tickLine={false} width={190} interval={0} tickFormatter={encurtar} />
          <Tooltip
            contentStyle={tooltipStyle}
            itemStyle={{ color: isDark ? '#e2e8f0' : '#334155' }}
            labelStyle={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}
            formatter={(valor: number | null) => (valor === null || valor === undefined ? '—' : formatarValor(valor))}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {meses.map((m, i) => (
            <Bar key={m} dataKey={m} name={formatCompetencia(m)} fill={CORES_MESES[i]} radius={[0, 4, 4, 0]} maxBarSize={10} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BarrasHorizontaisPorConvenio;
