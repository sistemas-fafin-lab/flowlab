import { useCallback, useEffect, useRef, useState } from 'react';
import type { IndicadoresFaturamento, IndicadoresFaturamentoMeta, PeriodoIndicadoresFaturamento } from '../types';
import { chamarLegadoApi } from './legado/api';

// Página Faturamento → Indicadores: lê o resumo pronto de
// /api/faturamento/indicadores (MySQL de backup do laboratório) e busca de novo
// quando o período (Mês ou Período) muda.

interface RespostaIndicadores {
  success?: boolean;
  error?: string;
  meta?: IndicadoresFaturamentoMeta;
  indicadores?: IndicadoresFaturamento;
}

const MENSAGEM_ERRO = 'Não foi possível consultar o banco do laboratório.';

export function useIndicadoresFaturamento(periodo: PeriodoIndicadoresFaturamento) {
  // Chave de texto: o objeto do período é recriado a cada render da página.
  const chave = new URLSearchParams(periodo).toString();

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
      const params = new URLSearchParams(chave);
      if (force) params.set('semCache', '1');
      const body = await chamarLegadoApi<RespostaIndicadores>('indicadores', params, MENSAGEM_ERRO);
      if (reqId !== buscaAtual.current) return;
      setIndicadores(body.indicadores ?? null);
      setMeta(body.meta ?? null);
    } catch (err) {
      if (reqId !== buscaAtual.current) return;
      setError(err instanceof Error ? err.message : MENSAGEM_ERRO);
      setIndicadores(null);
      setMeta(null);
    } finally {
      if (reqId === buscaAtual.current) setLoading(false);
    }
  }, [chave]);

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [refetch]);

  return { indicadores, meta, loading, error, refetch };
}
