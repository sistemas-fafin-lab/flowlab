import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { ImagemRequisicaoLegado } from '../../billing/types';

// Lista + bytes das imagens de uma requisição do legado (requisicaoimagem), aberto
// pelo botão "Ver imagens" dos históricos de Glosas e Recursos. Rota própria de
// propósito: metadados (lista) e bytes (arquivo) são endpoints separados — o blob
// pode pesar alguns MB e só o item que o operador está olhando precisa descer.

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

interface RespostaImagens {
  success?: boolean;
  error?: string;
  imagens?: ImagemRequisicaoLegado[];
}

interface UseImagensRequisicaoLegadoResult {
  imagens: ImagemRequisicaoLegado[];
  loading: boolean;
  error: string | null;
  /** Busca os bytes de uma imagem e devolve um object URL — cacheado por id, revogado
   *  quando `idRequisicao` muda ou o hook desmonta. */
  carregarArquivo: (id: number) => Promise<string>;
}

export function useImagensRequisicaoLegado(
  idRequisicao: number | null,
): UseImagensRequisicaoLegadoResult {
  const [imagens, setImagens] = useState<ImagemRequisicaoLegado[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlsRef = useRef<Map<number, string>>(new Map());

  // Troca de requisição (ou desmonte): revoga os object URLs já criados, senão
  // vazam — cada um segura o blob inteiro na memória do navegador.
  useEffect(() => {
    return () => {
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      urlsRef.current.clear();
    };
  }, [idRequisicao]);

  useEffect(() => {
    if (idRequisicao == null) {
      setImagens([]);
      setError(null);
      return;
    }

    let cancelado = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Sessão expirada. Faça login novamente.');

        const res = await fetch(`/api/faturamento/imagens-legado?idRequisicao=${idRequisicao}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json().catch(() => ({}))) as RespostaImagens;
        if (!res.ok || !body.success) {
          throw new Error(body.error || 'Não foi possível consultar as imagens da requisição.');
        }
        if (!cancelado) setImagens(body.imagens ?? []);
      } catch (err) {
        if (!cancelado) {
          setError(
            err instanceof Error ? err.message : 'Não foi possível consultar as imagens da requisição.',
          );
          setImagens([]);
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => { cancelado = true; };
  }, [idRequisicao]);

  const carregarArquivo = useCallback(async (id: number): Promise<string> => {
    const emCache = urlsRef.current.get(id);
    if (emCache) return emCache;

    const token = await getToken();
    if (!token) throw new Error('Sessão expirada. Faça login novamente.');

    const res = await fetch(`/api/faturamento/imagem-legado-arquivo?id=${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Não foi possível carregar a imagem.');
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    urlsRef.current.set(id, url);
    return url;
  }, []);

  return { imagens, loading, error, carregarArquivo };
}

export default useImagensRequisicaoLegado;
