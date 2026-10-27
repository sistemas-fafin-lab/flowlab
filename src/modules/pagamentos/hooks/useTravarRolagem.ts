import { useEffect } from 'react';

/**
 * Trava a rolagem da página enquanto um modal está aberto: no celular, arrastar o dedo
 * no fundo escurecido rolava a lista por trás. Devolve o valor anterior ao fechar, para
 * não destravar a página se outro modal ainda estiver aberto.
 */
export function useTravarRolagem(ativo = true) {
  useEffect(() => {
    if (!ativo) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [ativo]);
}
