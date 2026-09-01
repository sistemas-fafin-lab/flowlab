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

// Versão enxuta do fallback de fetchUserApprovalLimit em useQuotation.ts:
// tenta a view (que já resolve limite customizado ou por nível) e, sem
// registro, cai direto para o padrão por role — sem o tier intermediário de
// consultar user_approval_limits + approval_level_config em separado, que só
// importa se a própria view falhar (caso raro de RLS/permissão na view).
const fetchApprovalConfig = async (
  userId: string,
  role: string | undefined,
): Promise<ApprovalConfig> => {
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

  const effectiveRole = role || 'requester';
  return {
    maxAmount: effectiveRole === 'admin' ? Infinity : effectiveRole === 'operator' ? 5000 : 0,
    canApprove: effectiveRole === 'admin' || effectiveRole === 'operator',
  };
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
  const { user, userProfile } = useAuth();
  const [count, setCount] = useState(0);
  const [canApprove, setCanApprove] = useState(false);
  const [loading, setLoading] = useState(true);

  const userId = user?.id;
  const role = userProfile?.role;

  const run = useCallback(async () => {
    if (!enabled || !userId) {
      setCanApprove(false);
      setCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const config = await fetchApprovalConfig(userId, role);

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
  }, [enabled, userId, role]);

  useEffect(() => {
    run();
  }, [run]);

  return { count, canApprove, loading };
};
