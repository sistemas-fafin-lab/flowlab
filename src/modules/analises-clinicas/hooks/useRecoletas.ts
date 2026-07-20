import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { AcRecoleta, RecoletaMotivo, RecoletaStatus } from '../types';

// Campos editáveis de uma recoleta.
export interface RecoletaPatch {
  status?: RecoletaStatus;
  motivo?: RecoletaMotivo;
  motivoDetalhe?: string | null;
  nota?: string | null;
  prazoDias?: number;
}

// Cadastro de recoleta (registro manual quando o apoio/QC sinaliza amostra inviável).
export interface RecoletaCreateInput {
  motivo: RecoletaMotivo;
  motivoDetalhe?: string | null;
  exameNome?: string | null;
  pacienteNome?: string | null;
  postoId?: string | null;
  localPosto?: string | null;
  nota?: string | null;
  prazoDias?: number;
  solicitadoPor: string;
  // Rastreabilidade opcional (ver ac_recoletas): coleta que falhou + recoleta anterior.
  coletaId?: string | null;
  origemRecoletaId?: string | null;
}

interface UseRecoletasResult {
  recoletas: AcRecoleta[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createRecoleta: (input: RecoletaCreateInput) => Promise<string | null>;
  updateRecoleta: (id: string, patch: RecoletaPatch) => Promise<string | null>;
  deleteRecoleta: (id: string) => Promise<string | null>;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v));

const mapRecoleta = (r: Record<string, unknown>): AcRecoleta => ({
  id: r.id as string,
  agendamento_id: (r.agendamento_id as string) ?? null,
  coleta_id: (r.coleta_id as string) ?? null,
  origem_recoleta_id: (r.origem_recoleta_id as string) ?? null,
  exame_nome: (r.exame_nome as string) ?? null,
  paciente_nome: (r.paciente_nome as string) ?? null,
  posto_id: (r.posto_id as string) ?? null,
  local_posto: (r.local_posto as string) ?? null,
  motivo: r.motivo as RecoletaMotivo,
  motivo_detalhe: (r.motivo_detalhe as string) ?? null,
  status: r.status as RecoletaStatus,
  nota: (r.nota as string) ?? null,
  prazo_dias: num(r.prazo_dias),
  solicitado_por: r.solicitado_por as string,
  solicitada_em: r.solicitada_em as string,
  resolvida_em: (r.resolvida_em as string) ?? null,
  created_at: r.created_at as string,
  updated_at: r.updated_at as string,
});

// Acompanhamento manual de recoletas (ac_recoletas, Fase 6B). RLS permissiva por
// authenticated; o gate é o frontend + a permissão canManageColetas. Registro à mão
// (createRecoleta), atualização de status/motivo/prazo e remoção.
export function useRecoletas(): UseRecoletasResult {
  const [recoletas, setRecoletas] = useState<AcRecoleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('ac_recoletas')
      .select('*')
      .order('solicitada_em', { ascending: false });
    if (err) {
      setError(err.message);
      setRecoletas([]);
    } else {
      setRecoletas((data ?? []).map(mapRecoleta));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createRecoleta: UseRecoletasResult['createRecoleta'] = useCallback(
    async (input) => {
      const solicitadoPor = input.solicitadoPor.trim();
      if (!solicitadoPor) return 'Informe quem está solicitando a recoleta.';

      const row: Record<string, unknown> = {
        agendamento_id: null, // avulsa: sem vínculo com o agendamento original
        coleta_id: input.coletaId ?? null,
        origem_recoleta_id: input.origemRecoletaId ?? null,
        motivo: input.motivo,
        motivo_detalhe: input.motivoDetalhe?.trim() || null,
        exame_nome: input.exameNome?.trim() || null,
        paciente_nome: input.pacienteNome?.trim() || null,
        posto_id: input.postoId ?? null,
        local_posto: input.localPosto?.trim() || null,
        nota: input.nota?.trim() || null,
        solicitado_por: solicitadoPor,
      };
      // status / solicitada_em ficam no default do banco.
      if (input.prazoDias !== undefined) row.prazo_dias = input.prazoDias;
      const { error: err } = await supabase.from('ac_recoletas').insert(row);
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  const updateRecoleta: UseRecoletasResult['updateRecoleta'] = useCallback(
    async (id, patch) => {
      const row: Record<string, unknown> = {};
      if (patch.motivo !== undefined) row.motivo = patch.motivo;
      if (patch.motivoDetalhe !== undefined) row.motivo_detalhe = patch.motivoDetalhe || null;
      if (patch.nota !== undefined) row.nota = patch.nota || null;
      if (patch.prazoDias !== undefined) row.prazo_dias = patch.prazoDias;
      // Ao sair de 'pendente', carimba a resolução; ao voltar, limpa.
      if (patch.status !== undefined) {
        row.status = patch.status;
        row.resolvida_em = patch.status === 'pendente' ? null : new Date().toISOString();
      }
      const { error: err } = await supabase.from('ac_recoletas').update(row).eq('id', id);
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  const deleteRecoleta: UseRecoletasResult['deleteRecoleta'] = useCallback(
    async (id) => {
      const { error: err } = await supabase.from('ac_recoletas').delete().eq('id', id);
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  return { recoletas, loading, error, refetch, createRecoleta, updateRecoleta, deleteRecoleta };
}
