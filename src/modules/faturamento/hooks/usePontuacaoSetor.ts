import { useCallback, useEffect, useRef, useState } from 'react';
import type { LancamentoPontuacao, PontuacaoSetor, PontuacaoSetorMeta } from '../types';
import { chamarLegadoApi, getTokenLegado } from './legado/api';

// Pontuação do setor (Faturamento → Indicadores): lê o resumo pronto de
// /api/faturamento/pontuacao. A pontuação é mensal: com `mes` nulo (modo
// Período) não chama a API. `lancarPontuacao` grava um critério manual.

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

/** Lança ou altera um critério manual (canManageBilling). Lança com a mensagem da rota. */
export async function lancarPontuacao(lancamento: LancamentoPontuacao): Promise<void> {
  const token = await getTokenLegado();
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');

  const res = await fetch('/api/faturamento/pontuacao', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(lancamento),
  });
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
  if (!res.ok || !body.success) {
    throw new Error(body.error || 'Não foi possível gravar o lançamento.');
  }
}
