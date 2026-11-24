import React, { useEffect, useRef, useState } from 'react';

/**
 * Caixa com rolagem horizontal e uma segunda barra em cima, sincronizada com a
 * de baixo: numa tabela longa, a barra nativa só aparece no fim da página.
 * A barra de cima só aparece quando o conteúdo transborda.
 */
const RolagemHorizontalDupla: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const barraRef = useRef<HTMLDivElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const [larguraConteudo, setLarguraConteudo] = useState(0);
  const [transborda, setTransborda] = useState(false);

  useEffect(() => {
    const caixa = caixaRef.current;
    if (!caixa) return;
    const medir = () => {
      setLarguraConteudo(caixa.scrollWidth);
      setTransborda(caixa.scrollWidth > caixa.clientWidth + 1);
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(caixa);
    if (caixa.firstElementChild) observador.observe(caixa.firstElementChild);
    return () => observador.disconnect();
  }, []);

  // Cada barra copia a posição da outra; a guarda evita o eco entre os dois eventos.
  const sincronizando = useRef(false);
  const espelhar = (origem: HTMLDivElement | null, destino: HTMLDivElement | null) => {
    if (!origem || !destino) return;
    if (sincronizando.current) {
      sincronizando.current = false;
      return;
    }
    if (destino.scrollLeft !== origem.scrollLeft) {
      sincronizando.current = true;
      destino.scrollLeft = origem.scrollLeft;
    }
  };

  return (
    <>
      <div
        ref={barraRef}
        className={`overflow-x-auto overflow-y-hidden ${transborda ? '' : 'hidden'}`}
        onScroll={() => espelhar(barraRef.current, caixaRef.current)}
        aria-hidden
      >
        <div style={{ width: larguraConteudo, height: 1 }} />
      </div>
      <div ref={caixaRef} className="overflow-x-auto" onScroll={() => espelhar(caixaRef.current, barraRef.current)}>
        {children}
      </div>
    </>
  );
};

export default RolagemHorizontalDupla;
