import { useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import type { AcCheckin, CheckinResultado, ChecklistItemKey, InsumoInput } from '../types';

interface UseColetasResult {
  // Conferência de recepção (gate). Retorna a mensagem de erro, ou null em sucesso.
  registrarCheckin: (
    agendamentoId: string,
    conferidoPor: string,
    resultado: CheckinResultado,
    problemaEm: ChecklistItemKey | null,
    motivo: string | null,
  ) => Promise<string | null>;
  // Coleta + baixa de insumos. Retorna a mensagem de erro, ou null em sucesso.
  registrarColeta: (
    agendamentoId: string,
    coletadoPor: string,
    observacoes: string,
    insumos: InsumoInput[],
  ) => Promise<string | null>;
  // Conferências dos agendamentos informados (p/ exibir o motivo dos bloqueados).
  fetchCheckins: (agendamentoIds: string[]) => Promise<AcCheckin[]>;
}

// Fluxo de coleta (Fase 6). As mutações rodam nas RPCs transacionais
// registrar_checkin / registrar_coleta (§5 do plano); a RLS libera authenticated.
export function useColetas(): UseColetasResult {
  const registrarCheckin = useCallback<UseColetasResult['registrarCheckin']>(
    async (agendamentoId, conferidoPor, resultado, problemaEm, motivo) => {
      const { error } = await supabase.rpc('registrar_checkin', {
        p_agendamento_id: agendamentoId,
        p_conferido_por: conferidoPor,
        p_resultado: resultado,
        p_problema_em: resultado === 'problema' ? problemaEm : null,
        p_problema_motivo: resultado === 'problema' ? motivo : null,
      });
      return error ? error.message : null;
    },
    [],
  );

  const registrarColeta = useCallback<UseColetasResult['registrarColeta']>(
    async (agendamentoId, coletadoPor, observacoes, insumos) => {
      const { error } = await supabase.rpc('registrar_coleta', {
        p_agendamento_id: agendamentoId,
        p_coletado_por: coletadoPor,
        p_observacoes: observacoes,
        p_insumos: insumos.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
      });
      return error ? error.message : null;
    },
    [],
  );

  const fetchCheckins = useCallback<UseColetasResult['fetchCheckins']>(async (agendamentoIds) => {
    if (agendamentoIds.length === 0) return [];
    const { data, error } = await supabase
      .from('ac_checkins')
      .select('*')
      .in('agendamento_id', agendamentoIds);
    if (error) throw error;
    return (data ?? []) as AcCheckin[];
  }, []);

  return { registrarCheckin, registrarColeta, fetchCheckins };
}
