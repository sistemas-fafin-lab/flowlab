import { useEffect, useRef, useState } from 'react';

// Respostas que já apareceram nesta aba: fechar e abrir o drawer não refaz a animação.
const reveladas = new Set<string>();

const reduzMovimento = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Duração da fala aparecendo: rápida o bastante para não atrasar a leitura. */
export const duracaoRevelacao = (caracteres: number) => Math.min(1100, Math.max(350, caracteres * 9));

/**
 * D34: a resposta nova aparece aos poucos, como fala. Devolve quantos caracteres mostrar e se já
 * terminou (os blocos entram depois). Sem animação quando a resposta não é nova, quando ela já
 * apareceu antes ou quando o sistema pede menos movimento.
 */
export function useRevelacao(id: string, total: number, animar: boolean, aoAvancar?: () => void): { limite: number; pronto: boolean } {
  const direto = !animar || reveladas.has(id) || reduzMovimento() || total === 0;
  const [limite, setLimite] = useState(direto ? total : 0);
  const aoAvancarRef = useRef(aoAvancar);
  aoAvancarRef.current = aoAvancar;

  useEffect(() => {
    if (direto) { setLimite(total); reveladas.add(id); return; }
    const duracao = duracaoRevelacao(total);
    const inicio = performance.now();
    let quadro = 0;
    const passo = (agora: number) => {
      const fracao = Math.min(1, (agora - inicio) / duracao);
      setLimite(Math.ceil(total * fracao));
      aoAvancarRef.current?.();
      if (fracao < 1) quadro = requestAnimationFrame(passo);
      else reveladas.add(id);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [id, total, direto]);

  return { limite: direto ? total : limite, pronto: direto || limite >= total };
}
