import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type {
  LinhaPlanoImportacao,
  PlanoImportacao,
} from '../components/CostControl/domain/importacaoFontesPagadoras';
import { chaveExclusaoExame } from '../components/CostControl/domain/busca';
import { exameComMesmoVinculoAplis } from '../components/CostControl/domain/vinculoAplis';

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
  // Vínculo com o apLIS (migration 20261020210000): ids de lá, não do flowlab.
  // Cobrança null = exame sem vínculo (a Admissão não manda TUSS por ele);
  // teste só existe com cobrança.
  aplisIdExameTipo: number | null;
  aplisIdTeste: number | null;
}

export interface Payor {
  id: string;
  payor: string;
  // Nome da tabela associada, lido do cadastro (tabelaId). Só exibição —
  // "mesma tabela" se compara por tabelaId.
  table: string;
  // custo_tabelas_associadas.id — é o que as gravações mandam (ticket 02).
  tabelaId: string;
  tus: string;
  price: number;
  atendido: boolean;
  // Só tem efeito real pra fonte pagadora "Particular" (Tabela Particular) —
  // nas outras 37 fica sempre FALSE e é ignorada. Ver migration
  // 20260910090000_custo_fontes_pagadoras_elegivel_desconto_particular.
  elegivelDescontoParticular: boolean;
  // Preenchido = "linha de exame": vale só pra este Exam, tenha ou não TUSS
  // (padrão do PayorFormModal ao escolher um exame). Null = "linha geral do
  // TUSS": vale pra todos os exames com `tus` (importação por planilha, ou
  // "aplicar a todos" no modal). Linha de exame tem precedência sobre a
  // geral da mesma fonte + tabela — ver examesPorFontePagadora e a migration
  // 20261001150000_custo_fontes_pagadoras_linha_por_exame.
  exameId: string | null;
  // Nome do exame na tabela do convênio, gravado pela importação (migration
  // 20261022140000). Preenchido com exameId null = "linha não levantada": a
  // importação não achou exame parecido, então não cobre exame nenhum até ser
  // vinculada — ver ehLinhaNaoLevantada em domain/busca.ts.
  nomeConvenio: string | null;
}

// Cadastro da tabela associada (contrato de preço) de uma fonte pagadora —
// public.custo_tabelas_associadas (migration 20261021170000). Cada linha de
// custo_fontes_pagadoras aponta pra uma por tabelaId. A importação e o modal
// de linha escolhem daqui (com "+ Nova tabela"); o texto `table` da linha é
// copiado do nome pelo banco.
export interface TabelaAssociada {
  id: string;
  fontePagadora: string;
  nome: string;
  // ISO (YYYY-MM-DD) ou null quando o contrato não tem prazo.
  vencimento: string | null;
  ativa: boolean;
}

// "+ Nova tabela" (EscolhaTabelaAssociada): cria o cadastro e devolve-o, já
// pra ser escolhido. vencimento ISO ou null.
export type CriarTabelaAssociada = (
  fontePagadora: string,
  nome: string,
  vencimento: string | null
) => Promise<TabelaAssociada>;

// Campos editáveis de uma linha de fonte pagadora via PayorFormModal — não
// inclui `atendido` nem `elegivelDescontoParticular` (editados via toggle
// inline, updatePayorAtendido / updatePayorElegivelDescontoParticular).
// tabelaId null = nenhuma tabela escolhida ainda (o modal não deixa salvar).
export type PayorEditData = Pick<Payor, 'payor' | 'table' | 'tus' | 'price' | 'exameId'> & {
  tabelaId: string | null;
};

export interface UseCostControlReturn {
  exams: Exam[];
  payors: Payor[];
  tabelasAssociadas: TabelaAssociada[];
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
  importPayors: (tabela: TabelaAssociada, plano: PlanoImportacao) => Promise<number>;
  createTabelaAssociada: CriarTabelaAssociada;
  updateVencimentoTabelaAssociada: (id: string, vencimento: string | null) => Promise<void>;
  renameTabelaAssociada: (id: string, nome: string) => Promise<void>;
  setAtivaTabelaAssociada: (id: string, ativa: boolean) => Promise<void>;
  deleteTabelaAssociada: (id: string) => Promise<void>;
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
  aplisIdExameTipo: row.aplis_id_exame_tipo ?? null,
  aplisIdTeste: row.aplis_id_teste ?? null,
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
  if (data.aplisIdExameTipo !== undefined) payload.aplis_id_exame_tipo = data.aplisIdExameTipo;
  if (data.aplisIdTeste !== undefined) payload.aplis_id_teste = data.aplisIdTeste;
  return payload;
};

