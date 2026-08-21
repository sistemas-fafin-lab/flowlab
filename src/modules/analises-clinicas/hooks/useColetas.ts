import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { AcCheckin, AcColeta, CheckinResultado, ChecklistItemKey } from '../types';

// Coleta (1:1) do agendamento, ou null quando ainda não registrada. Leitura
// direta — a RLS libera SELECT p/ usuários autenticados. Lança o erro do
// supabase em falha (o chamador decide como tratar).
export async function buscarColeta(agendamentoId: string): Promise<AcColeta | null> {
  const { data, error } = await supabase
    .from('ac_coletas')
    .select('*')
    .eq('agendamento_id', agendamentoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as AcColeta | null;
}

interface UseColetaResult {
  coleta: AcColeta | null;
  loading: boolean;
  error: string | null;
}

// Estado da coleta (1:1) de um agendamento — o que o detalhe exibe quando o
// status é 'coletado'. Recarrega quando o agendamento muda.
export function useColeta(agendamentoId: string): UseColetaResult {
  const [coleta, setColeta] = useState<AcColeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setError(null);
    setColeta(null);
    buscarColeta(agendamentoId)
      .then((c) => {
        if (ativo) setColeta(c);
      })
      .catch((e: unknown) => {
        if (ativo) setError(e instanceof Error ? e.message : 'Falha ao carregar a coleta.');
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });
    return () => {
      ativo = false;
    };
  }, [agendamentoId]);

  return { coleta, loading, error };
}

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
  // Edição local (posto/data-hora/telefone): não avisa o LAB-HUB. A RPC só
  // aceita agendamento 'recebido' e recusa horário já ocupado por outro
  // agendamento ativo. Retorna a mensagem de erro, ou null em sucesso.
  editarAgendamento: (
    agendamentoId: string,
    dados: { dataHora: string; postoId: string; telefone: string | null },
    editadoPor: string,
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

  const editarAgendamento = useCallback<UseColetasResult['editarAgendamento']>(
    async (agendamentoId, dados, editadoPor) => {
      const { error } = await supabase.rpc('editar_agendamento', {
        p_agendamento_id: agendamentoId,
        p_data_hora: dados.dataHora,
        p_posto_id: dados.postoId,
        p_telefone: dados.telefone,
        p_editado_por: editadoPor,
      });
      return error ? error.message : null;
    },
    [],
  );

  return { registrarCheckin, registrarColeta, fetchCheckins, cancelarAgendamento, editarAgendamento };
}
