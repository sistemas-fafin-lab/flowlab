import { useEffect, useState } from 'react';
import type { EventoFaturamento } from '../types';
import { chamarLegadoApi } from './legado/api';

// Opções do filtro "Status Faturamento" (tabela `eventofatur` do apLIS), pela rota
// /api/faturamento/status-faturamento. Compartilhado pelas abas Faturas e
// Pendências.
//
// Cache de sessão (module-level) com a promessa em voo: a lista é pequena e quase
// nunca muda, então as duas abas (e remontagens) reaproveitam uma única busca.
// Falha não fica cacheada — a próxima montagem tenta de novo.

interface RespostaStatus {
  success?: boolean;
  error?: string;
  status?: EventoFaturamento[];
}

let emVoo: Promise<EventoFaturamento[]> | null = null;

function buscarStatus(): Promise<EventoFaturamento[]> {
  if (!emVoo) {
    emVoo = chamarLegadoApi<RespostaStatus>(
      'status-faturamento',
      new URLSearchParams(),
      'Não foi possível carregar os status de faturamento.',
    )
      .then((body) => body.status ?? [])
      .catch((err) => {
        emVoo = null;
        throw err;
      });
  }
  return emVoo;
}

interface UseStatusFaturamentoResult {
  /** Todos os status, inclusive inativos (para rotular dado antigo). */
  status: EventoFaturamento[];
  /** Só os ativos — o que o <select> do apLIS oferece. */
  ativos: EventoFaturamento[];
  error: string | null;
}

export function useStatusFaturamento(): UseStatusFaturamentoResult {
  const [status, setStatus] = useState<EventoFaturamento[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    buscarStatus()
      .then((lista) => {
        if (ativo) setStatus(lista);
      })
      .catch((err) => {
        if (ativo) setError(err instanceof Error ? err.message : 'Não foi possível carregar os status de faturamento.');
      });
    return () => {
      ativo = false;
    };
  }, []);

  return { status, ativos: status.filter((s) => !s.inativo), error };
}