// Violação do índice uq_custo_exames_vinculo_aplis (mesmo par cobrança/teste
// do apLIS em dois exames) vira mensagem que diz QUAL exame já tem o par, em
// vez do "duplicate key value violates unique constraint" do Postgres.
// Qualquer outro erro sai como veio do Supabase.
const erroAoSalvarExame = (
  error: { code?: string; message?: string },
  exams: Exam[],
  idProprio: string | null,
  data: Partial<Omit<Exam, 'id'>>
): unknown => {
  if (error.code === '23505' && error.message?.includes('uq_custo_exames_vinculo_aplis') && data.aplisIdExameTipo != null) {
    const outro = exameComMesmoVinculoAplis(exams, idProprio, data.aplisIdExameTipo, data.aplisIdTeste ?? null);
    return new Error(
      outro
        ? `Esta cobrança/teste já está ligada ao exame "${outro.name}".`
        : 'Esta cobrança/teste já está ligada a outro exame.'
    );
  }
  return error;
};

// custo_fontes_pagadoras guarda snake_case (schema Postgres); a tela usa o
// formato de Payor. tus casa com Exam.tuss (ver PayorsScreen/AnalyticsScreen).
// O nome da tabela vem do cadastro (embed pela FK tabela_associada_id), nunca
// do texto tabela_associada da linha — ticket 07.
const PAYOR_COLUNAS =
  'id, fonte_pagadora, tabela_associada_id, tuss, valor, atendido, elegivel_desconto_particular, exame_id, nome_exame_convenio, ' +
  'tabela:custo_tabelas_associadas(nome)';

const mapPayorRow = (row: any): Payor => ({
  id: row.id,
  payor: row.fonte_pagadora,
  table: row.tabela?.nome ?? '',
  tabelaId: row.tabela_associada_id,
  tus: row.tuss ?? '',
  price: Number(row.valor) || 0,
  atendido: row.atendido ?? true,
  elegivelDescontoParticular: row.elegivel_desconto_particular ?? false,
  exameId: row.exame_id ?? null,
  nomeConvenio: row.nome_exame_convenio ?? null,
});

interface TabelaAssociadaRow {
  id: string;
  fonte_pagadora: string;
  nome: string;
  vencimento: string | null;
  ativa: boolean;
}

const TABELA_ASSOCIADA_COLUNAS = 'id, fonte_pagadora, nome, vencimento, ativa';

const mapTabelaAssociadaRow = (row: TabelaAssociadaRow): TabelaAssociada => ({
  id: row.id,
  fontePagadora: row.fonte_pagadora,
  nome: row.nome,
  vencimento: row.vencimento,
  ativa: row.ativa,
});

