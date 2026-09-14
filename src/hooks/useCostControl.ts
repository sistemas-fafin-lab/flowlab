import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  separarUpsertFontePagadora,
  type LinhaImportacaoFontePagadora,
} from '../components/CostControl/domain/importacaoFontesPagadoras';
import { chaveExclusaoExame } from '../components/CostControl/domain/busca';

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
  // Só tem efeito real pra fonte pagadora "Particular" (Tabela Particular) —
  // nas outras 37 fica sempre FALSE e é ignorada. Ver migration
  // 20260910090000_custo_fontes_pagadoras_elegivel_desconto_particular.
  elegivelDescontoParticular: boolean;
}

// Campos editáveis de uma linha de fonte pagadora via PayorFormModal — não
// inclui `atendido` nem `elegivelDescontoParticular` (editados via toggle
// inline, updatePayorAtendido / updatePayorElegivelDescontoParticular).
export type PayorEditData = Pick<Payor, 'payor' | 'table' | 'tus' | 'price'>;

export interface UseCostControlReturn {
  exams: Exam[];
  payors: Payor[];
  // Chaves chaveExclusaoExame(payorId, exameId) — exames excluídos de uma
  // linha de fonte pagadora com TUSS compartilhado (ver
  // custo_fontes_pagadoras_exclusoes / examesPorFontePagadora em domain/busca.ts).
  exameExclusions: Set<string>;
  // Chaves chaveExclusaoExame(payorId, exameId) → valor — overrides de valor
  // de venda por exame, pra quando um TUSS compartilhado precisa cobrar
  // diferente entre os irmãos pra mesma fonte pagadora (ver
  // custo_fontes_pagadoras_valores_exame / examesPorFontePagadora).
  exameValoresPersonalizados: Map<string, number>;
  loading: boolean;
  addExam: (data: Omit<Exam, 'id'>) => Promise<void>;
  updateExam: (id: string, data: Partial<Omit<Exam, 'id'>>) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  importExams: (rows: Omit<Exam, 'id'>[]) => Promise<number>;
  updatePayorAtendido: (id: string, atendido: boolean) => Promise<void>;
  updatePayorElegivelDescontoParticular: (id: string, elegivel: boolean) => Promise<void>;
  updatePayor: (id: string, data: PayorEditData) => Promise<void>;
  createPayor: (data: PayorEditData) => Promise<void>;
  deletePayor: (id: string) => Promise<void>;
  excludeExameDaFontePagadora: (payorId: string, exameId: string) => Promise<void>;
  setValorExameDaFontePagadora: (payorId: string, exameId: string, valor: number) => Promise<void>;
  restaurarValorPadraoExameDaFontePagadora: (payorId: string, exameId: string) => Promise<void>;
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
  elegivelDescontoParticular: row.elegivel_desconto_particular ?? false,
});

