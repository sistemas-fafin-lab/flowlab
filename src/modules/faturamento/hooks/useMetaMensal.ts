import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { anoMesAtual } from '../utils/formato';
import type { MetaMensal } from '../types';

// Meta mensal de faturamento (issue 43): mês/ano travados no que "hoje" é
// quando o hook monta — não há tela de histórico de metas nesta entrega
// (decisão assumida do spec), então o valor não precisa ser parametrizável.
//
// Duas fontes combinadas numa chamada só: o valor da meta (linha própria de
// `metas_faturamento`, pode não existir) e o faturado do mês restrito à
// whitelist (`fat_meta_mensal_faturado`, mesmo raciocínio de
// fat_dashboard_receber mas com o range travado no mês calendário da meta).

const competenciaDe = (ano: number, mes: number): string => `${ano}-${String(mes).padStart(2, '0')}`;

const vazia = (ano: number, mes: number): MetaMensal => ({
  ano,
  mes,
  competencia: competenciaDe(ano, mes),
  valorMeta: null,
  faturado: 0,
  quantoFalta: 0,
  metaBatida: false,
  qtdTitulos: 0,
});

interface UseMetaMensalResult {
  meta: MetaMensal;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Cadastra/atualiza a meta do mês corrente (upsert em `ano`/`mes`). */
  salvarMeta: (valor: number) => Promise<string | null>;
}

export function useMetaMensal(): UseMetaMensalResult {
  const [{ ano, mes }] = useState(anoMesAtual);
  const [meta, setMeta] = useState<MetaMensal>(() => vazia(ano, mes));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buscaAtual = useRef(0);

  const refetch = useCallback(async () => {
    const reqId = ++buscaAtual.current;
    setLoading(true);
    setError(null);
    try {
      const [{ data: linhaMeta, error: erroMeta }, { data: bruto, error: erroCalculo }] = await Promise.all([
        supabase.from('metas_faturamento').select('valor_meta').eq('ano', ano).eq('mes', mes).maybeSingle(),
        supabase.rpc('fat_meta_mensal_faturado', { p_ano: ano, p_mes: mes }),
      ]);
      if (reqId !== buscaAtual.current) return;
      if (erroMeta) throw new Error(erroMeta.message);
      if (erroCalculo) throw new Error(erroCalculo.message);

      const valorMeta = linhaMeta ? Number((linhaMeta as { valor_meta: number | string }).valor_meta) : null;
      const resultado = bruto as { faturado: number | string; qtdTitulos: number } | null;
      const faturado = Number(resultado?.faturado ?? 0);
      const qtdTitulos = Number(resultado?.qtdTitulos ?? 0);

      setMeta({
        ano,
        mes,
        competencia: competenciaDe(ano, mes),
        valorMeta,
        faturado,
        quantoFalta: valorMeta !== null ? Math.max(valorMeta - faturado, 0) : 0,
        metaBatida: valorMeta !== null && faturado >= valorMeta,
        qtdTitulos,
      });
    } catch (err) {
      if (reqId !== buscaAtual.current) return;
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a meta mensal.');
      setMeta(vazia(ano, mes));
    } finally {
      if (reqId === buscaAtual.current) setLoading(false);
    }
  }, [ano, mes]);

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [refetch]);

  // Upsert direto, sem RPC: uma linha só, sem invariante cruzando outra
  // tabela — mesmo raciocínio de marcarConsideradaMeta em useContasReceber.
  // RLS (`metas_faturamento_insert_billing`/`_update_billing`) já é o gate;
  // o front só repete o gate (podeEditar) pra esconder o controle.
  const salvarMeta = useCallback(async (valor: number): Promise<string | null> => {
    try {
      const { error: erro } = await supabase
        .from('metas_faturamento')
        .upsert({ ano, mes, valor_meta: valor }, { onConflict: 'ano,mes' });
      if (erro) throw new Error(erro.message);
      await refetch();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Não foi possível salvar a meta.';
    }
  }, [ano, mes, refetch]);

  return { meta, loading, error, refetch, salvarMeta };
}
