import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { AcEquipamento, AcTemperatura, AcTipoFrasco, EquipamentoTipo } from '../types';

interface EquipamentoInput {
  nome: string;
  tipo: EquipamentoTipo;
  localizacao: string;
  tempMin: number;
  tempMax: number;
  ativo: boolean;
}

// Contagem de um tipo de frasco informada ao registrar uma leitura.
interface FrascoInput {
  tipo_frasco_id: string;
  quantidade: number;
}

// Select com embed do join até o nome do tipo de frasco (histórico sobrevive à
// desativação do tipo — o nome vem do snapshot da linha, não do catálogo atual).
const SELECT_TEMPERATURA_COM_FRASCOS =
  '*, ac_temperatura_frascos(id, temperatura_id, tipo_frasco_id, quantidade, created_at, ac_tipos_frasco(nome))';

type TemperaturaFrascoRaw = {
  id: string;
  temperatura_id: string;
  tipo_frasco_id: string;
  quantidade: number;
  created_at: string;
  ac_tipos_frasco: { nome: string } | null;
};

interface UseTemperaturasResult {
  equipamentos: AcEquipamento[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createEquipamento: (input: EquipamentoInput) => Promise<string | null>;
  updateEquipamento: (
    id: string,
    patch: Partial<{ nome: string; tipo: EquipamentoTipo; localizacao: string; tempMin: number; tempMax: number; ativo: boolean }>,
  ) => Promise<string | null>;
  deleteEquipamento: (id: string) => Promise<string | null>;
  // Registra uma leitura. `fora_faixa` é derivado no banco. `frascos` é opcional
  // (só entram linhas com quantidade > 0). Retorna erro ou null.
  registrarTemperatura: (input: {
    equipamentoId: string;
    temperatura: number;
    registradoPor: string;
    observacao: string;
    registradoEm: string; // ISO 8601 (data/hora da leitura escolhida)
    frascos?: FrascoInput[];
  }) => Promise<string | null>;
  // Histórico de leituras de um equipamento (mais recentes primeiro), com frascos.
  fetchTemperaturas: (equipamentoId: string, limit?: number) => Promise<AcTemperatura[]>;
  // Séries recentes por equipamento (ordem cronológica: antigo → novo), indexadas
  // por equipamento_id. Servem ao sparkline + à última leitura (último item).
  fetchLeiturasRecentes: (porEquipamento?: number) => Promise<Record<string, AcTemperatura[]>>;
  // Catálogo de tipos de frasco (ac_tipos_frasco). `soAtivos` (default true) filtra
  // para uso no formulário de leitura; a tela de administração usa `false`.
  fetchTiposFrasco: (soAtivos?: boolean) => Promise<AcTipoFrasco[]>;
  createTipoFrasco: (nome: string) => Promise<string | null>;
  updateTipoFrasco: (id: string, patch: Partial<{ nome: string; ativo: boolean }>) => Promise<string | null>;
  // Desativa (ativo = false) — nunca DELETE físico, senão barra pela FK RESTRICT.
  desativarTipoFrasco: (id: string) => Promise<string | null>;
}

// Normaliza numeric(5,2): o PostgREST pode devolver como string em alguns setups.
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v));

const mapTemperatura = (r: Record<string, unknown>): AcTemperatura => ({
  id: r.id as string,
  equipamento_id: r.equipamento_id as string,
  temperatura: num(r.temperatura),
  fora_faixa: Boolean(r.fora_faixa),
  registrado_por: r.registrado_por as string,
  observacao: (r.observacao as string) ?? null,
  registrado_em: r.registrado_em as string,
  created_at: r.created_at as string,
  frascos: ((r.ac_temperatura_frascos as TemperaturaFrascoRaw[] | null) ?? []).map((f) => ({
    id: f.id,
    temperatura_id: f.temperatura_id,
    tipo_frasco_id: f.tipo_frasco_id,
    quantidade: num(f.quantidade),
    created_at: f.created_at,
    tipo_frasco_nome: f.ac_tipos_frasco?.nome ?? '?',
  })),
});

const mapTipoFrasco = (r: Record<string, unknown>): AcTipoFrasco => ({
  id: r.id as string,
  nome: r.nome as string,
  ativo: Boolean(r.ativo),
  created_at: r.created_at as string,
  updated_at: r.updated_at as string,
});

const mapEquipamento = (r: Record<string, unknown>): AcEquipamento => ({
  id: r.id as string,
  nome: r.nome as string,
  tipo: r.tipo as EquipamentoTipo,
  localizacao: (r.localizacao as string) ?? null,
  temp_min: num(r.temp_min),
  temp_max: num(r.temp_max),
  ativo: Boolean(r.ativo),
  created_at: r.created_at as string,
  updated_at: r.updated_at as string,
});

