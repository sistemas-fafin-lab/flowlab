import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { PaymentAuthorizer } from '../../../types';

/**
 * Opções de "Autorizado por" no pedido de pagamento: pessoas ativas cujo cargo tem
 * canAuthorizePayments. Vem da função payment_request_autorizadores, a mesma regra que o
 * trigger payment_request_guard confere ao gravar.
 */
export function usePaymentAuthorizers() {
  const [authorizers, setAuthorizers] = useState<PaymentAuthorizer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('payment_request_autorizadores');
        if (rpcError) throw rpcError;
        if (!cancelled) setAuthorizers((data as PaymentAuthorizer[] | null) ?? []);
      } catch (err) {
        console.error('Erro ao carregar autorizadores de pagamento:', err);
        if (!cancelled) setError('Não foi possível carregar quem pode autorizar pagamentos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { authorizers, loading, error };
}
