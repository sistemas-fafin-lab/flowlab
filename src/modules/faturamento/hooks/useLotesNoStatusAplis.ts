import { useEffect, useRef, useState } from 'react';
import { chamarApi } from './useContasReceber';

// Filtro "Status do lote (apLIS)" da aba Títulos: ids no apLIS dos lotes dos
// títulos do período que estão hoje no status escolhido. A rota não tem cache —
// cada leitura é o estado do apLIS (até ontem).

const MENSAGEM_PADRAO = 'Não foi possível consultar o status dos lotes no apLIS.';

interface UseLotesNoStatusAplisResult {
  /** null enquanto não chegou, se falhou ou com o filtro desligado. */
  idsLote: number[] | null;
  carregando: boolean;
  erro: string | null;
}

/**
 * Lê os ids quando o filtro está ligado e de novo a cada troca de status, de
 * período ou de `versao` ("Atualizar" da aba Títulos).
 */
export function useLotesNoStatusAplis(
  status: number | '',
  desde: string,
  ate: string,
  versao: number,
): UseLotesNoStatusAplisResult {
  const [idsLote, setIdsLote] = useState<number[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Descarta a resposta de uma leitura já substituída por outra.
  const leituraRef = useRef(0);

  useEffect(() => {
    const leitura = ++leituraRef.current;
    setIdsLote(null);
    setErro(null);
    if (!status) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    const params = new URLSearchParams({ status: String(status), desde, ate });
    chamarApi<{ idsLote?: number[] }>(`/api/faturamento/titulos-lotes-status-aplis?${params}`, MENSAGEM_PADRAO)
      .then((body) => {
        if (leitura === leituraRef.current) setIdsLote(body.idsLote ?? []);
      })
      .catch((err: unknown) => {
        if (leitura === leituraRef.current) setErro(err instanceof Error ? err.message : MENSAGEM_PADRAO);
      })
      .finally(() => {
        if (leitura === leituraRef.current) setCarregando(false);
      });
  }, [status, desde, ate, versao]);

  return { idsLote, carregando, erro };
}