const toPayorRow = (data: PayorEditData) => ({
  fonte_pagadora: data.payor,
  tabela_associada: data.table,
  tuss: data.tus,
  valor: data.price,
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
      .order('id', { ascending: true })
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
  const [exameExclusions, setExameExclusions] = useState<Set<string>>(new Set());
  const [exameValoresPersonalizados, setExameValoresPersonalizados] = useState<Map<string, number>>(new Map());
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

  const fetchExameExclusions = useCallback(async () => {
    const { data, error } = await supabase.from('custo_fontes_pagadoras_exclusoes').select('payor_id, exame_id');
    if (error) throw error;
    setExameExclusions(new Set((data || []).map(row => chaveExclusaoExame(row.payor_id, row.exame_id))));
  }, []);

  const fetchExameValoresPersonalizados = useCallback(async () => {
    const { data, error } = await supabase
      .from('custo_fontes_pagadoras_valores_exame')
      .select('payor_id, exame_id, valor');
    if (error) throw error;
    setExameValoresPersonalizados(
      new Map((data || []).map(row => [chaveExclusaoExame(row.payor_id, row.exame_id), Number(row.valor) || 0]))
    );
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await Promise.all([fetchExams(), fetchPayors(), fetchExameExclusions(), fetchExameValoresPersonalizados()]);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchExams, fetchPayors, fetchExameExclusions, fetchExameValoresPersonalizados]);

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

  const updatePayorElegivelDescontoParticular = useCallback(async (id: string, elegivel: boolean) => {
    const { error } = await supabase
      .from('custo_fontes_pagadoras')
      .update({ elegivel_desconto_particular: elegivel })
      .eq('id', id);

    if (error) throw error;
    setPayors(prev => prev.map(p => (p.id === id ? { ...p, elegivelDescontoParticular: elegivel } : p)));
  }, []);

  const updatePayor = useCallback(async (id: string, data: PayorEditData) => {
    const { data: updated, error } = await supabase
      .from('custo_fontes_pagadoras')
      .update(toPayorRow(data))
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    const mapped = mapPayorRow(updated);
    setPayors(prev => prev.map(p => (p.id === id ? mapped : p)));
  }, []);

  const createPayor = useCallback(async (data: PayorEditData) => {
    const { data: inserted, error } = await supabase
      .from('custo_fontes_pagadoras')
      .insert(toPayorRow(data))
      .select()
      .single();

    if (error) throw error;
    setPayors(prev => [mapPayorRow(inserted), ...prev]);
  }, []);

  const deletePayor = useCallback(async (id: string) => {
    const { error } = await supabase.from('custo_fontes_pagadoras').delete().eq('id', id);
    if (error) throw error;
    setPayors(prev => prev.filter(p => p.id !== id));
  }, []);

  // Usado quando o TUSS da linha é compartilhado por mais de um exame (ver
  // examesPorFontePagadora): exclui só esse exame da fonte pagadora, sem
  // apagar o preço nem os demais exames que compartilham o mesmo TUSS.
  const excludeExameDaFontePagadora = useCallback(async (payorId: string, exameId: string) => {
    const { error } = await supabase
      .from('custo_fontes_pagadoras_exclusoes')
      .insert({ payor_id: payorId, exame_id: exameId });
    if (error) throw error;
    setExameExclusions(prev => new Set(prev).add(chaveExclusaoExame(payorId, exameId)));
  }, []);

  // Usado quando o TUSS da linha é compartilhado por mais de um exame (ver
  // examesPorFontePagadora): grava um valor de venda só pra esse exame,
  // sem mexer no valor padrão da linha (que continua valendo pros irmãos
  // sem override).
  const setValorExameDaFontePagadora = useCallback(async (payorId: string, exameId: string, valor: number) => {
    const { error } = await supabase
      .from('custo_fontes_pagadoras_valores_exame')
      .upsert({ payor_id: payorId, exame_id: exameId, valor }, { onConflict: 'payor_id,exame_id' });
    if (error) throw error;
    setExameValoresPersonalizados(prev => new Map(prev).set(chaveExclusaoExame(payorId, exameId), valor));
  }, []);

  // Reverte um exame que tinha valor personalizado pra voltar a usar o
  // valor padrão do TUSS (o mesmo dos irmãos).
  const restaurarValorPadraoExameDaFontePagadora = useCallback(async (payorId: string, exameId: string) => {
    const { error } = await supabase
      .from('custo_fontes_pagadoras_valores_exame')
      .delete()
      .eq('payor_id', payorId)
      .eq('exame_id', exameId);
    if (error) throw error;
    setExameValoresPersonalizados(prev => {
      const next = new Map(prev);
      next.delete(chaveExclusaoExame(payorId, exameId));
      return next;
    });
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

        // PGRST116 = UPDATE não afetou nenhuma linha (0 rows no retorno de
        // .single()). Acontece quando o id ficou obsoleto no state local —
        // a linha que existia quando a tela carregou já foi apagada no
        // banco (por esta ou outra sessão). Em vez de estourar um 406 cru e
        // abortar o lote inteiro, trata como TUSS novo e insere.
        if (error?.code === 'PGRST116') {
          const { data: inserted, error: insertError } = await supabase
            .from('custo_fontes_pagadoras')
            .insert({
              fonte_pagadora: fontePagadora,
              tabela_associada: tabelaAssociada,
              tuss: u.tuss,
              valor: u.valor,
              atendido: u.atendido,
            })
            .select()
            .single();

          if (insertError) throw insertError;
          const inseridoAoInvesDeAtualizado = mapPayorRow(inserted);
          setPayors(prev => [inseridoAoInvesDeAtualizado, ...prev.filter(p => p.id !== u.id)]);
          continue;
        }

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
    exameExclusions,
    exameValoresPersonalizados,
    loading,
    addExam,
    updateExam,
    deleteExam,
    importExams,
    updatePayorAtendido,
    updatePayorElegivelDescontoParticular,
    updatePayor,
    createPayor,
    deletePayor,
    excludeExameDaFontePagadora,
    setValorExameDaFontePagadora,
    restaurarValorPadraoExameDaFontePagadora,
    importPayors,
  };
};
