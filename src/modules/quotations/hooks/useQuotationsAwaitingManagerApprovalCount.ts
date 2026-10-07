import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';

/**
 * Conta as cotações na etapa do gestor em que o usuário logado é o gestor do
 * pedido — mesmo critério da tela "Minhas aprovações de cotação"
 * (filterQuotationsAwaitingMyManagerApproval). Roda para qualquer usuário
 * logado: o gestor pode não ter acesso ao módulo de Cotações.
 */
export const useQuotationsAwaitingManagerApprovalCount = (): number => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }

    let cancelled = false;
    supabase
      .from('quotations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'awaiting_manager_approval')
      .eq('requester_manager_id', userId)
      .then(({ count: total, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Error fetching quotations awaiting manager approval count:', error);
          setCount(0);
          return;
        }
        setCount(total ?? 0);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return count;
};
