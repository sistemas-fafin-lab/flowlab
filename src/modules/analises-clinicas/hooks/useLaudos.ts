import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { AcLaudo, LaudoStatus, AcAgendamento } from '../types';

// Campos editáveis de um laudo existente.
export interface LaudoPatch {
  status?: LaudoStatus;
  examesConcluidos?: number;
  examesTotal?: number;
  nota?: string | null;
}

// Input para criação de um laudo vinculado a agendamento.
export interface LaudoCreateInput {
  agendamentoId: string;
  examesTotal?: number; // se omitido, tenta contar ac_agendamento_exames
  nota?: string | null;
}

interface UseLaudosResult {
  laudos: AcLaudo[];
  agendamentos: AcAgendamento[]; // snapshots dos agendamentos vinculados
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createLaudo: (input: LaudoCreateInput, criadoPor: string) => Promise<string | null>;
  updateLaudo: (id: string, patch: LaudoPatch) => Promise<string | null>;
  deleteLaudo: (id: string) => Promise<string | null>;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v));

const mapLaudo = (r: Record<string, unknown>): AcLaudo => ({
  id: r.id as string,
  agendamento_id: r.agendamento_id as string,
  status: r.status as LaudoStatus,
  exames_concluidos: num(r.exames_concluidos),
  exames_total: num(r.exames_total),
  nota: (r.nota as string) ?? null,
  criado_por: r.criado_por as string,
  criado_em: r.criado_em as string,
  atualizado_em: r.atualizado_em as string,
  liberado_em: (r.liberado_em as string) ?? null,
});

const mapAgendamento = (r: Record<string, unknown>): AcAgendamento => ({
  id: r.id as string,
  labhub_id: r.labhub_id as string,
  paciente_nome: r.paciente_nome as string,
  paciente_telefone: (r.paciente_telefone as string) ?? null,
  posto_id: (r.posto_id as string) ?? null,
  local_posto: r.local_posto as string,
  data_hora: r.data_hora as string,
  status: r.status as string,
  recebido_em: r.recebido_em as string,
  updated_at: r.updated_at as string,
});

// Acompanhamento manual de laudos (ac_laudos, Fase 8).
// RLS permissiva por authenticated; o gate é o frontend + a permissão.
export function useLaudos(): UseLaudosResult {
  const [laudos, setLaudos] = useState<AcLaudo[]>([]);
  const [agendamentos, setAgendamentos] = useState<AcAgendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: lRows, error: lErr } = await supabase
      .from('ac_laudos')
      .select('*')
      .order('criado_em', { ascending: false });

    if (lErr) {
      setError(lErr.message);
      setLaudos([]);
      setAgendamentos([]);
      setLoading(false);
      return;
    }

    const parsedLaudos = (lRows ?? []).map(mapLaudo);
    setLaudos(parsedLaudos);

    // Carrega os agendamentos vinculados para exibir snapshots.
    if (parsedLaudos.length > 0) {
      const agIds = parsedLaudos.map((l) => l.agendamento_id);
      const { data: aRows, error: aErr } = await supabase
        .from('ac_agendamentos')
        .select('*')
        .in('id', agIds);
      if (aErr && !lErr) setError(aErr.message);
      setAgendamentos((aRows ?? []).map(mapAgendamento));
    } else {
      setAgendamentos([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createLaudo: UseLaudosResult['createLaudo'] = useCallback(
    async (input, criadoPor) => {
      if (!input.agendamentoId) return 'Informe o agendamento.';

      let total = input.examesTotal;
      if (total === undefined) {
        // Tenta contar exames marcados no check-in.
        const { count } = await supabase
          .from('ac_agendamento_exames')
          .select('*', { count: 'exact', head: true })
          .eq('agendamento_id', input.agendamentoId);
        total = count ?? 0;
      }

      const row: Record<string, unknown> = {
        agendamento_id: input.agendamentoId,
        exames_total: total ?? 0,
        nota: input.nota?.trim() || null,
        criado_por: criadoPor,
      };

      const { error: err } = await supabase.from('ac_laudos').insert(row);
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  const updateLaudo: UseLaudosResult['updateLaudo'] = useCallback(
    async (id, patch) => {
      const row: Record<string, unknown> = {};
      if (patch.status !== undefined) {
        row.status = patch.status;
        if (patch.status === 'laudo_completo_liberado') {
          row.liberado_em = new Date().toISOString();
        }
      }
      if (patch.examesConcluidos !== undefined) row.exames_concluidos = patch.examesConcluidos;
      if (patch.examesTotal !== undefined) row.exames_total = patch.examesTotal;
      if (patch.nota !== undefined) row.nota = patch.nota || null;

      const { error: err } = await supabase.from('ac_laudos').update(row).eq('id', id);
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  const deleteLaudo: UseLaudosResult['deleteLaudo'] = useCallback(
    async (id) => {
      const { error: err } = await supabase.from('ac_laudos').delete().eq('id', id);
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  return { laudos, agendamentos, loading, error, refetch, createLaudo, updateLaudo, deleteLaudo };
}
