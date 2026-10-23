import React, { useEffect, useRef, useState } from 'react';

// Cabeçalho de tabela que gruda logo abaixo das abas ao rolar a página.
//
// É `position: sticky` puro (sem JS no scroll vertical, que tremia um quadro
// atrasado). Sticky prende ao ancestral com scroll mais próximo, então nenhum
// ancestral pode ser `overflow-auto/hidden`:
// - o card em volta usa `overflow-clip` (recorta os cantos sem virar scroll);
// - a CaixaTabela também só recorta. Quando a tabela não cabe na largura, ela
//   ganha uma barra horizontal própria (grudada no rodapé da tela) que desloca
//   a tabela inteira — cabeçalho e linhas juntos.
//
// `--cc-cabecalho` é a altura do cabeçalho fixo da página, medida em
// CostControlDashboard.

export function CaixaTabela({ children }: { children: React.ReactNode }) {
  const caixaRef = useRef<HTMLDivElement>(null);
  const barraRef = useRef<HTMLDivElement>(null);
  const [larguraTabela, setLarguraTabela] = useState(0);
  const [transborda, setTransborda] = useState(false);

  useEffect(() => {
    const caixa = caixaRef.current;
    const tabela = caixa?.querySelector('table');
    if (!caixa || !tabela) return;
    const medir = () => {
      setLarguraTabela(tabela.offsetWidth);
      setTransborda(tabela.offsetWidth > caixa.clientWidth);
    };
    const observer = new ResizeObserver(medir);
    observer.observe(caixa);
    observer.observe(tabela);
    return () => observer.disconnect();
  }, []);

  // Rolagem lateral do touchpad / shift+roda sobre a tabela vai para a barra.
  useEffect(() => {
    const caixa = caixaRef.current;
    const barra = barraRef.current;
    if (!transborda || !caixa || !barra) return;
    const aoRodar = (e: WheelEvent) => {
      const lateral = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const delta = e.shiftKey ? e.deltaY || e.deltaX : e.deltaX;
      if (!lateral || !delta) return;
      e.preventDefault();
      barra.scrollLeft += delta;
    };
    caixa.addEventListener('wheel', aoRodar, { passive: false });
    return () => caixa.removeEventListener('wheel', aoRodar);
  }, [transborda]);

  const deslocar = () => {
    const tabela = caixaRef.current?.querySelector('table');
    if (tabela) tabela.style.transform = `translateX(${-(barraRef.current?.scrollLeft ?? 0)}px)`;
  };

  useEffect(() => {
    if (!transborda) {
      const tabela = caixaRef.current?.querySelector('table');
      if (tabela) tabela.style.transform = '';
    }
  }, [transborda]);

  return (
    <>
      <div ref={caixaRef} className="overflow-x-clip">
        {children}
      </div>
      {transborda && (
        <div
          ref={barraRef}
          onScroll={deslocar}
          className="sticky bottom-0 z-10 overflow-x-auto border-t border-gray-100 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 backdrop-blur"
        >
          <div style={{ width: larguraTabela, height: 1 }} />
        </div>
      )}
    </>
  );
}

// Fundo opaco: o slate-50 / gray-900/40 original deixava as linhas aparecerem por baixo.
export function TheadFixo({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-[var(--cc-cabecalho,0px)] z-10 bg-slate-50 dark:bg-[#19222f] shadow-[0_1px_0_0_rgb(0_0_0/0.06)] dark:shadow-[0_1px_0_0_rgb(255_255_255/0.06)] text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
      {children}
    </thead>
  );
}
