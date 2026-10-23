import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type {
  LoteRecursoFoto,
  LotesRecursoFiltros,
  LotesRecursoMeta,
  RecorteGlosas,
  ResumoAcompanhamentoRecursos,
} from '../types';
import { chamarLegadoApi, getTokenLegado } from './legado/api';

// Tela Glosas e Recursos (.scratch/glosas-recursos-dashboard/): a foto do
// apLIS mora no Supabase e é gravada pela sincronização
// (/api/faturamento/glosas-recursos-sincronizar). Sem o cache persistente das
// listagens legado: depois do "Atualizar" a lista tem que refletir a foto nova.

// Particular tem lista própria e Cortesia não é cobrável: não têm glosa de convênio.
const ID_FONTE_PAGADORA_PARTICULAR = '1102';
const ID_FONTE_PAGADORA_CORTESIA = '100';

export interface ConvenioGlosas {
  /** `fatinstituicao.IdInstituicao`. */
  id: number;
  nome: string;
}

/** Convênios do filtro: operadoras já sincronizadas com o apLIS. */
export function useConveniosGlosas(): ConvenioGlosas[] {
  const [convenios, setConvenios] = useState<ConvenioGlosas[]>([]);

  useEffect(() => {
    let ativo = true;
    void supabase
      .from('operadoras')
      .select('nome, aplis_id')
      .not('aplis_id', 'is', null)
      .order('nome')
      .then(({ data }) => {
        if (!ativo) return;
        setConvenios((data ?? [])
          // aplis_id não numérico (OP001…) é operadora de exemplo, sem fonte no apLIS.
          .filter((o) => /^\d+$/.test(o.aplis_id as string))
          .filter((o) => o.aplis_id !== ID_FONTE_PAGADORA_PARTICULAR && o.aplis_id !== ID_FONTE_PAGADORA_CORTESIA)
          .map((o) => ({ id: Number(o.aplis_id), nome: o.nome as string })));
      });
    return () => { ativo = false; };
  }, []);

  return convenios;
}

export interface ResultadoSincronizacao {
  requisicoes: number;
  lotes: number;
  dadoAte: string | null;
}

/** Sincroniza a foto do recorte com o apLIS. Lança com a mensagem da rota. */
export async function sincronizarGlosasRecursos(recorte: RecorteGlosas): Promise<ResultadoSincronizacao> {
  const token = await getTokenLegado();
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');

  const res = await fetch('/api/faturamento/glosas-recursos-sincronizar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      competencia: recorte.competencia,
      ...(recorte.fontePagadoraId !== null ? { fontePagadoraId: recorte.fontePagadoraId } : {}),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    requisicoes?: number;
    lotes?: number;
    meta?: { dadoAte: string | null };
  };
  if (!res.ok || !body.success) {
    throw new Error(body.error || 'Não foi possível sincronizar com o apLIS.');
  }
  return { requisicoes: body.requisicoes ?? 0, lotes: body.lotes ?? 0, dadoAte: body.meta?.dadoAte ?? null };
}

interface RespostaLotesRecurso {
  success?: boolean;
  error?: string;
  meta?: LotesRecursoMeta;
  lotes?: LoteRecursoFoto[];
}

interface UseLotesRecursoResult {
  lotes: LoteRecursoFoto[];
  meta: LotesRecursoMeta | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const MENSAGEM_ERRO_LOTES = 'Não foi possível carregar os lotes de recurso.';

/** Lotes de recurso da foto no recorte. */
export function useLotesRecurso(filtros: LotesRecursoFiltros): UseLotesRecursoResult {
  const [lotes, setLotes] = useState<LoteRecursoFoto[]>([]);
  const [meta, setMeta] = useState<LotesRecursoMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Descarta respostas fora de ordem ao trocar filtro/página rápido.
  const buscaAtual = useRef(0);

  const { competencia, fontePagadoraId, status, busca, pagina, tamanho } = filtros;

  const refetch = useCallback(async () => {
    const reqId = ++buscaAtual.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ competencia, pagina: String(pagina), tamanho: String(tamanho) });
      if (fontePagadoraId !== null) params.set('fontePagadoraId', String(fontePagadoraId));
      if (status) params.set('status', status);
      if (busca) params.set('busca', busca);
      const body = await chamarLegadoApi<RespostaLotesRecurso>('glosas-recursos-lotes', params, MENSAGEM_ERRO_LOTES);
      if (reqId !== buscaAtual.current) return;
      setLotes(body.lotes ?? []);
      setMeta(body.meta ?? null);
    } catch (err) {
      if (reqId !== buscaAtual.current) return;
      setError(err instanceof Error ? err.message : MENSAGEM_ERRO_LOTES);
      setLotes([]);
      setMeta(null);
    } finally {
      if (reqId === buscaAtual.current) setLoading(false);
    }
  }, [competencia, fontePagadoraId, status, busca, pagina, tamanho]);

  useEffect(() => {
    void refetch();
    // Invalida a busca em voo no unmount (contador, não nó do DOM).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [refetch]);

  return { lotes, meta, loading, error, refetch };
}

interface RespostaResumoRecursos {
  success?: boolean;
  error?: string;
  resumo?: ResumoAcompanhamentoRecursos;
}

interface UseResumoRecursosResult {
  resumo: ResumoAcompanhamentoRecursos | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const MENSAGEM_ERRO_RESUMO = 'Não foi possível carregar o resumo dos recursos.';

/** Cards do Acompanhamento dos recursos no recorte. */
export function useResumoRecursos(recorte: RecorteGlosas): UseResumoRecursosResult {
  const [resumo, setResumo] = useState<ResumoAcompanhamentoRecursos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const buscaAtual = useRef(0);

  const { competencia, fontePagadoraId } = recorte;

  const refetch = useCallback(async () => {
    const reqId = ++buscaAtual.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ competencia });
      if (fontePagadoraId !== null) params.set('fontePagadoraId', String(fontePagadoraId));
      const body = await chamarLegadoApi<RespostaResumoRecursos>('glosas-recursos-resumo', params, MENSAGEM_ERRO_RESUMO);
      if (reqId !== buscaAtual.current) return;
      setResumo(body.resumo ?? null);
    } catch (err) {
      if (reqId !== buscaAtual.current) return;
      setError(err instanceof Error ? err.message : MENSAGEM_ERRO_RESUMO);
      setResumo(null);
    } finally {
      if (reqId === buscaAtual.current) setLoading(false);
    }
  }, [competencia, fontePagadoraId]);

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [refetch]);

  return { resumo, loading, error, refetch };
}
