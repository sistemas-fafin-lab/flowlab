import { useCallback, useEffect, useRef, useState } from 'react';
import type { GlosaMensal, GlosaPorMes, SomaGlosa } from '../utils/glosaPorMes';
import { chamarLegadoApi } from './legado/api';

// Glosa por mês de solicitação da aba Comparativos (/api/faturamento/comparativos-glosa-por-mes).
// Sem cache: a glosa é um saldo que muda a cada baixa, e a falha do banco do laboratório
// precisa poder ser repetida com "Tentar novamente" (`recarregar`).

interface RespostaGlosaPorMes extends Partial<GlosaPorMes> {
  success?: boolean;
  error?: string;
}

export interface EstadoGlosaPorMes {
  meses: GlosaMensal[];
  total: SomaGlosa | null;
  loading: boolean;
  /** Mensagem da API (ex.: banco do laboratório indisponível); `null` quando a leitura deu certo. */
  erro: string | null;
  recarregar: () => void;
}

const MENSAGEM_ERRO = 'Não foi possível consultar a glosa por mês.';

export function useComparativosGlosaPorMes(mes: string): EstadoGlosaPorMes {
  const [meses, setMeses] = useState<GlosaMensal[]>([]);
  const [total, setTotal] = useState<SomaGlosa | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // Descarta resposta de um mês já trocado.
  const buscaAtual = useRef(0);

  const carregar = useCallback(async () => {
    const busca = ++buscaAtual.current;
    setLoading(true);
    setErro(null);
    try {
      const body = await chamarLegadoApi<RespostaGlosaPorMes>(
        'comparativos-glosa-por-mes',
        new URLSearchParams({ mes }),
        MENSAGEM_ERRO,
      );
      if (busca !== buscaAtual.current) return;
      setMeses(body.meses ?? []);
      setTotal(body.total ?? null);
    } catch (e) {
      if (busca !== buscaAtual.current) return;
      setErro(e instanceof Error ? e.message : MENSAGEM_ERRO);
    } finally {
      if (busca === buscaAtual.current) setLoading(false);
    }
  }, [mes]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { meses, total, loading, erro, recarregar: carregar };
}
