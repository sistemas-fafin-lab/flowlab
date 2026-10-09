import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { adicionarAnexosAoRegistro, mapAnexo, removerAnexoDoRegistro, type AnexoRow } from '../anexosRegistro';
import type {
  Despesa,
  DespesaInput,
  FormaPagamento,
  MotivoReajuste,
  NaturezaGasto,
  Reajuste,
  ReajusteInput,
  Recorrencia,
  TipoValor,
} from '../types';

interface ReajusteRow {
  id: string;
  vigente_desde: string;
  valor: number | string;
  motivo: MotivoReajuste;
  quantidade: number | null;
  observacao: string | null;
  created_at: string;
}

const mapReajuste = (row: ReajusteRow): Reajuste => ({
  id: row.id,
  vigenteDesde: row.vigente_desde,
  valor: Number(row.valor),
  motivo: row.motivo,
  quantidade: row.quantidade,
  observacao: row.observacao,
  createdAt: row.created_at,
});

interface DespesaRow {
  id: string;
  descricao: string;
  categoria_id: string;
  natureza: NaturezaGasto;
  quantidade: number | null;
  unidade: string | null;
  fornecedor_id: string | null;
  fornecedor_nome: string;
  setor: string | null;
  responsavel_id: string | null;
  tipo_valor: TipoValor;
  valor_base: number | string;
  recorrencia: Recorrencia;
  competencia_inicio: string;
  competencia_fim: string | null;
  dia_vencimento: number;
  forma_pagamento: FormaPagamento;
  meio_pagamento_detalhe: string | null;
  moeda_original: string | null;
  valor_original: number | string | null;
  numero_contrato: string | null;
  renovacao_automatica: boolean;
  aviso_renovacao_dias: number;
  autorizado_por: string;
  autorizado_em: string | null;
  observacoes: string | null;
  anexos: AnexoRow[] | null;
  created_at: string;
  updated_at: string;
  responsavel: { name: string } | null;
  reajustes: ReajusteRow[] | null;
}

// numeric do Postgres pode chegar como string pelo PostgREST quando é grande;
// Number() cobre os dois casos.
const numeroOuNull = (valor: number | string | null): number | null => (valor === null ? null : Number(valor));

