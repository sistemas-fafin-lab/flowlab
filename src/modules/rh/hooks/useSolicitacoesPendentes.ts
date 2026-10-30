import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

/**
 * Ids dos colaboradores com solicitação de alteração pendente (badge da lista).
 * Consulta à parte em vez de embed em useColaboradores, que também serve
 * telas sem acesso às solicitações (holerites).
 */
export function useSolicitacoesPendentes(): { pendentes: Set<string>; refetch: () => Promise<void> } {
  const [pendentes, setPendentes] = useState<Set<string>>(new Set());

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('colaborador_solicitacoes_alteracao')
      .select('colaborador_id')
      .eq('status', 'pendente');
    if (error) {
      // O badge é só um indicador: sem ele a lista continua funcionando.
      console.error('Erro ao carregar solicitações pendentes:', error);
      return;
    }
    setPendentes(new Set((data ?? []).map((r) => r.colaborador_id as string)));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { pendentes, refetch: carregar };
}
