import { useEffect, useState } from 'react';

/** Se a media query vale agora, acompanhando as mudanças (girar o celular, redimensionar). */
export function useCorresponde(consulta: string): boolean {
  const [vale, setVale] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches);
  useEffect(() => {
    const lista = window.matchMedia(consulta);
    const aoMudar = () => setVale(lista.matches);
    aoMudar();
    lista.addEventListener('change', aoMudar);
    return () => lista.removeEventListener('change', aoMudar);
  }, [consulta]);
  return vale;
}
