import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { AcDiaExcecao, AcPosto } from '../types';

const normHora = (h: string): string => String(h).slice(0, 5); // 'HH:MM:SS' → 'HH:MM'
const normHoraOpt = (h: unknown): string | null => (typeof h === 'string' && h ? normHora(h) : null);

// Linha de ac_postos (snake_case do banco) → AcPosto do domínio.
const mapPosto = (r: Record<string, unknown>): AcPosto => ({
  id: r.id as string,
  nome: r.nome as string,
  endereco: (r.endereco as string) ?? '',
  ativo: Boolean(r.ativo),
  agenda_hora_inicio: normHoraOpt(r.agenda_hora_inicio),
  agenda_hora_fim: normHoraOpt(r.agenda_hora_fim),
  agenda_intervalo_min:
    r.agenda_intervalo_min == null ? null : Number(r.agenda_intervalo_min),
  agenda_dias_semana: Array.isArray(r.agenda_dias_semana)
    ? (r.agenda_dias_semana as unknown[]).map(Number)
    : [],
  created_at: r.created_at as string | undefined,
  updated_at: r.updated_at as string | undefined,
});

// Configuração da grade de agenda de um posto.
export interface AgendaInput {
  horaInicio: string | null;   // 'HH:MM'
  horaFim: string | null;      // 'HH:MM'
  intervaloMin: number | null; // minutos entre atendimentos
  diasSemana: number[];        // 0=dom … 6=sáb
}

interface UsePostosResult {
  postos: AcPosto[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createPosto: (input: { nome: string; endereco: string }) => Promise<string | null>;
  updatePosto: (id: string, patch: Partial<Pick<AcPosto, 'nome' | 'endereco' | 'ativo'>>) => Promise<string | null>;
  deletePosto: (id: string) => Promise<string | null>;
  // ── Grade de agenda ─────────────────────────────────────────────────────────
  saveAgenda: (postoId: string, input: AgendaInput) => Promise<string | null>;
  // ── Datas bloqueadas (feriados) ─────────────────────────────────────────────
  fetchExcecoes: (postoId: string) => Promise<AcDiaExcecao[]>;
  addExcecao: (input: { postoId: string; data: string }) => Promise<string | null>;
  removeExcecao: (id: string) => Promise<string | null>;
}

// Gestão de postos, da grade de agenda (colunas agenda_* de ac_postos) e das datas
// bloqueadas (ac_dias_excecao). Mutações dependem das policies de RLS (admin/operator)
// das migrations 20260630120000 / 20260630130000 / 20260714120000; se a RLS negar, o
// erro é devolvido.
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
      setPostos((data ?? []).map((r) => mapPosto(r as Record<string, unknown>)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createPosto: UsePostosResult['createPosto'] = useCallback(
    async ({ nome, endereco }) => {
      const { data, error: err } = await supabase
        .from('ac_postos')
        .insert({ nome, endereco })
        .select('id, nome')
        .single();
      if (err) return err.message;
      // Cada posto ganha um estoque departamental próprio (local rastreável com
      // controle de consumo): a Qualidade transfere para ele; o posto consome/vence.
      if (data) {
        const { error: locErr } = await supabase.from('stock_locations').insert({
          nome: `Posto — ${data.nome}`,
          department: data.nome,
          is_principal: false,
          rastreavel: true,
          controla_consumo: true,
          posto_id: data.id,
        });
        // 23505 = nome já existe (local já criado): não é motivo para falhar o posto.
        if (locErr && locErr.code !== '23505') console.error('Falha ao criar o estoque do posto:', locErr.message);
      }
      await refetch();
      return null;
    },
    [refetch],
  );

  const updatePosto: UsePostosResult['updatePosto'] = useCallback(
    async (id, patch) => {
      const { error: err } = await supabase.from('ac_postos').update(patch).eq('id', id);
      if (err) return err.message;
      // Mantém o estoque departamental do posto em sincronia (nome/ativo).
      const locPatch: Record<string, unknown> = {};
      if (patch.nome !== undefined) { locPatch.nome = `Posto — ${patch.nome}`; locPatch.department = patch.nome; }
      if (patch.ativo !== undefined) locPatch.ativo = patch.ativo;
      if (Object.keys(locPatch).length > 0) {
        await supabase.from('stock_locations').update(locPatch).eq('posto_id', id);
      }
      await refetch();
      return null;
    },
    [refetch],
  );

  const deletePosto: UsePostosResult['deletePosto'] = useCallback(
    async (id) => {
      // O estoque departamental do posto referencia ac_postos (FK RESTRICT); remove-o
      // antes. Se o local ainda tiver saldo, o RESTRICT de product_stock (23503) barra
      // e devolvemos um erro claro — não se exclui um posto que ainda tem estoque.
      const { error: locErr } = await supabase.from('stock_locations').delete().eq('posto_id', id);
      if (locErr) {
        return locErr.code === '23503'
          ? 'Não é possível excluir: o posto ainda possui estoque departamental com saldo.'
          : locErr.message;
      }
      // As datas bloqueadas somem junto (ac_dias_excecao FK ON DELETE CASCADE); a grade
      // de agenda vive nas próprias colunas do posto. Agendamentos existentes mantêm o
      // snapshot local_posto (posto_id vira NULL).
      const { error: err } = await supabase.from('ac_postos').delete().eq('id', id);
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  // ── Grade de agenda (colunas agenda_* de ac_postos) ─────────────────────────
  const saveAgenda: UsePostosResult['saveAgenda'] = useCallback(
    async (postoId, { horaInicio, horaFim, intervaloMin, diasSemana }) => {
      const { data, error: err } = await supabase
        .from('ac_postos')
        .update({
          agenda_hora_inicio: horaInicio ? normHora(horaInicio) : null,
          agenda_hora_fim: horaFim ? normHora(horaFim) : null,
          agenda_intervalo_min: intervaloMin,
          agenda_dias_semana: diasSemana,
        })
        .eq('id', postoId)
        .select();
      if (err) {
        console.error('[saveAgenda] Erro do Supabase:', err);
        return err.message;
      }
      if (!data || data.length === 0) {
        console.warn('[saveAgenda] Nenhuma linha afetada — provável bloqueio de RLS ou posto inexistente.');
        return 'O posto não foi atualizado. Verifique permissões (RLS) ou se o posto existe.';
      }
      await refetch();
      return null;
    },
    [refetch],
  );

  // ── Datas bloqueadas (feriados) ─────────────────────────────────────────────
  const fetchExcecoes: UsePostosResult['fetchExcecoes'] = useCallback(async (postoId) => {
    const { data, error: err } = await supabase
      .from('ac_dias_excecao')
      .select('id, posto_id, data')
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
    }));
  }, []);

  const addExcecao: UsePostosResult['addExcecao'] = useCallback(
    async ({ postoId, data }) => {
      const { error: err } = await supabase
        .from('ac_dias_excecao')
        .upsert({ posto_id: postoId, data }, { onConflict: 'posto_id,data', ignoreDuplicates: true });
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
    saveAgenda,
    fetchExcecoes,
    addExcecao,
    removeExcecao,
  };
}
