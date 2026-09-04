import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

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
}

export interface UseCostControlReturn {
  exams: Exam[];
  payors: Payor[];
  loading: boolean;
  addExam: (data: Omit<Exam, 'id'>) => Promise<void>;
  updateExam: (id: string, data: Partial<Omit<Exam, 'id'>>) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  importExams: (rows: Omit<Exam, 'id'>[]) => Promise<number>;
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

// ═══════════════════════════════════════════════════════════════════════════════
// SEED DATA — Fontes Pagadoras (mock; tela já rotula como "somente leitura,
// espelhado do APLIS". Sem persistência própria até isso ser sincronizado de
// verdade.)
// ═══════════════════════════════════════════════════════════════════════════════

// tus casa com Exam.tuss (ver PayorsScreen/AnalyticsScreen) — os códigos abaixo
// são TUSS reais que existem no catálogo semeado em custo_exames (migration
// 20260903130000). Particular/SUS ficam com '—'/código SIGTAP de propósito:
// não usam a tabela TUSS privada, então não têm com o que casar.
export const SEED_PAYORS: Payor[] = [
  { id: 'p1',  payor: 'Unimed',         table: 'Unimed Coop.',  tus: '40304361',   price: 9.20  },
  { id: 'p2',  payor: 'Unimed',         table: 'Unimed Coop.',  tus: '40302040',   price: 4.80  },
  { id: 'p3',  payor: 'Unimed',         table: 'Unimed Coop.',  tus: '40304312',   price: 5.40  },
  { id: 'p4',  payor: 'Bradesco Saúde', table: 'AMB 90',        tus: '40304361',   price: 12.50 },
  { id: 'p5',  payor: 'Bradesco Saúde', table: 'AMB 90',        tus: '40316521',   price: 22.00 },
  { id: 'p6',  payor: 'Saldo de Caixa', table: 'Particular',    tus: '—',          price: 95.00 },
  { id: 'p7',  payor: 'Saldo de Caixa', table: 'Particular',    tus: '—',          price: 65.00 },
  { id: 'p8',  payor: 'Saldo de Caixa', table: 'Particular',    tus: '—',          price: 48.00 },
  { id: 'p9',  payor: 'SUS',            table: 'Tabela SUS',    tus: '0202010317', price: 3.20  },
  { id: 'p10', payor: 'SUS',            table: 'Tabela SUS',    tus: '0202010317', price: 1.80  },
  { id: 'p11', payor: 'SulAmérica',     table: 'CBHPM',         tus: '40316521',   price: 18.40 },
  { id: 'p12', payor: 'SulAmérica',     table: 'CBHPM',         tus: '40302830',   price: 38.00 },
  { id: 'p13', payor: 'Hapvida',        table: 'Hapvida 2024',  tus: '40304361',   price: 8.10  },
  { id: 'p14', payor: 'Hapvida',        table: 'Hapvida 2024',  tus: '40304312',   price: 4.10  },
  { id: 'p15', payor: 'Hapvida',        table: 'Hapvida 2024',  tus: '40311210',   price: 4.40  },
  { id: 'p16', payor: 'Saldo de Caixa', table: 'Particular',    tus: '—',          price: 38.00 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
//
// Exames persistem em public.custo_exames (migration 20260903130000), sob RLS
// de canViewBilling/canManageBilling — mesmo gate da rota /cost-control.
// Fontes Pagadoras seguem em memória (ver comentário acima do seed).
// ═══════════════════════════════════════════════════════════════════════════════

export const useCostControl = (): UseCostControlReturn => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [payors] = useState<Payor[]>(SEED_PAYORS);
  const [loading, setLoading] = useState(true);

  const fetchExams = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('custo_exames')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      setExams((data || []).map(mapExamRow));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

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

  return { exams, payors, loading, addExam, updateExam, deleteExam, importExams };
};
