import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { AcAgendamento } from '../types';

export interface AgendamentosFiltros {
  postoId?: string; // ac_postos.id
  data?: string; // YYYY-MM-DD (filtra pelo dia local)
}

interface UseAgendamentosResult {
  agendamentos: AcAgendamento[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Lista os agendamentos recebidos do LAB-HUB (tabela ac_agendamentos).
// Leitura direta via supabase-js: a RLS já libera SELECT p/ usuários autenticados.
export function useAgendamentos(filtros: AgendamentosFiltros): UseAgendamentosResult {
  const [agendamentos, setAgendamentos] = useState<AcAgendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { postoId, data } = filtros;

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('ac_agendamentos')
      .select('*')
      .order('data_hora', { ascending: true });

    if (postoId) query = query.eq('posto_id', postoId);
    if (data) {
      // Janela do dia escolhido (horário local do navegador → ISO p/ comparar timestamptz).
      const inicio = new Date(`${data}T00:00:00`);
      const fim = new Date(`${data}T23:59:59.999`);
      query = query.gte('data_hora', inicio.toISOString()).lte('data_hora', fim.toISOString());
    }

    const { data: rows, error: err } = await query;
    if (err) {
      setError(err.message);
      setAgendamentos([]);
    } else {
      setAgendamentos((rows ?? []) as AcAgendamento[]);
    }
    setLoading(false);
  }, [postoId, data]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { agendamentos, loading, error, refetch };
}
