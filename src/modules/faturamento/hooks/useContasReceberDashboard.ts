import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { DashboardReceber, DashboardReceberFiltros } from '../../billing/types';

// Uma chamada só a `fat_dashboard_receber`, no molde de useITProjectDashboard.
//
// A agregação fica no banco porque o aging tem que varrer TODOS os títulos em
// aberto, inclusive os emitidos fora do período filtrado — um título vencido há
// seis meses é justamente o que mais importa ver. Fazer isso no cliente
// significaria baixar a base inteira de títulos a cada abertura da tela.

const VAZIO: DashboardReceber = {
  kpis: {
    faturado: 0,
    recebido: 0,
    glosado: 0,
    acatado: 0,
    qtdTitulos: 0,
    prazoPrevistoDias: null,
    prazoMedioDias: null,
    prazoPonderadoDias: null,
    prazoBaseTitulos: 0,
  },
  aging: { a_vencer: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_mais: 0 },
  porOperadora: [],
  previsaoOperadoras: [],
  serieMensal: [],
  porMotivo: [],
};

/** Separador das listas nas deps do efeito. Caractere de controle porque código
 *  de lote e número de nota podem conter vírgula, hífen e barra. */
const SEP = '\u0001';

interface UseContasReceberDashboardResult {
  data: DashboardReceber;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useContasReceberDashboard(
  filtros: DashboardReceberFiltros,
): UseContasReceberDashboardResult {
  const [data, setData] = useState<DashboardReceber>(VAZIO);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // As listas viram string nas deps: com o array cru, um novo literal a cada
  // render do pai refetcharia em loop mesmo sem nada ter mudado.
  const { desde, ate } = filtros;
  const operadoras = filtros.operadoraIds.join(SEP);
  const lotes = filtros.lotes.join(SEP);
  const notas = filtros.notas.join(SEP);

  const buscaAtual = useRef(0);

  const refetch = useCallback(async () => {
    const reqId = ++buscaAtual.current;
    setLoading(true);
    setError(null);
    try {
      // Lista vazia e não NULL: a RPC trata as duas igual, e mandar o array
      // sempre evita depender dos defaults da assinatura.
      const emLista = (bruto: string): string[] => (bruto === '' ? [] : bruto.split(SEP));
      const { data: bruto, error: erro } = await supabase.rpc('fat_dashboard_receber', {
        p_desde: desde,
        p_ate: ate,
        p_operadoras: emLista(operadoras),
        p_lotes: emLista(lotes),
        p_notas: emLista(notas),
      });
      if (reqId !== buscaAtual.current) return;
      if (erro) throw new Error(erro.message);
      // Mesclado com VAZIO, e não usado cru: num ambiente com a versão anterior
      // da RPC as chaves de prazo/previsão simplesmente não vêm, e um `.map` em
      // undefined derrubaria a tela inteira em vez de mostrar "—".
      const recebido = bruto as DashboardReceber | null;
      setData(recebido
        ? { ...VAZIO, ...recebido, kpis: { ...VAZIO.kpis, ...recebido.kpis } }
        : VAZIO);
    } catch (err) {
      if (reqId !== buscaAtual.current) return;
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os indicadores.');
      setData(VAZIO);
    } finally {
      if (reqId === buscaAtual.current) setLoading(false);
    }
  }, [desde, ate, operadoras, lotes, notas]);

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [refetch]);

  return { data, loading, error, refetch };
}
