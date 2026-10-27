import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

/** Um gestor que autoriza os pagamentos do departamento de quem pede. */
export interface GestorAutorizador {
  id: string;
  name: string;
}

export interface ContextoPagamento {
  /** Departamento do RH de quem está logado; null = sem departamento no RH. */
  departamentoId: string | null;
  departamento: string | null;
  autorizadores: GestorAutorizador[];
  /** Quem está logado é gestor apto do próprio departamento: o pedido nasce autorizado. */
  souAutorizador: boolean;
}

interface ContextoRow {
  departamento_id: string | null;
  departamento: string | null;
  autorizadores: GestorAutorizador[] | null;
  sou_autorizador: boolean;
}

/**
 * O que o formulário de pedido precisa saber de quem autoriza: o departamento do RH de
 * quem pede e os gestores aptos dele (payment_request_contexto, a mesma regra que o
 * trigger payment_request_guard confere ao gravar).
 */
export function useContextoPagamento() {
  const [contexto, setContexto] = useState<ContextoPagamento | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('payment_request_contexto');
        if (rpcError) throw rpcError;
        const linha = data as ContextoRow | null;
        if (!cancelled) {
          setContexto({
            departamentoId: linha?.departamento_id ?? null,
            departamento: linha?.departamento ?? null,
            autorizadores: linha?.autorizadores ?? [],
            souAutorizador: !!linha?.sou_autorizador,
          });
        }
      } catch (err) {
        console.error('Erro ao carregar quem autoriza os pagamentos:', err);
        if (!cancelled) setError('Não foi possível carregar quem autoriza os pagamentos do seu departamento.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { contexto, loading, error };
}
