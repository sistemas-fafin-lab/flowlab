import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type {
  LoteRecursoLegado,
  LotesMeta,
  ProcedimentoRecursoLegado,
  RecursosLegadoFiltros,
} from '../../billing/types';

// Lista os lotes de recurso (fatloterecurso) pela rota /api/faturamento/recursos-legado
// e o detalhe de um lote (procedimentos) pela mesma rota com ?idLoteRecurso= — mesmo
// esqueleto de useFaturamentoLotes/useGlosasLegado.

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

const cacheSessao = new Map<string, { recursos: LoteRecursoLegado[]; meta: LotesMeta }>();
const cacheDetalheSessao = new Map<number, ProcedimentoRecursoLegado[]>();

interface RespostaRecursosLegado {
  success?: boolean;
  error?: string;
  meta?: LotesMeta;
  recursos?: LoteRecursoLegado[];
}

interface RespostaDetalheRecurso {
  success?: boolean;
  error?: string;
  procedimentos?: ProcedimentoRecursoLegado[];
}

async function consultar<T extends { success?: boolean; error?: string }>(
  params: URLSearchParams,
): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');

  const res = await fetch(`/api/faturamento/recursos-legado?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => ({}))) as T;

  if (!res.ok || !body.success) {
    throw new Error(body.error || 'Não foi possível consultar os recursos do legado.');
  }
  return body;
}

interface UseRecursosLegadoResult {
  recursos: LoteRecursoLegado[];
  meta: LotesMeta | null;
  loading: boolean;
  error: string | null;
  refetch: (force?: boolean) => Promise<void>;
  /** Procedimentos do lote de recurso, sob demanda ao expandir a linha. */
  buscarProcedimentos: (idLoteRecurso: number, force?: boolean) => Promise<ProcedimentoRecursoLegado[]>;
}

export function useRecursosLegado(filtros: RecursosLegadoFiltros): UseRecursosLegadoResult {
  const [recursos, setRecursos] = useState<LoteRecursoLegado[]>([]);
  const [meta, setMeta] = useState<LotesMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { status, fontePagadoraId, pagina, tamanho, busca } = filtros;

  const buscaAtual = useRef(0);

  const refetch = useCallback(async (force = false) => {
    const chave = `${status ?? ''}|${fontePagadoraId ?? ''}|${pagina ?? 1}|${tamanho ?? 50}|${busca ?? ''}`;
    if (!force && cacheSessao.has(chave)) {
      const cached = cacheSessao.get(chave)!;
      setRecursos(cached.recursos);
      setMeta(cached.meta);
      setLoading(false);
      setError(null);
      return;
    }

    const reqId = ++buscaAtual.current;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (status !== undefined) params.set('status', String(status));
    if (fontePagadoraId) params.set('fontePagadoraId', String(fontePagadoraId));
    if (pagina) params.set('pagina', String(pagina));
    if (tamanho) params.set('tamanho', String(tamanho));
    if (busca) params.set('busca', busca);
    if (force) {
      params.set('semCache', '1');
      cacheDetalheSessao.clear();
    }

    try {
      const body = await consultar<RespostaRecursosLegado>(params);
      if (reqId !== buscaAtual.current) return;
      const r = body.recursos ?? [];
      const m = body.meta ?? null;
      setRecursos(r);
      setMeta(m);
      if (m) cacheSessao.set(chave, { recursos: r, meta: m });
    } catch (err) {
      if (reqId !== buscaAtual.current) return;
      setError(err instanceof Error ? err.message : 'Não foi possível consultar os recursos do legado.');
      setRecursos([]);
      setMeta(null);
    } finally {
      if (reqId === buscaAtual.current) setLoading(false);
    }
  }, [status, fontePagadoraId, pagina, tamanho, busca]);

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [refetch]);

  const buscarProcedimentos = useCallback(async (
    idLoteRecurso: number,
    force = false,
  ): Promise<ProcedimentoRecursoLegado[]> => {
    if (!force && cacheDetalheSessao.has(idLoteRecurso)) return cacheDetalheSessao.get(idLoteRecurso)!;

    const params = new URLSearchParams({ idLoteRecurso: String(idLoteRecurso) });
    if (force) params.set('semCache', '1');

    const body = await consultar<RespostaDetalheRecurso>(params);
    const procs = body.procedimentos ?? [];
    cacheDetalheSessao.set(idLoteRecurso, procs);
    return procs;
  }, []);

  return { recursos, meta, loading, error, refetch, buscarProcedimentos };
}

export default useRecursosLegado;
