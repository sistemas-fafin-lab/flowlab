import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversaoConvenio, ConversaoMes } from '../utils/conversaoRequisicoes';
import { chamarLegadoApi } from './legado/api';

// Conversão de requisições da aba Comparativos (/api/faturamento/comparativos-conversao).
// Sem cache: a falha do apLIS precisa poder ser repetida com "Tentar novamente".

interface RespostaConversao {
  success?: boolean;
  error?: string;
  totais?: ConversaoMes[];
  convenios?: ConversaoConvenio[];
}

export interface EstadoConversao {
  totais: ConversaoMes[];
  convenios: ConversaoConvenio[];
  loading: boolean;
  /** Mensagem da API (ex.: apLIS indisponível); `null` quando a leitura deu certo. */
  erro: string | null;
  recarregar: () => void;
}

const MENSAGEM_ERRO = 'Não foi possível consultar a conversão de requisições.';

export function useComparativosConversao(mes: string): EstadoConversao {
  const [totais, setTotais] = useState<ConversaoMes[]>([]);
  const [convenios, setConvenios] = useState<ConversaoConvenio[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // Descarta resposta de um mês já trocado.
  const buscaAtual = useRef(0);

  const carregar = useCallback(async () => {
    const busca = ++buscaAtual.current;
    setLoading(true);
    setErro(null);
    try {
      const body = await chamarLegadoApi<RespostaConversao>('comparativos-conversao', new URLSearchParams({ mes }), MENSAGEM_ERRO);
      if (busca !== buscaAtual.current) return;
      setTotais(body.totais ?? []);
      setConvenios(body.convenios ?? []);
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

  return { totais, convenios, loading, erro, recarregar: carregar };
}
