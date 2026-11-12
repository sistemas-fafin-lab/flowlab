import { useCallback, useEffect, useRef, useState } from 'react';
import type { RankingCodigosMes } from '../utils/rankingCodigosGlosa';
import { chamarLegadoApi } from './legado/api';

// Ranking de códigos de glosa da aba Comparativos (/api/faturamento/comparativos-ranking-glosa).
// Sem cache: a falha do apLIS precisa poder ser repetida com "Tentar novamente".

interface RespostaRankingGlosa {
  success?: boolean;
  error?: string;
  meses?: RankingCodigosMes[];
}

export interface EstadoRankingGlosa {
  meses: RankingCodigosMes[];
  loading: boolean;
  /** Mensagem da API (ex.: apLIS indisponível); `null` quando a leitura deu certo. */
  erro: string | null;
  recarregar: () => void;
}

export function useComparativosRankingGlosa(mes: string): EstadoRankingGlosa {
  const [meses, setMeses] = useState<RankingCodigosMes[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // Descarta resposta de um mês já trocado.
  const buscaAtual = useRef(0);

  const carregar = useCallback(async () => {
    const busca = ++buscaAtual.current;
    setLoading(true);
    setErro(null);
    try {
      const body = await chamarLegadoApi<RespostaRankingGlosa>(
        'comparativos-ranking-glosa',
        new URLSearchParams({ mes }),
        'Não foi possível consultar o ranking de códigos de glosa.',
      );
      if (busca !== buscaAtual.current) return;
      setMeses(body.meses ?? []);
    } catch (e) {
      if (busca !== buscaAtual.current) return;
      setErro(e instanceof Error ? e.message : 'Não foi possível consultar o ranking de códigos de glosa.');
    } finally {
      if (busca === buscaAtual.current) setLoading(false);
    }
  }, [mes]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { meses, loading, erro, recarregar: carregar };
}
