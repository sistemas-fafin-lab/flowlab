import React, { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { CURVA_SAIDA } from './estilos';

interface NumeroAnimadoProps {
  valor: number;
  formatar: (v: number) => string;
  className?: string;
}

/**
 * Número que conta até o valor: da primeira vez, a partir de zero; depois, a
 * partir do que está na tela (troca de filtro, de visão ou fim da carga), sem
 * recomeçar do zero. Com "reduzir movimento", troca direto. O leitor de tela
 * ouve só o valor final, nunca os intermediários.
 */
const NumeroAnimado: React.FC<NumeroAnimadoProps> = ({ valor, formatar, className = '' }) => {
  const reduzir = useReducedMotion();
  const [exibido, setExibido] = useState(reduzir ? valor : 0);
  const exibidoRef = useRef(reduzir ? valor : 0);
  const primeira = useRef(true);

  useEffect(() => {
    if (reduzir || !Number.isFinite(valor)) {
      exibidoRef.current = valor;
      setExibido(valor);
      return;
    }
    const controles = animate(exibidoRef.current, valor, {
      duration: primeira.current ? 0.9 : 0.55,
      ease: CURVA_SAIDA,
      onUpdate: (v) => {
        exibidoRef.current = v;
        setExibido(v);
      },
    });
    primeira.current = false;
    return () => controles.stop();
  }, [valor, reduzir]);

  return (
    <span className={`tabular-nums ${className}`}>
      <span aria-hidden="true">{formatar(exibido)}</span>
      <span className="sr-only">{formatar(valor)}</span>
    </span>
  );
};

export default NumeroAnimado;
