import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  separarUpsertFontePagadora,
  type LinhaImportacaoFontePagadora,
} from '../components/CostControl/domain/importacaoFontesPagadoras';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface IndirectCostItem {
  id: string;
  label: string;
  value: number;
}

export interface Exam {
  id: string;
  code: string;
  tuss: string;
  name: string;
  location: string;
  direct: number;
  indirect: number;
  indirectItems: IndirectCostItem[];
}

export interface Payor {
  id: string;
  payor: string;
  table: string;
  tus: string;
  price: number;
  atendido: boolean;
}

export interface UseCostControlReturn {
  exams: Exam[];
  payors: Payor[];
  loading: boolean;
  addExam: (data: Omit<Exam, 'id'>) => Promise<void>;
  updateExam: (id: string, data: Partial<Omit<Exam, 'id'>>) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  importExams: (rows: Omit<Exam, 'id'>[]) => Promise<number>;
  updatePayorAtendido: (id: string, atendido: boolean) => Promise<void>;
  importPayors: (
    fontePagadora: string,
    tabelaAssociada: string,
    rows: LinhaImportacaoFontePagadora[]
  ) => Promise<number>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════════════

export const formatBRL = (v: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export const formatPct = (v: number): string =>
  `${v.toFixed(1).replace('.', ',')}%`;

// custo_exames guarda snake_case (schema Postgres); a tela usa o formato de Exam.
const mapExamRow = (row: any): Exam => ({
  id: row.id,
  code: row.codigo ?? '',
  tuss: row.tuss ?? '',
  name: row.nome,
  location: row.local ?? '',
  direct: Number(row.custo_direto) || 0,
  indirect: Number(row.custo_indireto) || 0,
  indirectItems: row.custo_indireto_itens ?? [],
});

const toExamPayload = (data: Partial<Omit<Exam, 'id'>>) => {
  const payload: Record<string, unknown> = {};
  if (data.code !== undefined) payload.codigo = data.code;
  if (data.tuss !== undefined) payload.tuss = data.tuss;
  if (data.name !== undefined) payload.nome = data.name;
  if (data.location !== undefined) payload.local = data.location;
  if (data.direct !== undefined) payload.custo_direto = data.direct;
  if (data.indirect !== undefined) payload.custo_indireto = data.indirect;
  if (data.indirectItems !== undefined) payload.custo_indireto_itens = data.indirectItems;
  return payload;
};

// custo_fontes_pagadoras guarda snake_case (schema Postgres); a tela usa o
// formato de Payor. tus casa com Exam.tuss (ver PayorsScreen/AnalyticsScreen).
const mapPayorRow = (row: any): Payor => ({
  id: row.id,
  payor: row.fonte_pagadora,
  table: row.tabela_associada ?? '',
  tus: row.tuss ?? '',
  price: Number(row.valor) || 0,
  atendido: row.atendido ?? true,
});

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
//
// Exames persistem em public.custo_exames (migration 20260903130000) e Fontes
// Pagadoras em public.custo_fontes_pagadoras (migration 20260904110000),
// ambas sob RLS de canViewBilling/canManageBilling — mesmo gate da rota
// /cost-control.
// ═══════════════════════════════════════════════════════════════════════════════

// custo_fontes_pagadoras passa de 1000 linhas — acima do limite padrão de
// página do PostgREST, então precisa paginar em vez de um select único.
// Exportada (não só usada dentro do hook) porque o botão Exportar de
// PayorsScreen precisa buscar todas as linhas direto do Supabase quando
// nenhum filtro está ativo na tela, sem depender do state `payors` do hook.
export const buscarTodasFontesPagadoras = async (): Promise<Payor[]> => {
  const pageSize = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('custo_fontes_pagadoras')
      .select('*')
      .order('fonte_pagadora', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows.map(mapPayorRow);
};

export const useCostControl = (): UseCostControlReturn => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [payors, setPayors] = useState<Payor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExams = useCallback(async () => {
    const { data, error } = await supabase
      .from('custo_exames')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw error;
    setExams((data || []).map(mapExamRow));
  }, []);

  const fetchPayors = useCallback(async () => {
    setPayors(await buscarTodasFontesPagadoras());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await Promise.all([fetchExams(), fetchPayors()]);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchExams, fetchPayors]);

  const addExam = useCallback(async (data: Omit<Exam, 'id'>) => {
    const { data: inserted, error } = await supabase
      .from('custo_exames')
      .insert(toExamPayload(data))
      .select()
      .single();

    if (error) throw error;
    setExams(prev => [mapExamRow(inserted), ...prev]);
  }, []);

  const updateExam = useCallback(async (id: string, data: Partial<Omit<Exam, 'id'>>) => {
    const { data: updated, error } = await supabase
      .from('custo_exames')
      .update(toExamPayload(data))
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    setExams(prev => prev.map(e => (e.id === id ? mapExamRow(updated) : e)));
  }, []);

  const deleteExam = useCallback(async (id: string) => {
    const { error } = await supabase.from('custo_exames').delete().eq('id', id);
    if (error) throw error;
    setExams(prev => prev.filter(e => e.id !== id));
  }, []);

  const importExams = useCallback(async (rows: Omit<Exam, 'id'>[]) => {
    if (rows.length === 0) return 0;
    const { data: inserted, error } = await supabase
      .from('custo_exames')
      .insert(rows.map(toExamPayload))
      .select();

    if (error) throw error;
    const mapped = (inserted || []).map(mapExamRow);
    setExams(prev => [...mapped, ...prev]);
    return mapped.length;
  }, []);

  const updatePayorAtendido = useCallback(async (id: string, atendido: boolean) => {
    const { error } = await supabase
      .from('custo_fontes_pagadoras')
      .update({ atendido })
      .eq('id', id);

    if (error) throw error;
    setPayors(prev => prev.map(p => (p.id === id ? { ...p, atendido } : p)));
  }, []);

  // Casamento (upsert) por fonte_pagadora + tabela_associada + tuss — uma
  // mesma fonte pagadora pode ter dezenas de tabelas associadas (convênios)
  // com o mesmo TUSS e valores diferentes (ex.: AMHP-DF tem 37), então casar
  // só por fonte+TUSS colidiria com a linha errada. Ver
  // domain/importacaoFontesPagadoras.ts e o ticket 02.
  const importPayors = useCallback(
    async (fontePagadora: string, tabelaAssociada: string, rows: LinhaImportacaoFontePagadora[]) => {
      if (rows.length === 0) return 0;

      const existentesPorTuss = new Map<string, string>();
      payors.forEach(p => {
        if (p.payor === fontePagadora && p.table === tabelaAssociada) existentesPorTuss.set(p.tus, p.id);
      });

      const { toInsert, toUpdate } = separarUpsertFontePagadora(rows, existentesPorTuss);

      // Reflete cada gravação no estado local assim que ela é confirmada no
      // banco — se uma atualização no meio do lote falhar, o que já foi
      // gravado não fica invisível na tela nem é reinserido numa nova
      // tentativa (existentesPorTuss seria recalculado a partir do state).
      if (toInsert.length > 0) {
        const { data, error } = await supabase
          .from('custo_fontes_pagadoras')
          .insert(
            toInsert.map(r => ({
              fonte_pagadora: fontePagadora,
              tabela_associada: tabelaAssociada,
              tuss: r.tuss,
              valor: r.valor,
              atendido: r.atendido,
            }))
          )
          .select();

        if (error) throw error;
        const inseridos = (data || []).map(mapPayorRow);
        setPayors(prev => [...inseridos, ...prev]);
      }

      for (const u of toUpdate) {
        const { data, error } = await supabase
          .from('custo_fontes_pagadoras')
          .update({ valor: u.valor, atendido: u.atendido })
          .eq('id', u.id)
          .select()
          .single();

        if (error) throw error;
        const atualizado = mapPayorRow(data);
        setPayors(prev => prev.map(p => (p.id === atualizado.id ? atualizado : p)));
      }

      return toInsert.length + toUpdate.length;
    },
    [payors]
  );

  return {
    exams,
    payors,
    loading,
    addExam,
    updateExam,
    deleteExam,
    importExams,
    updatePayorAtendido,
    importPayors,
  };
};
