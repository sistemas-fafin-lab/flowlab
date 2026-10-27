import { useCallback, useEffect, useRef, useState } from 'react';
import type { PontuacaoSetor, PontuacaoSetorMeta } from '../types';
import { chamarLegadoApi } from './legado/api';

// Pontuação do setor (Faturamento → Indicadores): lê o resumo pronto de
// /api/faturamento/pontuacao. A pontuação é mensal: com `mes` nulo (modo
// Período) não chama a API.

interface RespostaPontuacao {
  success?: boolean;
  error?: string;
  meta?: PontuacaoSetorMeta;
  pontuacao?: PontuacaoSetor;
}

const MENSAGEM_ERRO = 'Não foi possível carregar a pontuação do setor.';

export function usePontuacaoSetor(mes: string | null) {
  const [pontuacao, setPontuacao] = useState<PontuacaoSetor | null>(null);
  const [meta, setMeta] = useState<PontuacaoSetorMeta | null>(null);
  const [loading, setLoading] = useState(mes !== null);
  const [error, setError] = useState<string | null>(null);
  const buscaAtual = useRef(0);

  const refetch = useCallback(async () => {
    const reqId = ++buscaAtual.current;
    if (mes === null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = await chamarLegadoApi<RespostaPontuacao>('pontuacao', new URLSearchParams({ mes }), MENSAGEM_ERRO);
      if (reqId !== buscaAtual.current) return;
      setPontuacao(body.pontuacao ?? null);
      setMeta(body.meta ?? null);
    } catch (err) {
      if (reqId !== buscaAtual.current) return;
      setError(err instanceof Error ? err.message : MENSAGEM_ERRO);
      setPontuacao(null);
      setMeta(null);
    } finally {
      if (reqId === buscaAtual.current) setLoading(false);
    }
  }, [mes]);

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [refetch]);

  return { pontuacao, meta, loading, error, refetch };
}
