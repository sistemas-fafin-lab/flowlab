import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { AcCultura, AcCulturaEtapa, CulturaStatus } from '../types';

// Campos editáveis manualmente de uma cultura (criada no check-in ou avulsa).
export interface CulturaPatch {
  etapaOrdem?: number;
  status?: CulturaStatus;
  nota?: string | null;
  resultado?: string | null;
  prazoDias?: number;
}

// Cadastro de cultura AVULSA (sem vínculo com agendamento/coleta): a via alternativa
// à criação pelo check-in. `exameId` fica null quando o tipo é digitado à mão ("Outro").
export interface CulturaCreateInput {
  exameNome: string;
  exameId?: string | null;
  pacienteNome?: string | null;
  postoId?: string | null;
  localPosto?: string | null;
  nota?: string | null;
  prazoDias?: number;
}

interface UseCulturasResult {
  culturas: AcCultura[];
  etapas: AcCulturaEtapa[]; // trilha ordenada (ac_cultura_etapas) p/ o stepper
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createCultura: (input: CulturaCreateInput) => Promise<string | null>;
  updateCultura: (id: string, patch: CulturaPatch) => Promise<string | null>;
  deleteCultura: (id: string) => Promise<string | null>;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v));

const mapCultura = (r: Record<string, unknown>): AcCultura => ({
  id: r.id as string,
  agendamento_id: (r.agendamento_id as string) ?? null,
  exame_id: (r.exame_id as string) ?? null,
  exame_nome: r.exame_nome as string,
  paciente_nome: (r.paciente_nome as string) ?? null,
  posto_id: (r.posto_id as string) ?? null,
  local_posto: (r.local_posto as string) ?? null,
  etapa_ordem: num(r.etapa_ordem),
  status: r.status as CulturaStatus,
  nota: (r.nota as string) ?? null,
  resultado: (r.resultado as string) ?? null,
  iniciada_em: r.iniciada_em as string,
  prazo_dias: num(r.prazo_dias),
  created_at: r.created_at as string,
  updated_at: r.updated_at as string,
});

const mapEtapa = (r: Record<string, unknown>): AcCulturaEtapa => ({
  id: r.id as string,
  ordem: num(r.ordem),
  nome: r.nome as string,
  ativo: Boolean(r.ativo),
});

// Acompanhamento manual de culturas (ac_culturas / ac_cultura_etapas, Fase 7A).
// RLS permissiva por authenticated; o gate é o frontend + a permissão. As culturas
// nascem no check-in (registrar_coleta) ou como cadastro avulso (createCultura);
// aqui se lê, cria (avulsa), atualiza etapa/status e remove.
export function useCulturas(): UseCulturasResult {
  const [culturas, setCulturas] = useState<AcCultura[]>([]);
  const [etapas, setEtapas] = useState<AcCulturaEtapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [cRes, eRes] = await Promise.all([
      supabase.from('ac_culturas').select('*').order('iniciada_em', { ascending: false }),
      supabase.from('ac_cultura_etapas').select('*').eq('ativo', true).order('ordem', { ascending: true }),
    ]);
    if (cRes.error) {
      setError(cRes.error.message);
      setCulturas([]);
    } else {
      setCulturas((cRes.data ?? []).map(mapCultura));
    }
    if (eRes.error) {
      if (!cRes.error) setError(eRes.error.message);
      setEtapas([]);
    } else {
      setEtapas((eRes.data ?? []).map(mapEtapa));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createCultura: UseCulturasResult['createCultura'] = useCallback(
    async (input) => {
      const nome = input.exameNome.trim();
      if (!nome) return 'Informe o tipo de cultura.';
      const row: Record<string, unknown> = {
        agendamento_id: null, // avulsa: sem vínculo com coleta/agendamento
        exame_id: input.exameId ?? null,
        exame_nome: nome,
        paciente_nome: input.pacienteNome?.trim() || null,
        posto_id: input.postoId ?? null,
        local_posto: input.localPosto?.trim() || null,
        nota: input.nota?.trim() || null,
      };
      // status / etapa_ordem / iniciada_em ficam no default do banco.
      if (input.prazoDias !== undefined) row.prazo_dias = input.prazoDias;
      const { error: err } = await supabase.from('ac_culturas').insert(row);
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  const updateCultura: UseCulturasResult['updateCultura'] = useCallback(
    async (id, patch) => {
      const row: Record<string, unknown> = {};
      if (patch.etapaOrdem !== undefined) row.etapa_ordem = patch.etapaOrdem;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.nota !== undefined) row.nota = patch.nota || null;
      if (patch.resultado !== undefined) row.resultado = patch.resultado || null;
      if (patch.prazoDias !== undefined) row.prazo_dias = patch.prazoDias;
      const { error: err } = await supabase.from('ac_culturas').update(row).eq('id', id);
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  const deleteCultura: UseCulturasResult['deleteCultura'] = useCallback(
    async (id) => {
      const { error: err } = await supabase.from('ac_culturas').delete().eq('id', id);
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  return { culturas, etapas, loading, error, refetch, createCultura, updateCultura, deleteCultura };
}
