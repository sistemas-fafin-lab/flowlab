import { useCallback, useEffect, useRef, useState } from 'react';
import type { CandidataMeta } from '../utils/metaSugerida';
import { chamarLegadoApi } from './legado/api';

// Candidatas da meta do mês (90/10, média de 2 e de 3 meses) para o modal "Definir meta"
// (/api/faturamento/meta-sugerida, faturamento-meta-sugerida issue 02). Só busca com o
// modal aberto: são três meses de Elegíveis no apLIS, e o card não precisa delas.

const MENSAGEM_PADRAO = 'Não foi possível calcular as sugestões de meta no apLIS.';

export interface MetaSugerida {
  candidatas: CandidataMeta[];
  /** Elegíveis dos meses usados ('YYYY-MM' → R$); mês ausente = sem dado. */
  elegiveis: Record<string, number>;
  /** `DtaSolicitacao` mais recente do backup, 'YYYY-MM-DD'. */
  dadoAte: string | null;
}

interface RespostaMetaSugerida {
  success?: boolean;
  error?: string;
  candidatas?: CandidataMeta[];
  elegiveis?: { mes: string; valor: number }[];
  dadoAte?: string | null;
}

export interface EstadoMetaSugerida {
  sugestao: MetaSugerida | null;
  loading: boolean;
  erro: string | null;
  recarregar: () => void;
}

/** `mes` 'YYYY-MM' da meta; `ativo` falso não busca (modal fechado). */
export function useMetaSugerida(mes: string, ativo: boolean): EstadoMetaSugerida {
  const [sugestao, setSugestao] = useState<MetaSugerida | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Descarta resposta de um pedido já substituído.
  const buscaAtual = useRef(0);

  const carregar = useCallback(async () => {
    const busca = ++buscaAtual.current;
    setLoading(true);
    setErro(null);
    try {
      const body = await chamarLegadoApi<RespostaMetaSugerida>('meta-sugerida', new URLSearchParams({ mes }), MENSAGEM_PADRAO);
      if (busca !== buscaAtual.current) return;
      setSugestao({
        candidatas: body.candidatas ?? [],
        elegiveis: Object.fromEntries((body.elegiveis ?? []).map((e) => [e.mes, e.valor])),
        dadoAte: body.dadoAte ?? null,
      });
    } catch (e) {
      if (busca !== buscaAtual.current) return;
      setSugestao(null);
      setErro(e instanceof Error ? e.message : MENSAGEM_PADRAO);
    } finally {
      if (busca === buscaAtual.current) setLoading(false);
    }
  }, [mes]);

  useEffect(() => {
    if (!ativo) return;
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [ativo, carregar]);

  return { sugestao, loading, erro, recarregar: carregar };
}
