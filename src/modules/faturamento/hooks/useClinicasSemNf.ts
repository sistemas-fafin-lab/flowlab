import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { ClinicaSemNf, LocalOrigemBusca } from '../types';
import { chamarLegadoApi } from './legado/api';

// Lista de locais de origem que não emitem NF (tabela clinicas_sem_nf,
// migration 20261019170000), editada pelo modal "Clínicas sem NF" da aba
// Pendências → Particulares. Leitura e escrita vão direto no Supabase com o
// cliente da sessão: a RLS é o gate (leitura canViewBilling/canManageBilling,
// escrita só canManageBilling). A busca de locais lê o apLIS pela rota
// /api/faturamento/locais-origem.

interface RespostaLocaisOrigem {
  success?: boolean;
  error?: string;
  locais?: LocalOrigemBusca[];
}

interface LinhaClinicaSemNf {
  aplis_id: number;
  nome: string;
  marcado_em: string;
}

export async function buscarLocaisOrigem(termo: string): Promise<LocalOrigemBusca[]> {
  const body = await chamarLegadoApi<RespostaLocaisOrigem>(
    'locais-origem',
    new URLSearchParams({ busca: termo }),
    'Não foi possível buscar os locais de origem no apLIS.',
  );
  return body.locais ?? [];
}

interface UseClinicasSemNfResult {
  clinicas: ClinicaSemNf[];
  loading: boolean;
  error: string | null;
  /** Devolve a mensagem de erro, ou null quando gravou. */
  adicionar: (local: { id: number; nome: string }) => Promise<string | null>;
  remover: (aplisId: number) => Promise<string | null>;
}

export function useClinicasSemNf(ativo: boolean): UseClinicasSemNfResult {
  const [clinicas, setClinicas] = useState<ClinicaSemNf[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: erro } = await supabase
      .from('clinicas_sem_nf')
      .select('aplis_id, nome, marcado_em')
      .order('nome');
    if (erro) {
      setError(erro.message);
      setClinicas([]);
    } else {
      setClinicas(((data ?? []) as LinhaClinicaSemNf[]).map((linha) => ({
        aplisId: linha.aplis_id,
        nome: linha.nome,
        marcadoEm: linha.marcado_em,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (ativo) void refetch();
  }, [ativo, refetch]);

  const adicionar = useCallback(async (local: { id: number; nome: string }): Promise<string | null> => {
    // upsert ignorando duplicata: dois cliques (ou duas abas) não viram erro de PK.
    const { error: erro } = await supabase
      .from('clinicas_sem_nf')
      .upsert({ aplis_id: local.id, nome: local.nome }, { onConflict: 'aplis_id', ignoreDuplicates: true });
    if (erro) return erro.message;
    await refetch();
    return null;
  }, [refetch]);

  const remover = useCallback(async (aplisId: number): Promise<string | null> => {
    // `select` devolve as linhas apagadas: sem permissão, a RLS não dá erro,
    // só apaga zero linhas, e isso precisa aparecer como falha.
    const { data, error: erro } = await supabase
      .from('clinicas_sem_nf')
      .delete()
      .eq('aplis_id', aplisId)
      .select('aplis_id');
    if (erro) return erro.message;
    if (!data || data.length === 0) return 'Não foi possível remover: sem permissão ou a clínica já tinha sido removida.';
    await refetch();
    return null;
  }, [refetch]);

  return { clinicas, loading, error, adicionar, remover };
}
