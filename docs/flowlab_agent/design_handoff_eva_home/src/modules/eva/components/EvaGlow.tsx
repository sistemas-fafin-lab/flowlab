import React from 'react';
import { EVA_CONIC } from '../constants';
import { useEvaUI } from './EvaUIContext';

/** Quadrado de 1400px com gradiente cônico girando, recortado pelo pai (overflow-hidden). */
export const GlowLayer: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  const { animatedGlow } = useEvaUI();
  return (
    <div
      className="eva-anim absolute left-1/2 top-1/2 pointer-events-none"
      style={{
        width: 1400, height: 1400, marginLeft: -700, marginTop: -700,
        background: EVA_CONIC, opacity,
        animation: animatedGlow ? 'eva-spin 6s linear infinite' : 'none',
      }}
    />
  );
};

interface GlowFrameProps {
  /** Raio externo em px */
  radius?: number;
  /** Espessura da borda em px */
  thickness?: number;
  opacity?: number;
  /** Halo desfocado atrás da borda (usado no campo do hero) */
  halo?: boolean;
  className?: string;
  innerClassName?: string;
}

/** Borda gradiente animada "Siri". O conteúdo fica numa superfície branca interna. */
export const GlowFrame: React.FC<React.PropsWithChildren<GlowFrameProps>> = ({
  radius = 16, thickness = 1.5, opacity = 0.55, halo = false, className = '', innerClassName = '', children,
}) => (
  <div className={`relative ${className}`}>
    {halo && (
      <div className="absolute -inset-1 overflow-hidden pointer-events-none" style={{ borderRadius: radius + 4, filter: 'blur(14px)', opacity: 0.45 }}>
        <GlowLayer />
      </div>
    )}
    <div className="relative overflow-hidden" style={{ borderRadius: radius, padding: thickness }}>
      <GlowLayer opacity={opacity} />
      <div className={`relative ${innerClassName}`} style={{ borderRadius: radius - thickness }}>
        {children}
      </div>
    </div>
  </div>
);
