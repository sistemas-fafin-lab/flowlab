import { useCallback, useEffect, useRef, useState } from 'react';
import { chamarApi } from './useContasReceber';
import type { ComparacaoSaldoOperadora, DashboardReceberFiltros } from '../types';

// Saldo no sistema × saldo no apLIS por operadora, para o widget "Saldo por
// operadora" do Dashboard (.scratch/faturamento-comparativos/issues/02). Hook à
// parte da RPC do Dashboard de propósito: o apLIS pode estar fora do ar, e o
// gráfico do sistema não pode esperar nem cair junto — a falha vira `erro` aqui
// e o widget mostra o aviso só na comparação.

const MENSAGEM_PADRAO = 'Não foi possível comparar com o apLIS.';

/** Separador das listas nas deps do efeito (mesmo de useContasReceberDashboard). */
const SEP = '\u0001';

interface UseSaldoOperadorasAplisResult {
  operadoras: ComparacaoSaldoOperadora[];
  /** Até quando o MySQL de backup do apLIS tem dado (YYYY-MM-DD); null sem leitura. */
  dadoAte: string | null;
  loading: boolean;
  erro: string | null;
  refetch: () => Promise<void>;
}

export function useSaldoOperadorasAplis(
  filtros: DashboardReceberFiltros,
  somentePeriodo: boolean,
): UseSaldoOperadorasAplisResult {
  const [operadoras, setOperadoras] = useState<ComparacaoSaldoOperadora[]>([]);
  const [dadoAte, setDadoAte] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const { desde, ate } = filtros;
  const operadoraIds = filtros.operadoraIds.join(SEP);
  const lotes = filtros.lotes.join(SEP);
  const notas = filtros.notas.join(SEP);

  const buscaAtual = useRef(0);

  const refetch = useCallback(async () => {
    const reqId = ++buscaAtual.current;
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ desde, ate, somentePeriodo: String(somentePeriodo) });
      for (const [chave, bruto] of [['operadoraId', operadoraIds], ['lote', lotes], ['nota', notas]] as const) {
        if (bruto !== '') for (const valor of bruto.split(SEP)) params.append(chave, valor);
      }
      const body = await chamarApi<{
        meta?: { dadoAte?: string | null };
        operadoras?: ComparacaoSaldoOperadora[];
      }>(`/api/faturamento/saldo-operadoras-aplis?${params.toString()}`, MENSAGEM_PADRAO);
      if (reqId !== buscaAtual.current) return;
      setOperadoras(body.operadoras ?? []);
      setDadoAte(body.meta?.dadoAte ?? null);
    } catch (err) {
      if (reqId !== buscaAtual.current) return;
      setOperadoras([]);
      setDadoAte(null);
      setErro(err instanceof Error ? err.message : MENSAGEM_PADRAO);
    } finally {
      if (reqId === buscaAtual.current) setLoading(false);
    }
  }, [desde, ate, operadoraIds, lotes, notas, somentePeriodo]);

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [refetch]);

  return { operadoras, dadoAte, loading, erro, refetch };
}
