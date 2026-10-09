import React from 'react';
import { motion } from 'framer-motion';
import { CURVA_SAIDA } from './estilos';

interface SparklineProps {
  valores: number[];
  /** Cor do ponto final (mês atual); a linha fica no cinza de "de-ênfase". */
  corDestaque: string;
  largura?: number;
  altura?: number;
  rotulo: string;
}

/**
 * Minigráfico de tendência dos KPIs (dataviz: linha 2px no tom de de-ênfase,
 * período atual no acento). O valor e a variação já estão no texto do card;
 * o rótulo acessível descreve a série para leitores de tela.
 */
const Sparkline: React.FC<SparklineProps> = ({ valores, corDestaque, largura = 96, altura = 28, rotulo }) => {
  if (valores.length < 2) return null;
  const max = Math.max(...valores);
  const min = Math.min(...valores);
  const faixa = max - min || 1;
  const margem = 4;
  const x = (i: number) => margem + (i / (valores.length - 1)) * (largura - margem * 2);
  const y = (v: number) => altura - margem - ((v - min) / faixa) * (altura - margem * 2);
  const caminho = valores.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ultimo = valores.length - 1;
  // A linha se desenha da esquerda para a direita e o ponto do mês atual "acende" no fim.
  return (
    <svg width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={rotulo} className="overflow-visible">
      <motion.path
        d={caminho}
        fill="none"
        stroke="#898781"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.6}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: CURVA_SAIDA, delay: 0.2 }}
      />
      <motion.circle
        cx={x(ultimo)}
        cy={y(valores[ultimo])}
        r={4}
        fill={corDestaque}
        stroke="currentColor"
        strokeWidth={2}
        className="text-white dark:text-slate-900"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.95 }}
      />
    </svg>
  );
};

export default Sparkline;
