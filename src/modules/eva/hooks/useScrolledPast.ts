import { useEffect, useState, type RefObject } from 'react';

/**
 * true quando o elemento já saiu da tela por cima (o usuário rolou além dele).
 * Usado para mostrar a barra flutuante da EVA depois que o campo do hero some.
 */
export function useScrolledPast(ref: RefObject<Element>) {
  const [past, setPast] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  return past;
}
