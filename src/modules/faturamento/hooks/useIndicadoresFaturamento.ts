import { useCallback, useEffect, useRef, useState } from 'react';
import type { IndicadoresFaturamento, IndicadoresFaturamentoMeta } from '../types';
import { chamarLegadoApi } from './legado/api';

// Página Faturamento → Indicadores: lê o resumo pronto de
// /api/faturamento/indicadores (MySQL de backup do laboratório) e busca de novo
// quando o mês muda.

interface RespostaIndicadores {
  success?: boolean;
  error?: string;
  meta?: IndicadoresFaturamentoMeta;
  indicadores?: IndicadoresFaturamento;
}

const MENSAGEM_ERRO = 'Não foi possível consultar o banco do laboratório.';

export function useIndicadoresFaturamento(mes: string) {
  const [indicadores, setIndicadores] = useState<IndicadoresFaturamento | null>(null);
  const [meta, setMeta] = useState<IndicadoresFaturamentoMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const buscaAtual = useRef(0);

  const refetch = useCallback(async (force = false) => {
    const reqId = ++buscaAtual.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ mes });
      if (force) params.set('semCache', '1');
      const body = await chamarLegadoApi<RespostaIndicadores>('indicadores', params, MENSAGEM_ERRO);
      if (reqId !== buscaAtual.current) return;
      setIndicadores(body.indicadores ?? null);
      setMeta(body.meta ?? null);
    } catch (err) {
      if (reqId !== buscaAtual.current) return;
      setError(err instanceof Error ? err.message : MENSAGEM_ERRO);
      setIndicadores(null);
    } finally {
      if (reqId === buscaAtual.current) setLoading(false);
    }
  }, [mes]);

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [refetch]);

  return { indicadores, meta, loading, error, refetch };
}
