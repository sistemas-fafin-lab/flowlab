import React from 'react';

interface EvaOrbProps {
  /** Diâmetro em px (hero 96, chat 36, inline 22) */
  size?: number;
  /** Multiplicador de velocidade — 2–2.5 enquanto a EVA está "pensando" */
  speed?: number;
  className?: string;
}

/**
 * Orb da EVA no estilo Siri: esfera de vidro com 4 manchas de cor desfocadas
 * girando em sentidos opostos + halo respirando. Só CSS, sem canvas.
 */
export const EvaOrb: React.FC<EvaOrbProps> = ({ size = 22, speed = 1, className }) => {
  const s = size;
  const blur = Math.max(2, s * 0.16);

  const blob = (color: string, left: string, top: string, scale: number, dur: number) => (
    <div
      className="eva-anim absolute rounded-full"
      style={{
        left, top, width: `${scale * 100}%`, height: `${scale * 100}%`,
        background: color, filter: `blur(${blur}px)`, opacity: 0.95,
        animation: `eva-morph ${dur / speed}s ease-in-out infinite`,
      }}
    />
  );

  return (
    <div className={`relative flex-shrink-0 ${className ?? ''}`} style={{ width: s, height: s }} aria-hidden="true">
      <div
        className="eva-anim absolute rounded-full"
        style={{
          inset: -s * 0.28,
          background: 'radial-gradient(circle, rgba(99,102,241,.45), rgba(236,72,153,.18) 45%, rgba(255,255,255,0) 70%)',
          filter: `blur(${s * 0.1}px)`,
          animation: `eva-breathe ${4 / speed}s ease-in-out infinite`,
        }}
      />
      <div
        className="eva-sphere absolute inset-0 rounded-full overflow-hidden"
        style={{
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,.55), 0 ${s * 0.08}px ${s * 0.25}px -${s * 0.06}px rgba(79,70,229,.5)`,
        }}
      >
        <div className="eva-anim absolute inset-0" style={{ animation: `eva-spin ${7 / speed}s linear infinite` }}>
          {blob('#3b82f6', '-18%', '-8%', 0.78, 5)}
          {blob('#ec4899', '42%', '46%', 0.62, 6)}
        </div>
        <div className="eva-anim absolute inset-0" style={{ animation: `eva-spin-rev ${10 / speed}s linear infinite` }}>
          {blob('#8b5cf6', '38%', '-22%', 0.72, 7)}
          {blob('#06b6d4', '-12%', '48%', 0.6, 5.5)}
        </div>
        <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 32% 24%, rgba(255,255,255,.9), rgba(255,255,255,0) 38%)' }} />
        <div className="absolute inset-0 rounded-full" style={{ boxShadow: `inset 0 -${s * 0.06}px ${s * 0.18}px rgba(255,255,255,.45)` }} />
      </div>
    </div>
  );
};

export default EvaOrb;
