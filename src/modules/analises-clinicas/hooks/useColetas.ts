import { useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import type { AcCheckin, CheckinResultado, ChecklistItemKey } from '../types';

interface UseColetasResult {
  // Conferência de recepção (gate). Retorna a mensagem de erro, ou null em sucesso.
  registrarCheckin: (
    agendamentoId: string,
    conferidoPor: string,
    resultado: CheckinResultado,
    problemaEm: ChecklistItemKey | null,
    motivo: string | null,
  ) => Promise<string | null>;
  // Recebimento (Fase 7A): exames do pedido + validade + etiqueta. Insumo saiu do
  // check-in (a capacidade segue na RPC). Retorna a mensagem de erro, ou null.
  registrarColeta: (
    agendamentoId: string,
    coletadoPor: string,
    observacoes: string,
    exameIds: string[],
    validadeOk: boolean | null,
    etiquetado: boolean | null,
  ) => Promise<string | null>;
  // Conferências dos agendamentos informados (p/ exibir o motivo dos bloqueados).
  fetchCheckins: (agendamentoIds: string[]) => Promise<AcCheckin[]>;
  // Cancelamento lógico (status='cancelado'): libera o horário; não avisa o
  // LAB-HUB. A RPC recusa 'coletado' e já-cancelado. Retorna o erro, ou null.
  cancelarAgendamento: (
    agendamentoId: string,
    canceladoPor: string,
    motivo: string | null,
  ) => Promise<string | null>;
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
    async (agendamentoId, coletadoPor, observacoes, exameIds, validadeOk, etiquetado) => {
      const { error } = await supabase.rpc('registrar_coleta', {
        p_agendamento_id: agendamentoId,
        p_coletado_por: coletadoPor,
        p_observacoes: observacoes,
        p_exame_ids: exameIds,
        p_validade_ok: validadeOk,
        p_etiquetado: etiquetado,
        p_insumos: [], // baixa de insumo saiu do check-in (capacidade preservada na RPC)
      });
      return error ? error.message : null;
    },
    [],
  );

  const cancelarAgendamento = useCallback<UseColetasResult['cancelarAgendamento']>(
    async (agendamentoId, canceladoPor, motivo) => {
      const { error } = await supabase.rpc('cancelar_agendamento', {
        p_agendamento_id: agendamentoId,
        p_cancelado_por: canceladoPor,
        p_motivo: motivo,
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

  return { registrarCheckin, registrarColeta, fetchCheckins, cancelarAgendamento };
}