// Só o id da tabela: o banco copia o texto tabela_associada do cadastro
// (trigger custo_fontes_pagadoras_sincroniza_tabela_associada). Mandar o
// texto junto faria um texto defasado ganhar do id.
const toPayorRow = (data: PayorEditData) => ({
  fonte_pagadora: data.payor,
  tabela_associada_id: data.tabelaId,
  tuss: data.tus,
  valor: data.price,
  exame_id: data.exameId ?? null,
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
      .select(PAYOR_COLUNAS)
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
  const [tabelasAssociadas, setTabelasAssociadas] = useState<TabelaAssociada[]>([]);
  const [exameExclusions, setExameExclusions] = useState<Set<string>>(new Set());
  const [exameValoresPersonalizados, setExameValoresPersonalizados] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  // Lido por erroAoSalvarExame sem recriar addExam/updateExam a cada mudança.
  const examsRef = useRef<Exam[]>([]);
  useEffect(() => {
    examsRef.current = exams;
  }, [exams]);

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

  const fetchTabelasAssociadas = useCallback(async () => {
    const { data, error } = await supabase
      .from('custo_tabelas_associadas')
      .select(TABELA_ASSOCIADA_COLUNAS)
      .order('fonte_pagadora', { ascending: true })
      .order('nome', { ascending: true });
    if (error) throw error;
    setTabelasAssociadas((data || []).map(mapTabelaAssociadaRow));
  }, []);

  // Na carga. Falha aqui só deixa o bloco "Tabelas desta fonte" e as listas
  // de escolha vazios — não derruba a tela de linhas.
  const recarregarTabelasAssociadas = useCallback(async () => {
    try {
      await fetchTabelasAssociadas();
    } catch (err) {
      console.error('Falha ao recarregar tabelas associadas', err);
    }
  }, [fetchTabelasAssociadas]);

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
        await Promise.all([
          fetchExams(),
          fetchPayors(),
          recarregarTabelasAssociadas(),
          fetchExameExclusions(),
          fetchExameValoresPersonalizados(),
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchExams, fetchPayors, recarregarTabelasAssociadas, fetchExameExclusions, fetchExameValoresPersonalizados]);

  const addExam = useCallback(async (data: Omit<Exam, 'id'>) => {
    const { data: inserted, error } = await supabase
      .from('custo_exames')
      .insert(toExamPayload(data))
      .select()
      .single();

    if (error) throw erroAoSalvarExame(error, examsRef.current, null, data);
    setExams(prev => [mapExamRow(inserted), ...prev]);
  }, []);

  const updateExam = useCallback(async (id: string, data: Partial<Omit<Exam, 'id'>>) => {
    const { data: updated, error } = await supabase
      .from('custo_exames')
      .update(toExamPayload(data))
      .eq('id', id)
      .select()
      .single();

    if (error) throw erroAoSalvarExame(error, examsRef.current, id, data);
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
      .select(PAYOR_COLUNAS)
      .single();

    if (error) throw error;
    const mapped = mapPayorRow(updated);
    setPayors(prev => prev.map(p => (p.id === id ? mapped : p)));
  }, []);

  const createPayor = useCallback(async (data: PayorEditData) => {
    const { data: inserted, error } = await supabase
      .from('custo_fontes_pagadoras')
      .insert(toPayorRow(data))
      .select(PAYOR_COLUNAS)
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

  // Grava o plano da importação (planejarImportacao, o mesmo da prévia) na
  // tabela associada escolhida: remove as linhas gerais do TUSS substituídas
  // (e as não levantadas que viraram linhas próprias), atualiza as linhas
  // existentes e insere as novas.
  const importPayors = useCallback(async (tabela: TabelaAssociada, plano: PlanoImportacao) => {
    if (plano.linhas.length === 0) return 0;

    // Reflete cada gravação no estado local assim que ela é confirmada no
    // banco — se uma gravação no meio do lote falhar, o que já foi gravado
    // não fica invisível na tela nem é reinserido numa nova tentativa (o
    // plano é recalculado a partir do state).
    const substituidas = [...plano.linhasGeraisSubstituidas, ...plano.naoLevantadasRemovidas].map(p => p.id);
    if (substituidas.length > 0) {
      const { error } = await supabase.from('custo_fontes_pagadoras').delete().in('id', substituidas);
      if (error) throw error;
      // As exclusões e os valores personalizados delas saem junto (ON DELETE CASCADE).
      const removidas = new Set(substituidas);
      setPayors(prev => prev.filter(p => !removidas.has(p.id)));
    }

    const linhaDaTabela = { fonte_pagadora: tabela.fontePagadora, tabela_associada_id: tabela.id };
    const toRow = (l: LinhaPlanoImportacao) => ({
      ...linhaDaTabela,
      tuss: l.tuss,
      nome_exame_convenio: l.nomeConvenio,
      exame_id: l.exame?.id ?? null,
      valor: l.valor,
      atendido: l.atendido,
    });

    const novas: LinhaPlanoImportacao[] = [];
    for (const l of plano.linhas) {
      if (!l.existenteId) {
        novas.push(l);
        continue;
      }
      const { data, error } = await supabase
        .from('custo_fontes_pagadoras')
        .update(toRow(l))
        .eq('id', l.existenteId)
        .select(PAYOR_COLUNAS)
        .single();

      // PGRST116 = UPDATE não afetou nenhuma linha: o id ficou obsoleto no
      // state local (a linha foi apagada no banco por esta ou outra sessão).
      // Em vez de abortar o lote, insere como nova.
      if (error?.code === 'PGRST116') {
        const existenteId = l.existenteId;
        setPayors(prev => prev.filter(p => p.id !== existenteId));
        novas.push(l);
        continue;
      }
      if (error) throw error;
      const atualizado = mapPayorRow(data);
      setPayors(prev => prev.map(p => (p.id === atualizado.id ? atualizado : p)));
    }

    if (novas.length > 0) {
      const { data, error } = await supabase
        .from('custo_fontes_pagadoras')
        .insert(novas.map(toRow))
        .select(PAYOR_COLUNAS);
      if (error) throw error;
      const inseridos = (data || []).map(mapPayorRow);
      setPayors(prev => [...inseridos, ...prev]);
    }

    return plano.linhas.length;
  }, []);

  // Nome repetido na fonte já é barrado na tela (erroNomeTabela, sem
  // diferenciar maiúsculas); aqui sobra a corrida com outra sessão, pela
  // unicidade custo_tabelas_associadas_fonte_nome_ci_key (ticket 07).
  const createTabelaAssociada: CriarTabelaAssociada = useCallback(
    async (fontePagadora, nome, vencimento) => {
      const nomeLimpo = nome.trim();
      const { data, error } = await supabase
        .from('custo_tabelas_associadas')
        .insert({ fonte_pagadora: fontePagadora, nome: nomeLimpo, vencimento })
        .select(TABELA_ASSOCIADA_COLUNAS)
        .single();
      if (error) {
        if (error.code === '23505') throw new Error(`Já existe a tabela "${nomeLimpo}" nesta fonte pagadora.`);
        throw error;
      }
      const criada = mapTabelaAssociadaRow(data);
      setTabelasAssociadas(prev => [...prev, criada]);
      return criada;
    },
    []
  );

  const updateVencimentoTabelaAssociada = useCallback(async (id: string, vencimento: string | null) => {
    const { data, error } = await supabase
      .from('custo_tabelas_associadas')
      .update({ vencimento })
      .eq('id', id)
      .select(TABELA_ASSOCIADA_COLUNAS)
      .single();
    if (error) throw error;
    const atualizada = mapTabelaAssociadaRow(data);
    setTabelasAssociadas(prev => prev.map(t => (t.id === id ? atualizada : t)));
  }, []);

  // Ticket 03. As regras ficam no banco (20261021190000): nome repetido na
  // fonte, Tabela Particular protegida e inativa sem linhas novas são
  // recusados lá com mensagem pronta (23505/23514) — repassada como veio.
  const updateTabelaAssociada = useCallback(
    async (id: string, campos: { nome?: string; ativa?: boolean }) => {
      const { data, error } = await supabase
        .from('custo_tabelas_associadas')
        .update(campos)
        .eq('id', id)
        .select(TABELA_ASSOCIADA_COLUNAS)
        .single();
      if (error) {
        if (error.code === '23505' || error.code === '23514') throw new Error(error.message);
        throw error;
      }
      const atualizada = mapTabelaAssociadaRow(data);
      setTabelasAssociadas(prev => prev.map(t => (t.id === id ? atualizada : t)));
      return atualizada;
    },
    []
  );

  // O banco propaga o nome novo pro texto de todas as linhas da tabela
  // (trigger custo_tabelas_associadas_propaga_nome); aqui só espelha no state.
  const renameTabelaAssociada = useCallback(
    async (id: string, nome: string) => {
      const atualizada = await updateTabelaAssociada(id, { nome: nome.trim() });
      setPayors(prev => prev.map(p => (p.tabelaId === id ? { ...p, table: atualizada.nome } : p)));
    },
    [updateTabelaAssociada]
  );

  const setAtivaTabelaAssociada = useCallback(
    async (id: string, ativa: boolean) => {
      await updateTabelaAssociada(id, { ativa });
    },
    [updateTabelaAssociada]
  );

  // Só sem linhas: a FK custo_fontes_pagadoras.tabela_associada_id é
  // ON DELETE RESTRICT (23503) — a tela já avisa antes pela contagem, mas
  // outra sessão pode ter gravado uma linha nesse meio-tempo.
  const deleteTabelaAssociada = useCallback(async (id: string) => {
    const { error } = await supabase.from('custo_tabelas_associadas').delete().eq('id', id);
    if (error) {
      if (error.code === '23503') {
        throw new Error('A tabela ainda tem linhas de preço. Exclua ou mova as linhas antes, ou desative a tabela.');
      }
      if (error.code === '23514') throw new Error(error.message);
      throw error;
    }
    setTabelasAssociadas(prev => prev.filter(t => t.id !== id));
  }, []);

  return {
    exams,
    payors,
    tabelasAssociadas,
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
    createTabelaAssociada,
    updateVencimentoTabelaAssociada,
    renameTabelaAssociada,
    setAtivaTabelaAssociada,
    deleteTabelaAssociada,
  };
};
