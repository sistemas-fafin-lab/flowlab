import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { resolveRequesterManagerChoice, RequesterManagerChoice, RequesterManagerSource } from '../utils/resolveRequesterManagerChoice';
import type { Quotation } from '../types';

type QuotationOrigin = Pick<Quotation, 'quotationType' | 'requestId' | 'maintenanceRequestId' | 'requesterManagerId' | 'createdBy'>;

/** Origem da cotação: quem aprovou a SC (Compras) ou quem abriu a solicitação de manutenção (Contratação). */
async function fetchRequesterManagerSource(origin: QuotationOrigin): Promise<RequesterManagerSource> {
  if (origin.quotationType === 'contratacao') {
    if (!origin.maintenanceRequestId) return {};
    const { data } = await supabase
      .from('maintenance_requests')
      .select('requester_id')
      .eq('id', origin.maintenanceRequestId)
      .maybeSingle();
    return { maintenanceRequesterId: data?.requester_id ?? null };
  }
  if (!origin.requestId) return {};
  const { data } = await supabase
    .from('requests')
    .select('approved_by_user_id, decided_without_approver')
    .eq('id', origin.requestId)
    .maybeSingle();
  return {
    requestApprovedByUserId: data?.approved_by_user_id ?? null,
    requestDecidedWithoutApprover: data?.decided_without_approver ?? false,
  };
}

const EMPTY_CHOICE: RequesterManagerChoice = { lockedManagerId: null, suggestedId: null, eligibleUsers: [] };

/**
 * Opções do campo "Gestor do pedido" segundo resolveRequesterManagerChoice:
 * o gestor travado pela origem, ou os usuários ativos que podem ser escolhidos.
 */
export function useRequesterManagerOptions(origin: QuotationOrigin) {
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const [choice, setChoice] = useState<RequesterManagerChoice>(EMPTY_CHOICE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { quotationType, requestId, maintenanceRequestId, requesterManagerId, createdBy } = origin;

  // Dependências primitivas: um refetch da lista de cotações gera um objeto
  // novo e não pode recarregar (nem sobrescrever a escolha do comprador).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const current = { quotationType, requestId, maintenanceRequestId, requesterManagerId, createdBy };
        const [{ data: profiles, error: profilesError }, source] = await Promise.all([
          supabase
            .from('user_profiles')
            .select('id, name')
            .eq('is_active', true)
            .is('disabled_at', null)
            .order('name', { ascending: true }),
          fetchRequesterManagerSource(current),
        ]);
        if (profilesError) throw profilesError;
        if (cancelled) return;
        setChoice(resolveRequesterManagerChoice({
          quotation: current,
          source,
          activeUsers: profiles ?? [],
          currentUserId,
        }));
      } catch (err) {
        console.error('Erro ao carregar usuários para gestor do pedido:', err);
        if (!cancelled) setError('Não foi possível carregar a lista de usuários.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [quotationType, requestId, maintenanceRequestId, requesterManagerId, createdBy, currentUserId]);

  return { ...choice, loading, error };
}
