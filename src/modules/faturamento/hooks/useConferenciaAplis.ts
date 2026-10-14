import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chamarApi } from './useContasReceber';
import type { ConferenciaAplis, DivergenciaAplis } from '../types';

// Conferência das baixas com o apLIS (.scratch/faturamento-conferencia-baixas-aplis)
// para a aba Títulos: selo na linha e filtro "Divergente do apLIS". A rota não
// tem cache — cada leitura é o estado do apLIS (até ontem) contra as baixas de agora.

const MENSAGEM_PADRAO = 'Não foi possível conferir as baixas com o apLIS.';

/** GET /api/faturamento/titulos-conferencia-aplis. Também usado pelo modal. */
export async function buscarConferenciaAplis(): Promise<ConferenciaAplis> {
  const body = await chamarApi<{ meta?: { dadoAte?: string | null }; titulos?: DivergenciaAplis[] }>(
    '/api/faturamento/titulos-conferencia-aplis',
    MENSAGEM_PADRAO,
  );
  return { dadoAte: body.meta?.dadoAte ?? null, titulos: body.titulos ?? [] };
}

interface UseConferenciaAplisResult {
  /** Divergentes por `idNota`; null enquanto não chegou ou se falhou. */
  porTitulo: Map<string, DivergenciaAplis> | null;
  titulos: DivergenciaAplis[] | null;
  carregando: boolean;
  erro: string | null;
}

/**
 * Lê a conferência quando `ativo` liga (cada entrada na aba Títulos) e de novo
 * a cada troca de `versao` (baixa salva ou excluída, "Atualizar"). Não bloqueia
 * nada: a lista carrega por conta própria e os selos entram quando isto chegar.
 */
export function useConferenciaAplis(ativo: boolean, versao: number): UseConferenciaAplisResult {
  const [titulos, setTitulos] = useState<DivergenciaAplis[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Descarta a resposta de uma leitura já substituída por outra.
  const leituraRef = useRef(0);

  const carregar = useCallback(async () => {
    const leitura = ++leituraRef.current;
    setCarregando(true);
    setErro(null);
    try {
      const conferencia = await buscarConferenciaAplis();
      if (leitura !== leituraRef.current) return;
      setTitulos(conferencia.titulos);
    } catch (err) {
      if (leitura !== leituraRef.current) return;
      // Sem selos em vez dos da leitura anterior: o operador pode ter acabado
      // de acertar justamente aquele título. (Durante a releitura os anteriores
      // ficam, para a lista não piscar.)
      setTitulos(null);
      setErro(err instanceof Error ? err.message : MENSAGEM_PADRAO);
    } finally {
      if (leitura === leituraRef.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (ativo) void carregar();
  }, [ativo, versao, carregar]);

  // Sair da aba no meio da leitura não deixa `carregando` preso.
  useEffect(() => {
    if (ativo) return;
    leituraRef.current += 1;
    setCarregando(false);
  }, [ativo]);

  const porTitulo = useMemo(
    () => (titulos ? new Map(titulos.map((t) => [t.idNota, t])) : null),
    [titulos],
  );

  return { porTitulo, titulos, carregando, erro };
}
