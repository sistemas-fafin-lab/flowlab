import { useCallback, useEffect, useRef, useState } from 'react';
import type { FONTES_MARCOS, SlaMes } from '../utils/slaFaturamento';
import { chamarLegadoApi } from './legado/api';

// SLA por convênio da aba Comparativos (/api/faturamento/comparativos-sla).
// Sem cache: a falha do apLIS precisa poder ser repetida com "Tentar novamente".

export type FontesMarcos = Record<keyof typeof FONTES_MARCOS, string>;

interface RespostaSla {
  success?: boolean;
  error?: string;
  fontes?: FontesMarcos;
  sla?: SlaMes[];
}

export interface EstadoSla {
  sla: SlaMes[];
  fontes: FontesMarcos | null;
  loading: boolean;
  /** Mensagem da API (ex.: apLIS indisponível); `null` quando a leitura deu certo. */
  erro: string | null;
  recarregar: () => void;
}

const MENSAGEM_ERRO = 'Não foi possível consultar o SLA por convênio.';

export function useComparativosSla(mes: string): EstadoSla {
  const [sla, setSla] = useState<SlaMes[]>([]);
  const [fontes, setFontes] = useState<FontesMarcos | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // Descarta resposta de um mês já trocado.
  const buscaAtual = useRef(0);

  const carregar = useCallback(async () => {
    const busca = ++buscaAtual.current;
    setLoading(true);
    setErro(null);
    try {
      const body = await chamarLegadoApi<RespostaSla>('comparativos-sla', new URLSearchParams({ mes }), MENSAGEM_ERRO);
      if (busca !== buscaAtual.current) return;
      setSla(body.sla ?? []);
      setFontes(body.fontes ?? null);
    } catch (e) {
      if (busca !== buscaAtual.current) return;
      setErro(e instanceof Error ? e.message : MENSAGEM_ERRO);
    } finally {
      if (busca === buscaAtual.current) setLoading(false);
    }
  }, [mes]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { sla, fontes, loading, erro, recarregar: carregar };
}
