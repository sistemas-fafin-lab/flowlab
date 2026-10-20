import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

/**
 * Conta as SCs pendentes em que o usuário logado é o aprovador — mesmo recorte
 * do filtro "Aguardando minha aprovação" da tela de Solicitações. Roda para
 * qualquer usuário logado: ser aprovador não depende de permissão de cargo.
 */
export const useScsAwaitingMyApprovalCount = (): number => {
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
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'SC')
      .eq('status', 'pending')
      .eq('approver_id', userId)
      .then(({ count: total, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Error fetching SCs awaiting my approval count:', error);
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
