import { useCallback, useEffect, useState } from 'react';
import { buscarListaPrecos } from '../api';
import type { ItemGeradorOrcamento } from '../types';

interface UseListaPrecosResult {
  exames: ItemGeradorOrcamento[];
  /** Vem da mesma resposta da lista: decide o botão do PDF interno sem consulta à parte. */
  podeVerCustos: boolean;
  loading: boolean;
  error: string | null;
  recarregar: () => void;
}

/** Lista de preços do Gerador de Orçamento, carregada uma vez ao abrir a tela. */
export function useListaPrecos(): UseListaPrecosResult {
  const [exames, setExames] = useState<ItemGeradorOrcamento[]>([]);
  const [podeVerCustos, setPodeVerCustos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const lista = await buscarListaPrecos();
      setExames(lista.exames);
      setPodeVerCustos(lista.podeVerCustos);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Não foi possível carregar a lista de exames.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { exames, podeVerCustos, loading, error, recarregar };
}
