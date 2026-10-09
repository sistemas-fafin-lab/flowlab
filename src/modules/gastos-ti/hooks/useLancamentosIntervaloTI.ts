import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Lancamento } from '../types';
import { mapLancamento, type LancamentoRow } from './useLancamentosTI';

const TAMANHO_PAGINA = 1000;

/**
 * Lançamentos de um intervalo de competências, só leitura (dashboard). Filtra
 * no servidor (RNF03) e, ao trocar o intervalo, mantém os dados anteriores
 * até chegarem os novos — a tela esmaece em vez de piscar.
 */
export function useLancamentosIntervaloTI(desde: string, ate: string) {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const buscar = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    // PostgREST devolve no máximo 1000 linhas por chamada: o dashboard carrega
    // ~3 anos de competências (visão diluída), então pagina — uma query nova
    // por página (o builder não refaz os filtros) e ordem estável, para nenhuma
    // linha se repetir ou sumir entre páginas.
    const linhas: LancamentoRow[] = [];
    for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
      const { data, error: erro } = await supabase
        .from('ti_lancamentos')
        .select('*')
        .gte('competencia', desde)
        .lte('competencia', ate)
        .order('competencia')
        .order('id')
        .range(inicio, inicio + TAMANHO_PAGINA - 1);
      if (requestIdRef.current !== requestId) return;
      if (erro) {
        console.error('Erro ao carregar lançamentos do dashboard:', erro);
        setError(erro.message || 'Não foi possível carregar os pagamentos.');
        setLoading(false);
        return;
      }
      const pagina = (data as LancamentoRow[] | null) ?? [];
      linhas.push(...pagina);
      if (pagina.length < TAMANHO_PAGINA) break;
    }
    setLancamentos(linhas.map(mapLancamento));
    setLoading(false);
  }, [desde, ate]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  return { lancamentos, loading, error, recarregar: buscar };
}
