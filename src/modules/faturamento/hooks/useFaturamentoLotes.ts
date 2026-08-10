import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type {
  LoteFaturamento,
  LotesFiltros,
  LotesMeta,
  RequisicaoLote,
} from '../../billing/types';

// Lista os lotes de faturamento pela rota /api/faturamento/lotes e o detalhe de um
// lote (requisições + procedimentos) pela /api/faturamento/lote-detalhe.
//
// Não lê o Supabase: os dados vêm do MySQL de backup do laboratório, cujas credenciais
// são server-side, então a consulta passa pela function, que valida o JWT da sessão +
// canViewBilling. Por isso é um hook à parte de useContasReceber/useGlosas — cada um
// com seu próprio par loading/error, para uma busca de faturas não piscar o spinner
// das outras abas.

// Token da sessão do operador; a rota /api valida este JWT + canViewBilling.
async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// Cache de sessão (module-level): evita refetch ao alternar páginas ou abas. O
// servidor também tem cache (TTL 3 min), então o pior caso já é rápido. Expira no
// F5 porque é memória; o "Atualizar" chama refetch direto, que ignora o cache.
const cacheSessao = new Map<string, { lotes: LoteFaturamento[]; meta: LotesMeta }>();
const cacheDetalheSessao = new Map<number, RequisicaoLote[]>();

interface RespostaLotes {
  success?: boolean;
  error?: string;
  meta?: LotesMeta;
  lotes?: LoteFaturamento[];
}

interface RespostaDetalhe {
  success?: boolean;
  error?: string;
  requisicoes?: RequisicaoLote[];
}

async function consultar<T extends { success?: boolean; error?: string }>(
  rota: string,
  params: URLSearchParams,
): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');

  const res = await fetch(`/api/faturamento/${rota}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => ({}))) as T;

  if (!res.ok || !body.success) {
    throw new Error(body.error || 'Não foi possível consultar o faturamento.');
  }
  return body;
}

interface UseFaturamentoLotesResult {
  lotes: LoteFaturamento[];
  meta: LotesMeta | null;
  loading: boolean;
  error: string | null;
  refetch: (force?: boolean) => Promise<void>;
  /**
   * Requisições do lote com seus procedimentos, sob demanda ao expandir a linha.
   * `force` fura o cache de sessão e o do servidor — é o caminho do "Atualizar".
   */
  buscarRequisicoes: (idLote: number, force?: boolean) => Promise<RequisicaoLote[]>;
}

export function useFaturamentoLotes(filtros: LotesFiltros): UseFaturamentoLotesResult {
  const [lotes, setLotes] = useState<LoteFaturamento[]>([]);
  const [meta, setMeta] = useState<LotesMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Desestruturado para que as deps do useCallback sejam primitivas — com o objeto
  // `filtros` cru, um novo literal a cada render refetcharia em loop.
  const { periodoIni, periodoFim, pagina, tamanho, statusLote, busca } = filtros;

  // Descarta respostas de buscas antigas: trocar de página/filtro rápido pode
  // devolver fora de ordem e sobrescrever o resultado novo com o velho.
  const buscaAtual = useRef(0);

  const refetch = useCallback(async (force = false) => {
    const chave = `${periodoIni}|${periodoFim}|${pagina ?? 1}|${tamanho ?? 50}|${statusLote ?? ''}|${busca ?? ''}`;
    if (!force && cacheSessao.has(chave)) {
      const cached = cacheSessao.get(chave)!;
      setLotes(cached.lotes);
      setMeta(cached.meta);
      setLoading(false);
      setError(null);
      return;
    }

    const reqId = ++buscaAtual.current;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ periodoIni, periodoFim });
    if (pagina) params.set('pagina', String(pagina));
    if (tamanho) params.set('tamanho', String(tamanho));
    if (statusLote) params.set('statusLote', String(statusLote));
    if (busca) params.set('busca', busca);
    if (force) {
      // O servidor também cacheia (TTL 3 min). Sem furar os dois, o "Atualizar"
      // devolveria exatamente a mesma resposta e o botão não faria nada.
      params.set('semCache', '1');
      // O detalhe já carregado envelhece junto: se a listagem mudou, as requisições
      // daquele lote podem ter mudado também.
      cacheDetalheSessao.clear();
    }

    try {
      const body = await consultar<RespostaLotes>('lotes', params);
      if (reqId !== buscaAtual.current) return;
      const l = body.lotes ?? [];
      const m = body.meta ?? null;
      setLotes(l);
      setMeta(m);
      if (m) cacheSessao.set(chave, { lotes: l, meta: m });
    } catch (err) {
      if (reqId !== buscaAtual.current) return;
      setError(err instanceof Error ? err.message : 'Não foi possível consultar o faturamento.');
      setLotes([]);
      setMeta(null);
    } finally {
      if (reqId === buscaAtual.current) setLoading(false);
    }
  }, [periodoIni, periodoFim, pagina, tamanho, statusLote, busca]);

  useEffect(() => {
    void refetch();
    // Invalida a busca em voo no unmount. O aviso da regra é sobre refs que apontam
    // p/ nós do DOM; esta guarda um contador, e mutá-la aqui é justamente a intenção.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [refetch]);

  // Rota separada: o detalhe é uma consulta por lote (dezenas de linhas), caro demais
  // para vir junto da listagem.
  const buscarRequisicoes = useCallback(async (
    idLote: number,
    force = false,
  ): Promise<RequisicaoLote[]> => {
    if (!force && cacheDetalheSessao.has(idLote)) return cacheDetalheSessao.get(idLote)!;

    const params = new URLSearchParams({ idLote: String(idLote) });
    // Sem isto a releitura pararia no cache do servidor (TTL 3 min) e o "Atualizar"
    // devolveria as mesmas requisições que a tela já tem.
    if (force) params.set('semCache', '1');

    const body = await consultar<RespostaDetalhe>('lote-detalhe', params);
    const reqs = body.requisicoes ?? [];
    cacheDetalheSessao.set(idLote, reqs);
    return reqs;
  }, []);

  return { lotes, meta, loading, error, refetch, buscarRequisicoes };
}
