import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

// Recortes crus das tabelas AC para a página de Indicadores (Fase 8).
// Cada consulta seleciona só as colunas usadas e, quando a linha tem carimbo de
// tempo próprio, é filtrada por data no servidor (janela [desde, ate] — presets
// 7/30/90 ou intervalo personalizado escolhido na página),
// para não puxar histórico inteiro. A agregação é client-side na página — mesmo
// padrão de CulturasPage/TemperaturaPage (volume de um lab pequeno). Todas as
// tabelas têm RLS permissiva de SELECT p/ authenticated; o gate é o frontend.

export interface IndAgendamento {
  id: string;
  data_hora: string;
  status: string;
  local_posto: string | null;
  posto_id: string | null;
  paciente_nome: string | null;
}
export interface IndColeta {
  id: string;
  coletado_em: string;
  validade_ok: boolean | null;
  etiquetado: boolean | null;
}
export interface IndCheckin {
  id: string;
  resultado: string;
  problema_em: string | null;
  conferido_em: string;
}
export interface IndExame {
  exame_nome: string;
  is_cultura: boolean;
}
export interface IndCultura {
  id: string;
  status: string;
  iniciada_em: string;
  prazo_dias: number;
  exame_nome: string | null;
  paciente_nome: string | null;
}
export interface IndTemperatura {
  equipamento_id: string;
  fora_faixa: boolean;
  temperatura: number;
  registrado_em: string;
}
export interface IndEquipamento {
  id: string;
  nome: string;
  tipo: string;
  localizacao: string | null;
  temp_min: number;
  temp_max: number;
  ativo: boolean;
}
// Saldo de um insumo num estoque de posto (para alertas de mínimo/validade).
// Junta product_stock (saldo por local) com o produto (mínimo, validade).
export interface IndInsumo {
  product_id: string;
  product_nome: string;
  unit: string | null;
  quantity: number;
  min_stock: number;
  expiration_date: string | null;
  posto_nome: string;
}

export interface IndicadoresData {
  agendamentos: IndAgendamento[];
  coletas: IndColeta[];
  checkins: IndCheckin[];
  exames: IndExame[];
  culturas: IndCultura[];
  temperaturas: IndTemperatura[];
  equipamentos: IndEquipamento[];
  insumos: IndInsumo[];
}

interface UseAcIndicadoresResult {
  data: IndicadoresData;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const EMPTY: IndicadoresData = {
  agendamentos: [],
  coletas: [],
  checkins: [],
  exames: [],
  culturas: [],
  temperaturas: [],
  equipamentos: [],
  insumos: [],
};

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v));

export function useAcIndicadores(desde: string, ate: string): UseAcIndicadoresResult {
  const [data, setData] = useState<IndicadoresData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [agRes, coRes, ckRes, exRes, cuRes, tpRes, eqRes, locRes] = await Promise.all([
      // Agendamentos da janela [desde, ate].
      supabase
        .from('ac_agendamentos')
        .select('id,data_hora,status,local_posto,posto_id,paciente_nome')
        .gte('data_hora', desde)
        .lte('data_hora', ate),
      supabase
        .from('ac_coletas')
        .select('id,coletado_em,validade_ok,etiquetado')
        .gte('coletado_em', desde)
        .lte('coletado_em', ate),
      supabase
        .from('ac_checkins')
        .select('id,resultado,problema_em,conferido_em')
        .gte('conferido_em', desde)
        .lte('conferido_em', ate),
      supabase
        .from('ac_agendamento_exames')
        .select('exame_nome,is_cultura')
        .gte('created_at', desde)
        .lte('created_at', ate),
      // Culturas: distribuição por status é estado atual → sem filtro de data (tabela pequena).
      supabase.from('ac_culturas').select('id,status,iniciada_em,prazo_dias,exame_nome,paciente_nome'),
      supabase
        .from('ac_temperaturas')
        .select('equipamento_id,fora_faixa,temperatura,registrado_em')
        .gte('registrado_em', desde)
        .lte('registrado_em', ate),
      supabase.from('ac_equipamentos').select('id,nome,tipo,localizacao,temp_min,temp_max,ativo'),
      // Estoques de posto (Fase 5): locais com posto_id → alerta de insumo por posto.
      supabase.from('stock_locations').select('id,nome,posto_id').eq('ativo', true).not('posto_id', 'is', null),
    ]);

    const firstErr = [agRes, coRes, ckRes, exRes, cuRes, tpRes, eqRes, locRes].find((r) => r.error)?.error;
    if (firstErr) {
      setError(firstErr.message);
      setData(EMPTY);
      setLoading(false);
      return;
    }

    // Saldo dos insumos nos estoques de posto (para os alertas de mínimo/validade).
    // Segundo passo: depende dos ids dos locais de posto acima. Mesmo embed de
    // `products(...)` já usado em useInventory.fetchLocationStock.
    const locs = (locRes.data ?? []) as { id: string; nome: string; posto_id: string | null }[];
    const locNome = new Map(locs.map((l) => [l.id, l.nome]));
    let insumos: IndInsumo[] = [];
    if (locs.length) {
      const psRes = await supabase
        .from('product_stock')
        .select('product_id,quantity,location_id,products(name,unit,min_stock,expiration_date)')
        .in('location_id', locs.map((l) => l.id))
        .gt('quantity', 0);
      if (psRes.error) {
        setError(psRes.error.message);
        setData(EMPTY);
        setLoading(false);
        return;
      }
      const psRows = (psRes.data ?? []) as unknown as {
        product_id: string;
        quantity: number;
        location_id: string;
        products: { name: string | null; unit: string | null; min_stock: number | null; expiration_date: string | null } | null;
      }[];
      insumos = psRows.map((r) => ({
        product_id: r.product_id,
        product_nome: r.products?.name ?? '',
        unit: r.products?.unit ?? null,
        quantity: num(r.quantity),
        min_stock: num(r.products?.min_stock ?? 0),
        expiration_date: r.products?.expiration_date ?? null,
        posto_nome: locNome.get(r.location_id) ?? '',
      }));
    }

    setData({
      agendamentos: (agRes.data ?? []) as IndAgendamento[],
      coletas: (coRes.data ?? []) as IndColeta[],
      checkins: (ckRes.data ?? []) as IndCheckin[],
      exames: (exRes.data ?? []) as IndExame[],
      culturas: (cuRes.data ?? []).map((r) => ({
        id: r.id as string,
        status: (r.status as string) ?? 'em_andamento',
        iniciada_em: r.iniciada_em as string,
        prazo_dias: num(r.prazo_dias),
        exame_nome: (r.exame_nome as string) ?? null,
        paciente_nome: (r.paciente_nome as string) ?? null,
      })),
      temperaturas: (tpRes.data ?? []) as IndTemperatura[],
      equipamentos: (eqRes.data ?? []) as IndEquipamento[],
      insumos,
    });
    setLoading(false);
  }, [desde, ate]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
