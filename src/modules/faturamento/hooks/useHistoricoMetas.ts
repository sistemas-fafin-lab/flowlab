import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { MetaMensal } from '../types';

// Histórico da meta mensal (issue 43): todo mês com meta cadastrada em
// `metas_faturamento`, com o faturado do mês e se a meta foi batida — pela
// MESMA regra do card do mês corrente (useMetaMensal): `fat_meta_mensal_faturado`,
// títulos por vencimento, restritos à whitelist da meta.
//
// O faturado é recalculado ao vivo, não congelado no fechamento do mês: um
// título lançado depois com vencimento num mês passado muda o resultado
// daquele mês — é o mesmo número que "Ver títulos do mês" mostraria hoje.
//
// Uma chamada à RPC por mês, em paralelo: a tabela tem uma linha por mês
// (dezenas, não milhares), e reaproveitar a RPC existente evita uma segunda
// regra de "faturado do mês" para manter em sincronia.

interface LinhaMeta {
  ano: number;
  mes: number;
  valor_meta: number | string;
}

interface UseHistoricoMetasResult {
  historico: MetaMensal[];
  loading: boolean;
  error: string | null;
}

/** @param ativo  Só busca enquanto o modal está aberto. */
export function useHistoricoMetas(ativo: boolean): UseHistoricoMetasResult {
  const [historico, setHistorico] = useState<MetaMensal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ativo) return;
    let cancelado = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: erroMetas } = await supabase
          .from('metas_faturamento')
          .select('ano, mes, valor_meta')
          .order('ano', { ascending: false })
          .order('mes', { ascending: false });
        if (erroMetas) throw new Error(erroMetas.message);

        const linhas = (data ?? []) as LinhaMeta[];
        const calculos = await Promise.all(
          linhas.map((linha) => supabase.rpc('fat_meta_mensal_faturado', { p_ano: linha.ano, p_mes: linha.mes })),
        );
        if (cancelado) return;

        setHistorico(linhas.map((linha, i) => {
          const { data: bruto, error: erroCalculo } = calculos[i];
          if (erroCalculo) throw new Error(erroCalculo.message);
          const resultado = bruto as { faturado: number | string; qtdTitulos: number } | null;
          const valorMeta = Number(linha.valor_meta);
          const faturado = Number(resultado?.faturado ?? 0);
          return {
            ano: linha.ano,
            mes: linha.mes,
            competencia: `${linha.ano}-${String(linha.mes).padStart(2, '0')}`,
            valorMeta,
            faturado,
            quantoFalta: Math.max(valorMeta - faturado, 0),
            metaBatida: faturado >= valorMeta,
            qtdTitulos: Number(resultado?.qtdTitulos ?? 0),
          };
        }));
      } catch (err) {
        if (!cancelado) setError(err instanceof Error ? err.message : 'Não foi possível carregar o histórico de metas.');
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => { cancelado = true; };
  }, [ativo]);

  return { historico, loading, error };
}