// Gestão de equipamentos e log de temperaturas (ac_equipamentos / ac_temperaturas,
// Fase 7 Etapa C). RLS permissiva por authenticated; o gate é o frontend.
export function useTemperaturas(): UseTemperaturasResult {
  const [equipamentos, setEquipamentos] = useState<AcEquipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('ac_equipamentos')
      .select('*')
      .order('nome', { ascending: true });
    if (err) {
      setError(err.message);
      setEquipamentos([]);
    } else {
      setEquipamentos((data ?? []).map(mapEquipamento));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createEquipamento: UseTemperaturasResult['createEquipamento'] = useCallback(
    async ({ nome, tipo, localizacao, tempMin, tempMax, ativo }) => {
      if (tempMin >= tempMax) return 'A temperatura mínima deve ser menor que a máxima.';
      const { error: err } = await supabase.from('ac_equipamentos').insert({
        nome,
        tipo,
        localizacao: localizacao || null,
        temp_min: tempMin,
        temp_max: tempMax,
        ativo,
      });
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  const updateEquipamento: UseTemperaturasResult['updateEquipamento'] = useCallback(
    async (id, patch) => {
      const row: Record<string, unknown> = {};
      if (patch.nome !== undefined) row.nome = patch.nome;
      if (patch.tipo !== undefined) row.tipo = patch.tipo;
      if (patch.localizacao !== undefined) row.localizacao = patch.localizacao || null;
      if (patch.tempMin !== undefined) row.temp_min = patch.tempMin;
      if (patch.tempMax !== undefined) row.temp_max = patch.tempMax;
      if (patch.ativo !== undefined) row.ativo = patch.ativo;
      const min = patch.tempMin, max = patch.tempMax;
      if (min !== undefined && max !== undefined && min >= max) {
        return 'A temperatura mínima deve ser menor que a máxima.';
      }
      const { error: err } = await supabase.from('ac_equipamentos').update(row).eq('id', id);
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  const deleteEquipamento: UseTemperaturasResult['deleteEquipamento'] = useCallback(
    async (id) => {
      // As leituras somem junto (FK ON DELETE CASCADE).
      const { error: err } = await supabase.from('ac_equipamentos').delete().eq('id', id);
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  const registrarTemperatura: UseTemperaturasResult['registrarTemperatura'] = useCallback(
    async ({ equipamentoId, temperatura, registradoPor, observacao, registradoEm, frascos }) => {
      // RPC insere leitura + frascos numa transação só (ver migration): se algum
      // frasco vier inválido, nada fica de pé — sem leitura órfã sem frascos.
      const { error: err } = await supabase.rpc('ac_registrar_temperatura', {
        p_equipamento_id: equipamentoId,
        p_temperatura: temperatura,
        p_registrado_por: registradoPor,
        p_observacao: observacao || '',
        p_registrado_em: registradoEm,
        p_frascos: (frascos ?? []).filter((f) => f.quantidade > 0),
      });
      return err ? err.message : null;
    },
    [],
  );

  const fetchTemperaturas: UseTemperaturasResult['fetchTemperaturas'] = useCallback(
    async (equipamentoId, limit = 30) => {
      const { data, error: err } = await supabase
        .from('ac_temperaturas')
        .select(SELECT_TEMPERATURA_COM_FRASCOS)
        .eq('equipamento_id', equipamentoId)
        .order('registrado_em', { ascending: false })
        .limit(limit);
      if (err) throw err;
      return (data ?? []).map(mapTemperatura);
    },
    [],
  );

  const fetchLeiturasRecentes: UseTemperaturasResult['fetchLeiturasRecentes'] = useCallback(
    async (porEquipamento = 15) => {
      // Janela recente agrupada por equipamento: guarda as N leituras mais novas de
      // cada e devolve em ordem cronológica (antigo → novo) para o gráfico. Suficiente
      // para um lab com poucos equipamentos; sem view/DISTINCT ON.
      const { data, error: err } = await supabase
        .from('ac_temperaturas')
        .select(SELECT_TEMPERATURA_COM_FRASCOS)
        .order('registrado_em', { ascending: false })
        .limit(1000);
      if (err) throw err;
      const out: Record<string, AcTemperatura[]> = {};
      for (const raw of data ?? []) {
        const t = mapTemperatura(raw);
        if (!out[t.equipamento_id]) out[t.equipamento_id] = [];
        if (out[t.equipamento_id].length < porEquipamento) out[t.equipamento_id].push(t); // desc: novo primeiro
      }
      for (const k of Object.keys(out)) out[k].reverse(); // → cronológico (antigo → novo)
      return out;
    },
    [],
  );

  const fetchTiposFrasco: UseTemperaturasResult['fetchTiposFrasco'] = useCallback(async (soAtivos = true) => {
    let query = supabase.from('ac_tipos_frasco').select('*').order('nome', { ascending: true });
    if (soAtivos) query = query.eq('ativo', true);
    const { data, error: err } = await query;
    if (err) throw err;
    return (data ?? []).map(mapTipoFrasco);
  }, []);

  const createTipoFrasco: UseTemperaturasResult['createTipoFrasco'] = useCallback(async (nome) => {
    if (!nome.trim()) return 'Informe o nome do tipo de frasco.';
    const { error: err } = await supabase.from('ac_tipos_frasco').insert({ nome: nome.trim() });
    return err ? err.message : null;
  }, []);

  const updateTipoFrasco: UseTemperaturasResult['updateTipoFrasco'] = useCallback(async (id, patch) => {
    const row: Record<string, unknown> = {};
    if (patch.nome !== undefined) {
      if (!patch.nome.trim()) return 'Informe o nome do tipo de frasco.';
      row.nome = patch.nome.trim();
    }
    if (patch.ativo !== undefined) row.ativo = patch.ativo;
    const { error: err } = await supabase.from('ac_tipos_frasco').update(row).eq('id', id);
    return err ? err.message : null;
  }, []);

  const desativarTipoFrasco: UseTemperaturasResult['desativarTipoFrasco'] = useCallback(
    async (id) => {
      const { error: err } = await supabase.from('ac_tipos_frasco').update({ ativo: false }).eq('id', id);
      return err ? err.message : null;
    },
    [],
  );

  return {
    equipamentos,
    loading,
    error,
    refetch,
    createEquipamento,
    updateEquipamento,
    deleteEquipamento,
    registrarTemperatura,
    fetchTemperaturas,
    fetchLeiturasRecentes,
    fetchTiposFrasco,
    createTipoFrasco,
    updateTipoFrasco,
    desativarTipoFrasco,
  };
}