const mapDespesa = (row: DespesaRow): Despesa => ({
  id: row.id,
  descricao: row.descricao,
  categoriaId: row.categoria_id,
  natureza: row.natureza,
  quantidade: row.quantidade,
  unidade: row.unidade,
  fornecedorId: row.fornecedor_id,
  fornecedorNome: row.fornecedor_nome,
  setor: row.setor,
  responsavelId: row.responsavel_id,
  responsavelNome: row.responsavel?.name ?? null,
  tipoValor: row.tipo_valor,
  valorBase: Number(row.valor_base),
  recorrencia: row.recorrencia,
  competenciaInicio: row.competencia_inicio,
  competenciaFim: row.competencia_fim,
  diaVencimento: row.dia_vencimento,
  formaPagamento: row.forma_pagamento,
  meioPagamentoDetalhe: row.meio_pagamento_detalhe,
  moedaOriginal: row.moeda_original,
  valorOriginal: numeroOuNull(row.valor_original),
  numeroContrato: row.numero_contrato,
  renovacaoAutomatica: row.renovacao_automatica,
  avisoRenovacaoDias: row.aviso_renovacao_dias,
  autorizadoPor: row.autorizado_por,
  autorizadoEm: row.autorizado_em,
  observacoes: row.observacoes,
  anexos: (row.anexos ?? []).map(mapAnexo),
  reajustes: (row.reajustes ?? []).map(mapReajuste).sort((a, b) => a.vigenteDesde.localeCompare(b.vigenteDesde)),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** Input já normalizado e validado (domain/validacaoDespesa) → colunas do banco. */
const paraLinha = (input: DespesaInput) => ({
  descricao: input.descricao,
  categoria_id: input.categoriaId,
  natureza: input.natureza,
  quantidade: input.quantidade,
  unidade: input.unidade,
  fornecedor_id: input.fornecedorId,
  fornecedor_nome: input.fornecedorNome,
  setor: input.setor,
  responsavel_id: input.responsavelId,
  tipo_valor: input.tipoValor,
  valor_base: input.valorBase,
  recorrencia: input.recorrencia,
  competencia_inicio: input.competenciaInicio,
  competencia_fim: input.competenciaFim,
  dia_vencimento: input.diaVencimento,
  forma_pagamento: input.formaPagamento,
  meio_pagamento_detalhe: input.meioPagamentoDetalhe,
  moeda_original: input.moedaOriginal,
  valor_original: input.valorOriginal,
  numero_contrato: input.numeroContrato,
  renovacao_automatica: input.renovacaoAutomatica,
  aviso_renovacao_dias: input.avisoRenovacaoDias,
  autorizado_por: input.autorizadoPor,
  autorizado_em: input.autorizadoEm,
  observacoes: input.observacoes,
});

const mensagemDeErro = (erro: { code?: string; message: string }, padrao: string): string => {
  if (erro.code === '23514') return 'Algum campo ficou fora do formato aceito. Confira valores e datas.';
  if (erro.code === '23503') return 'A categoria, o fornecedor ou o responsável escolhido não existe mais. Recarregue a página.';
  if (erro.code === '42501') return 'Você não tem permissão para alterar despesas de Gastos de TI.';
  return erro.message || padrao;
};

export type ResultadoCriarDespesa = { ok: true; id: string } | { ok: false; erro: string };

export interface UseDespesasTIResult {
  despesas: Despesa[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Devolve o id: os anexos de uma despesa nova sobem depois que ela existe. */
  criarDespesa: (input: DespesaInput) => Promise<ResultadoCriarDespesa>;
  /** As demais ações devolvem a mensagem de erro, ou null quando gravaram. */
  /** Correção: o valor base vale desde o início (RF02). Mudança daqui em diante é reajuste. */
  atualizarDespesa: (id: string, input: DespesaInput) => Promise<string | null>;
  registrarReajuste: (despesaId: string, input: ReajusteInput) => Promise<string | null>;
  removerReajuste: (reajusteId: string) => Promise<string | null>;
  /** Encerrar = definir a última competência; null = sem prazo (reabrir). RN08. */
  definirFim: (despesaId: string, competenciaFim: string | null) => Promise<string | null>;
  excluirDespesa: (despesaId: string) => Promise<string | null>;
  /** Importação (issue 09): uma inserção só — ou entram todas, ou nenhuma. */
  importarDespesas: (inputs: DespesaInput[]) => Promise<string | null>;
  /** Sobe os arquivos e acrescenta ao jsonb `anexos`. Mensagem lista o que não subiu. */
  adicionarAnexos: (despesaId: string, arquivos: File[]) => Promise<string | null>;
  removerAnexo: (despesaId: string, path: string) => Promise<string | null>;
}

export function useDespesasTI(): UseDespesasTIResult {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchDespesas = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('ti_despesas')
        // Três FKs para user_profiles (responsável, created_by, updated_by): a
        // coluna no hint diz ao PostgREST qual delas seguir. Os reajustes vêm
        // embutidos — a previsão de cada mês depende deles (RN04).
        .select(
          '*, responsavel:user_profiles!responsavel_id(name), reajustes:ti_despesa_reajustes(id, vigente_desde, valor, motivo, quantidade, observacao, created_at)',
        )
        .order('descricao', { ascending: true });

      if (fetchError) throw fetchError;
      if (requestIdRef.current !== requestId) return;

      setDespesas(((data as DespesaRow[] | null) ?? []).map(mapDespesa));
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      console.error('Erro ao carregar despesas de Gastos de TI:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as despesas.');
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDespesas();
  }, [fetchDespesas]);

  const criarDespesa = useCallback(
    async (input: DespesaInput): Promise<ResultadoCriarDespesa> => {
      const { data, error: erro } = await supabase.from('ti_despesas').insert(paraLinha(input)).select('id').single();
      if (erro) return { ok: false, erro: mensagemDeErro(erro, 'Não foi possível cadastrar a despesa.') };
      await fetchDespesas();
      return { ok: true, id: (data as { id: string }).id };
    },
    [fetchDespesas],
  );

  const atualizarDespesa = useCallback(
    async (id: string, input: DespesaInput): Promise<string | null> => {
      const { error: erro } = await supabase.from('ti_despesas').update(paraLinha(input)).eq('id', id);
      if (erro) return mensagemDeErro(erro, 'Não foi possível salvar a despesa.');
      await fetchDespesas();
      return null;
    },
    [fetchDespesas],
  );

  const registrarReajuste = useCallback(
    async (despesaId: string, input: ReajusteInput): Promise<string | null> => {
      const { error: erro } = await supabase.from('ti_despesa_reajustes').insert({
        despesa_id: despesaId,
        vigente_desde: input.vigenteDesde,
        valor: input.valor,
        motivo: input.motivo,
        quantidade: input.quantidade,
        observacao: input.observacao?.trim() || null,
      });
      if (erro) {
        if (erro.code === '23505') return 'Já existe um reajuste a partir desse mês.';
        // O trigger explica o caso do mês inicial com a própria mensagem.
        if (erro.code === '23514' && /reajuste/i.test(erro.message)) return erro.message;
        return mensagemDeErro(erro, 'Não foi possível registrar o reajuste.');
      }
      await fetchDespesas();
      return null;
    },
    [fetchDespesas],
  );

  const removerReajuste = useCallback(
    async (reajusteId: string): Promise<string | null> => {
      const { error: erro } = await supabase.from('ti_despesa_reajustes').delete().eq('id', reajusteId);
      if (erro) return mensagemDeErro(erro, 'Não foi possível remover o reajuste.');
      await fetchDespesas();
      return null;
    },
    [fetchDespesas],
  );

  const definirFim = useCallback(
    async (despesaId: string, competenciaFim: string | null): Promise<string | null> => {
      const { error: erro } = await supabase.from('ti_despesas').update({ competencia_fim: competenciaFim }).eq('id', despesaId);
      if (erro) return mensagemDeErro(erro, 'Não foi possível alterar o encerramento.');
      await fetchDespesas();
      return null;
    },
    [fetchDespesas],
  );

  const excluirDespesa = useCallback(
    async (despesaId: string): Promise<string | null> => {
      const { error: erro } = await supabase.from('ti_despesas').delete().eq('id', despesaId);
      if (erro) {
        // RESTRICT de ti_lancamentos: despesa com histórico não some. Postgres
        // recente devolve 23001 (restrict_violation) para ON DELETE RESTRICT;
        // versões antigas, 23503 — o teste da migration 06 pegou a diferença.
        if (erro.code === '23001' || erro.code === '23503') {
          return 'Esta despesa já tem pagamentos ou ajustes registrados e não pode ser excluída. Encerre-a informando a última cobrança.';
        }
        return mensagemDeErro(erro, 'Não foi possível excluir a despesa.');
      }
      await fetchDespesas();
      return null;
    },
    [fetchDespesas],
  );

  const importarDespesas = useCallback(
    async (inputs: DespesaInput[]): Promise<string | null> => {
      const { error: erro } = await supabase.from('ti_despesas').insert(inputs.map(paraLinha));
      if (erro) return mensagemDeErro(erro, 'Não foi possível importar as despesas.');
      await fetchDespesas();
      return null;
    },
    [fetchDespesas],
  );

  const adicionarAnexos = useCallback(
    async (despesaId: string, arquivos: File[]): Promise<string | null> => {
      const erro = await adicionarAnexosAoRegistro('ti_despesas', despesaId, arquivos);
      await fetchDespesas();
      return erro;
    },
    [fetchDespesas],
  );

  const removerAnexo = useCallback(
    async (despesaId: string, path: string): Promise<string | null> => {
      const erro = await removerAnexoDoRegistro('ti_despesas', despesaId, path);
      if (!erro) await fetchDespesas();
      return erro;
    },
    [fetchDespesas],
  );

  return {
    despesas,
    loading,
    error,
    refetch: fetchDespesas,
    criarDespesa,
    atualizarDespesa,
    registrarReajuste,
    removerReajuste,
    definirFim,
    excluirDespesa,
    importarDespesas,
    adicionarAnexos,
    removerAnexo,
  };
}
