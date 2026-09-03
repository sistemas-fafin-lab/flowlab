import { useCallback, useEffect, useRef, useState } from 'react';
import { chamarLegadoApi } from './api';
import { gravarCachePersistente, lerCachePersistente } from './cachePersistente';

// Esqueleto comum das listagens legado (lotes de faturamento, glosas, recursos):
// cache de sessão por chave de filtros, guarda de corrida para descartar respostas
// fora de ordem, e o par loading/error. Cada hook específico só descreve a rota, a
// chave de cache e como extrair itens/meta do corpo da resposta — o cache em si
// continua vivendo no módulo do hook específico, para não misturar entre listagens
// diferentes.
//
// Além do Map em memória (perdido a cada F5), a mesma entrada é espelhada em
// localStorage (cachePersistente) — o dado do MySQL de backup só muda no dia
// seguinte, então recarregar a página no mesmo dia não precisa reconsultar.

interface UseLegadoListagemOpts<TItem, TFiltros, TMeta, TBody extends { success?: boolean; error?: string }> {
  filtros: TFiltros;
  rota: string;
  cache: Map<string, { itens: TItem[]; meta: TMeta }>;
  chaveCache: (filtros: TFiltros) => string;
  montarParams: (filtros: TFiltros, force: boolean) => URLSearchParams;
  extrairItens: (body: TBody) => TItem[];
  extrairMeta: (body: TBody) => TMeta | null;
  mensagemErroPadrao: string;
  /** Efeito colateral disparado quando `force` é true, antes da busca (ex.: limpar o cache de detalhe). */
  aoForcar?: () => void;
}

interface UseLegadoListagemResult<TItem, TMeta> {
  itens: TItem[];
  meta: TMeta | null;
  loading: boolean;
  error: string | null;
  refetch: (force?: boolean) => Promise<void>;
}

export function useLegadoListagem<
  TItem,
  TFiltros,
  TMeta,
  TBody extends { success?: boolean; error?: string },
>(opts: UseLegadoListagemOpts<TItem, TFiltros, TMeta, TBody>): UseLegadoListagemResult<TItem, TMeta> {
  const {
    filtros, rota, cache, chaveCache, montarParams,
    extrairItens, extrairMeta, mensagemErroPadrao, aoForcar,
  } = opts;

  const [itens, setItens] = useState<TItem[]>([]);
  const [meta, setMeta] = useState<TMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Descarta respostas de buscas antigas: trocar de página/filtro rápido pode
  // devolver fora de ordem e sobrescrever o resultado novo com o velho.
  const buscaAtual = useRef(0);

  const chave = chaveCache(filtros);
  const chavePersistente = `${rota}|${chave}`;

  const refetch = useCallback(async (force = false) => {
    if (!force && cache.has(chave)) {
      const cached = cache.get(chave)!;
      setItens(cached.itens);
      setMeta(cached.meta);
      setLoading(false);
      setError(null);
      return;
    }

    if (!force) {
      const persistido = lerCachePersistente<{ itens: TItem[]; meta: TMeta }>(chavePersistente);
      if (persistido) {
        cache.set(chave, persistido);
        setItens(persistido.itens);
        setMeta(persistido.meta);
        setLoading(false);
        setError(null);
        return;
      }
    }

    const reqId = ++buscaAtual.current;
    setLoading(true);
    setError(null);

    if (force) aoForcar?.();

    try {
      const params = montarParams(filtros, force);
      const body = await chamarLegadoApi<TBody>(rota, params, mensagemErroPadrao);
      if (reqId !== buscaAtual.current) return;
      const i = extrairItens(body);
      const m = extrairMeta(body);
      setItens(i);
      setMeta(m);
      if (m) {
        cache.set(chave, { itens: i, meta: m });
        gravarCachePersistente(chavePersistente, { itens: i, meta: m });
      }
    } catch (err) {
      if (reqId !== buscaAtual.current) return;
      setError(err instanceof Error ? err.message : mensagemErroPadrao);
      setItens([]);
      setMeta(null);
    } finally {
      if (reqId === buscaAtual.current) setLoading(false);
    }
    // `chave` já captura tudo em `filtros` que importa para o refetch — depender
    // do objeto `filtros` cru refetcharia em loop a cada literal novo do chamador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rota, chave, chavePersistente]);

  useEffect(() => {
    void refetch();
    // Invalida a busca em voo no unmount. O aviso da regra é sobre refs que apontam
    // p/ nós do DOM; esta guarda um contador, e mutá-la aqui é justamente a intenção.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [refetch]);

  return { itens, meta, loading, error, refetch };
}
