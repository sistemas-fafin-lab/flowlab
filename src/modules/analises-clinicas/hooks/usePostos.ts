import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { AcDiaExcecao, AcHorarioItem, AcHorarioPadrao, AcPosto } from '../types';

const normHora = (h: string): string => String(h).slice(0, 5); // 'HH:MM:SS' → 'HH:MM'

interface UsePostosResult {
  postos: AcPosto[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createPosto: (input: { nome: string; endereco: string }) => Promise<string | null>;
  updatePosto: (id: string, patch: Partial<Pick<AcPosto, 'nome' | 'endereco' | 'ativo'>>) => Promise<string | null>;
  deletePosto: (id: string) => Promise<string | null>;
  // ── Agenda recorrente ──────────────────────────────────────────────────────
  fetchHorariosPadrao: (postoId: string) => Promise<AcHorarioPadrao[]>;
  addHorarioPadrao: (input: { postoId: string; hora: string; capacidade: number }) => Promise<string | null>;
  removeHorarioPadrao: (id: string) => Promise<string | null>;
  fetchExcecoes: (postoId: string) => Promise<AcDiaExcecao[]>;
  saveExcecao: (input: { postoId: string; data: string; fechado: boolean; horarios: AcHorarioItem[] }) => Promise<string | null>;
  removeExcecao: (id: string) => Promise<string | null>;
}

// Gestão de postos e da agenda recorrente (ac_postos / ac_horarios_padrao /
// ac_dias_excecao). Mutações dependem das policies de RLS (admin/operator) das
// migrations 20260630120000 e 20260630130000; se a RLS negar, o erro é devolvido.
export function usePostos(): UsePostosResult {
  const [postos, setPostos] = useState<AcPosto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('ac_postos')
      .select('*')
      .order('nome', { ascending: true });
    if (err) {
      setError(err.message);
      setPostos([]);
    } else {
      setPostos((data ?? []) as AcPosto[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createPosto: UsePostosResult['createPosto'] = useCallback(
    async ({ nome, endereco }) => {
      const { error: err } = await supabase.from('ac_postos').insert({ nome, endereco });
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  const updatePosto: UsePostosResult['updatePosto'] = useCallback(
    async (id, patch) => {
      const { error: err } = await supabase.from('ac_postos').update(patch).eq('id', id);
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  const deletePosto: UsePostosResult['deletePosto'] = useCallback(
    async (id) => {
      // Horários padrão e exceções somem junto (FK ON DELETE CASCADE); agendamentos
      // existentes mantêm o snapshot local_posto (posto_id vira NULL).
      const { error: err } = await supabase.from('ac_postos').delete().eq('id', id);
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  // ── Horários fixos (recorrentes) ────────────────────────────────────────────
  const fetchHorariosPadrao: UsePostosResult['fetchHorariosPadrao'] = useCallback(async (postoId) => {
    const { data, error: err } = await supabase
      .from('ac_horarios_padrao')
      .select('*')
      .eq('posto_id', postoId)
      .order('hora', { ascending: true });
    if (err) {
      setError(err.message);
      return [];
    }
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      posto_id: r.posto_id as string,
      hora: normHora(r.hora as string),
      capacidade: (r.capacidade as number) ?? 1,
    }));
  }, []);

  const addHorarioPadrao: UsePostosResult['addHorarioPadrao'] = useCallback(
    async ({ postoId, hora, capacidade }) => {
      const { error: err } = await supabase
        .from('ac_horarios_padrao')
        .insert({ posto_id: postoId, hora: normHora(hora), capacidade });
      if (err) return err.code === '23505' ? 'Esse horário já existe no posto.' : err.message;
      return null;
    },
    [],
  );

  const removeHorarioPadrao: UsePostosResult['removeHorarioPadrao'] = useCallback(async (id) => {
    const { error: err } = await supabase.from('ac_horarios_padrao').delete().eq('id', id);
    return err ? err.message : null;
  }, []);

  // ── Exceções por dia ────────────────────────────────────────────────────────
  const fetchExcecoes: UsePostosResult['fetchExcecoes'] = useCallback(async (postoId) => {
    const { data, error: err } = await supabase
      .from('ac_dias_excecao')
      .select('*')
      .eq('posto_id', postoId)
      .order('data', { ascending: true });
    if (err) {
      setError(err.message);
      return [];
    }
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      posto_id: r.posto_id as string,
      data: r.data as string,
      fechado: Boolean(r.fechado),
      horarios: Array.isArray(r.horarios)
        ? (r.horarios as AcHorarioItem[]).map((h) => ({ hora: normHora(h.hora), capacidade: h.capacidade ?? 1 }))
        : [],
    }));
  }, []);

  const saveExcecao: UsePostosResult['saveExcecao'] = useCallback(
    async ({ postoId, data, fechado, horarios }) => {
      const payload = {
        posto_id: postoId,
        data,
        fechado,
        horarios: fechado ? [] : horarios.map((h) => ({ hora: normHora(h.hora), capacidade: h.capacidade })),
      };
      const { error: err } = await supabase
        .from('ac_dias_excecao')
        .upsert(payload, { onConflict: 'posto_id,data' });
      return err ? err.message : null;
    },
    [],
  );

  const removeExcecao: UsePostosResult['removeExcecao'] = useCallback(async (id) => {
    const { error: err } = await supabase.from('ac_dias_excecao').delete().eq('id', id);
    return err ? err.message : null;
  }, []);

  return {
    postos,
    loading,
    error,
    refetch,
    createPosto,
    updatePosto,
    deletePosto,
    fetchHorariosPadrao,
    addHorarioPadrao,
    removeHorarioPadrao,
    fetchExcecoes,
    saveExcecao,
    removeExcecao,
  };
}
