import { useCallback, useEffect, useRef, useState } from 'react';
import type { PeriodoComparativo } from '../utils/comparativos';
import type { FunilGlosaMes } from '../utils/funilGlosa';
import { chamarLegadoApi } from './legado/api';

// Funil de glosa da aba Comparativos (/api/faturamento/comparativos-funil-glosa).
// Sem cache: a falha do apLIS precisa poder ser repetida com "Tentar novamente".

interface RespostaFunilGlosa {
  success?: boolean;
  error?: string;
  periodos?: PeriodoComparativo[];
  funil?: FunilGlosaMes[];
  recebidoNoMes?: { mes: string; valor: number }[];
}

export interface EstadoFunilGlosa {
  funil: FunilGlosaMes[];
  /** Caixa: o que entrou no mês, de qualquer emissão. */
  recebidoNoMes: { mes: string; valor: number }[];
  loading: boolean;
  /** Mensagem da API (ex.: apLIS indisponível); `null` quando a leitura deu certo. */
  erro: string | null;
  recarregar: () => void;
}

export function useComparativosFunilGlosa(mes: string): EstadoFunilGlosa {
  const [funil, setFunil] = useState<FunilGlosaMes[]>([]);
  const [recebidoNoMes, setRecebidoNoMes] = useState<{ mes: string; valor: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // Descarta resposta de um mês já trocado.
  const buscaAtual = useRef(0);

  const carregar = useCallback(async () => {
    const busca = ++buscaAtual.current;
    setLoading(true);
    setErro(null);
    try {
      const body = await chamarLegadoApi<RespostaFunilGlosa>(
        'comparativos-funil-glosa',
        new URLSearchParams({ mes }),
        'Não foi possível consultar o funil de glosa.',
      );
      if (busca !== buscaAtual.current) return;
      setFunil(body.funil ?? []);
      setRecebidoNoMes(body.recebidoNoMes ?? []);
    } catch (e) {
      if (busca !== buscaAtual.current) return;
      setErro(e instanceof Error ? e.message : 'Não foi possível consultar o funil de glosa.');
    } finally {
      if (busca === buscaAtual.current) setLoading(false);
    }
  }, [mes]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { funil, recebidoNoMes, loading, erro, recarregar: carregar };
}
