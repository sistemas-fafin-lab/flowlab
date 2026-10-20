import { useEffect, useState } from 'react';
import { chamarLegadoApi } from '../modules/faturamento/hooks/legado/api';
import type { CobrancaAplis } from '../../api/_lib/faturamento/cobrancasTestesAplis.js';

export type { CobrancaAplis, TesteAplis } from '../../api/_lib/faturamento/cobrancasTestesAplis.js';

// Cobranças do apLIS com os testes de cada uma, para o vínculo do catálogo de
// exames do Controle de Custos (GET /api/faturamento/aplis-cobrancas-testes, que
// lê o MySQL do lab). Contrato em api/_lib/faturamento/cobrancasTestesAplis.ts.
//
// São poucas dezenas de linhas e mudam raramente: uma ida ao servidor por
// carregamento da página, compartilhada entre a tabela e o formulário. Falha
// não fica no cache, para a próxima abertura tentar de novo.

interface RespostaCobrancasTestes {
  success?: boolean;
  error?: string;
  cobrancas?: CobrancaAplis[];
}

let cache: Promise<CobrancaAplis[]> | null = null;

const buscarCobrancasTestesAplis = (): Promise<CobrancaAplis[]> => {
  cache ??= chamarLegadoApi<RespostaCobrancasTestes>(
    'aplis-cobrancas-testes',
    new URLSearchParams(),
    'Não foi possível carregar as cobranças do apLIS.'
  )
    .then(body => body.cobrancas ?? [])
    .catch(err => {
      cache = null;
      throw err;
    });
  return cache;
};

export const useCobrancasTestesAplis = (ativo = true) => {
  const [cobrancas, setCobrancas] = useState<CobrancaAplis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ativo) return;
    let cancelado = false;
    setLoading(true);
    buscarCobrancasTestesAplis()
      .then(lista => {
        if (cancelado) return;
        setCobrancas(lista);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        setError(err instanceof Error ? err.message : 'Não foi possível carregar as cobranças do apLIS.');
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [ativo]);

  return { cobrancas, loading, error };
};
