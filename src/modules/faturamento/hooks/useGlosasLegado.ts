import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { GlosaRequisicaoLegado, GlosasLegadoFiltros, LotesMeta } from '../../billing/types';

// Lista as glosas do legado (fatrequisicaoprocedimento.IdMotivoGlosa) pela rota
// /api/faturamento/glosas-legado — mesmo esqueleto de useFaturamentoLotes: não lê o
// Supabase, as credenciais do MySQL de backup são server-side, a function valida o
// JWT da sessão + canViewBilling.
//
// Hook à parte de useGlosas (glosas nativas) de propósito: fontes, filtros (período
// obrigatório aqui) e formato de resposta são diferentes, e cada aba tem seu próprio
// par loading/error para não piscar o spinner da outra.

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// Cache de sessão (module-level): evita refetch ao alternar páginas. O servidor
// também cacheia (TTL 3 min); expira no F5 porque é memória.
const cacheSessao = new Map<string, { glosas: GlosaRequisicaoLegado[]; meta: LotesMeta }>();

interface RespostaGlosasLegado {
  success?: boolean;
  error?: string;
  meta?: LotesMeta;
  glosas?: GlosaRequisicaoLegado[];
}

async function consultar(params: URLSearchParams): Promise<RespostaGlosasLegado> {
  const token = await getToken();
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');

  const res = await fetch(`/api/faturamento/glosas-legado?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => ({}))) as RespostaGlosasLegado;

  if (!res.ok || !body.success) {
    throw new Error(body.error || 'Não foi possível consultar as glosas do legado.');
  }
  return body;
}

interface UseGlosasLegadoResult {
  glosas: GlosaRequisicaoLegado[];
  meta: LotesMeta | null;
  loading: boolean;
  error: string | null;
  refetch: (force?: boolean) => Promise<void>;
}

export function useGlosasLegado(filtros: GlosasLegadoFiltros): UseGlosasLegadoResult {
  const [glosas, setGlosas] = useState<GlosaRequisicaoLegado[]>([]);
  const [meta, setMeta] = useState<LotesMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { periodoIni, periodoFim, fontePagadoraId, pagina, tamanho, busca } = filtros;

  const buscaAtual = useRef(0);

  const refetch = useCallback(async (force = false) => {
    const chave = `${periodoIni}|${periodoFim}|${fontePagadoraId ?? ''}|${pagina ?? 1}|${tamanho ?? 50}|${busca ?? ''}`;
    if (!force && cacheSessao.has(chave)) {
      const cached = cacheSessao.get(chave)!;
      setGlosas(cached.glosas);
      setMeta(cached.meta);
      setLoading(false);
      setError(null);
      return;
    }

    const reqId = ++buscaAtual.current;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ periodoIni, periodoFim });
    if (fontePagadoraId) params.set('fontePagadoraId', String(fontePagadoraId));
    if (pagina) params.set('pagina', String(pagina));
    if (tamanho) params.set('tamanho', String(tamanho));
    if (busca) params.set('busca', busca);
    if (force) params.set('semCache', '1');

    try {
      const body = await consultar(params);
      if (reqId !== buscaAtual.current) return;
      const g = body.glosas ?? [];
      const m = body.meta ?? null;
      setGlosas(g);
      setMeta(m);
      if (m) cacheSessao.set(chave, { glosas: g, meta: m });
    } catch (err) {
      if (reqId !== buscaAtual.current) return;
      setError(err instanceof Error ? err.message : 'Não foi possível consultar as glosas do legado.');
      setGlosas([]);
      setMeta(null);
    } finally {
      if (reqId === buscaAtual.current) setLoading(false);
    }
  }, [periodoIni, periodoFim, fontePagadoraId, pagina, tamanho, busca]);

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [refetch]);

  return { glosas, meta, loading, error, refetch };
}

export default useGlosasLegado;
