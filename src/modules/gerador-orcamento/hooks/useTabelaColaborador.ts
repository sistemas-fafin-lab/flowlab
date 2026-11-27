import { useCallback, useEffect, useState } from 'react';
import { buscarTabelaColaborador } from '../api';
import type { ItemTabelaColaborador } from '../types';

interface UseTabelaColaboradorResult {
  exames: ItemTabelaColaborador[];
  loading: boolean;
  error: string | null;
  recarregar: () => void;
}

/**
 * Lista do modo Tabela Colaborador, carregada ao abrir o modo. O servidor lê os
 * parâmetros da regra a cada consulta: recarregar já traz uma mudança feita no
 * Controle de Custos.
 */
export function useTabelaColaborador(): UseTabelaColaboradorResult {
  const [exames, setExames] = useState<ItemTabelaColaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setExames(await buscarTabelaColaborador());
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Não foi possível carregar a lista de exames.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { exames, loading, error, recarregar };
}
