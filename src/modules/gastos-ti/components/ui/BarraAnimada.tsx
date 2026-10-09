import React from 'react';
import { motion } from 'framer-motion';
import { CURVA_SAIDA } from './estilos';

interface BarraAnimadaProps {
  /** Comprimento em % do trilho. */
  largura: number;
  cor: string;
  /** De onde a barra cresce (divergente negativa cresce da direita). */
  origem?: 'esquerda' | 'direita';
  /** Posição na lista: escalona a entrada (35 ms por item, no máximo ~0,4 s). */
  indice?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Preenchimento de barra que cresce a partir da base ao aparecer (scaleX, só
 * transform) e desliza para o novo comprimento quando o dado muda (width em
 * 300 ms) — trocar filtro ou visão nunca faz a barra "piscar".
 */
const BarraAnimada: React.FC<BarraAnimadaProps> = ({ largura, cor, origem = 'esquerda', indice = 0, className = '', style }) => (
  <motion.div
    aria-hidden="true"
    initial={{ scaleX: 0 }}
    animate={{ scaleX: 1 }}
    transition={{ duration: 0.7, ease: CURVA_SAIDA, delay: Math.min(indice, 12) * 0.035 }}
    className={`h-full transition-[width] duration-300 ease-out ${className}`}
    style={{ ...style, width: `${largura}%`, backgroundColor: cor, originX: origem === 'esquerda' ? 0 : 1 }}
  />
);

export default BarraAnimada;
