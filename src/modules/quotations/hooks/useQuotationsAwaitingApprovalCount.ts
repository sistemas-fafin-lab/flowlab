import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { countQuotationsAwaitingMyApproval } from '../utils/countQuotationsAwaitingMyApproval';

interface ApprovalConfig {
  maxAmount: number;
  canApprove: boolean;
}

interface UseQuotationsAwaitingApprovalCountResult {
  count: number;
  canApprove: boolean;
  loading: boolean;
}

// Versão enxuta de fetchUserApprovalLimit em useQuotation.ts: lê a view (que já
// resolve limite customizado ou por nível). Sem registro, não aprova — a regra de
// get_user_approval_limit desde 20261015180000 (o padrão por role legado saiu).
const fetchApprovalConfig = async (userId: string): Promise<ApprovalConfig> => {
  const { data } = await supabase
    .from('user_approval_limits_with_details')
    .select('effective_max_amount, can_approve')
    .eq('user_id', userId)
    .maybeSingle();

  if (data && data.effective_max_amount !== null && data.can_approve !== null) {
    return {
      maxAmount: data.effective_max_amount >= 999999999 ? Infinity : data.effective_max_amount,
      canApprove: data.can_approve,
    };
  }

  return { maxAmount: 0, canApprove: false };
};

/**
 * Conta quantas cotações "awaiting_approval" o usuário logado tem alçada
 * para aprovar — mesmo critério de valor de getPermissions().canApprove
 * (useQuotation.ts). `enabled` evita a consulta para quem não tem acesso ao
 * módulo de cotações.
 */
export const useQuotationsAwaitingApprovalCount = (
  enabled: boolean,
): UseQuotationsAwaitingApprovalCountResult => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [canApprove, setCanApprove] = useState(false);
  const [loading, setLoading] = useState(true);

  const userId = user?.id;

  const run = useCallback(async () => {
    if (!enabled || !userId) {
      setCanApprove(false);
      setCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const config = await fetchApprovalConfig(userId);

      if (!config.canApprove) {
        setCanApprove(false);
        setCount(0);
        return;
      }

      const { data: rows } = await supabase
        .from('quotations')
        .select('selected_price, final_total_amount, estimated_total')
        .eq('status', 'awaiting_approval');

      setCanApprove(true);
      setCount(countQuotationsAwaitingMyApproval(rows || [], config.maxAmount));
    } catch (error) {
      console.error('Error fetching quotations awaiting approval count:', error);
      setCanApprove(false);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [enabled, userId]);

  useEffect(() => {
    run();
  }, [run]);

  return { count, canApprove, loading };
};
