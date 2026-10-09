import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { adicionarAnexosAoRegistro, mapAnexo, removerAnexoDoRegistro, removerTodosOsAnexos, type AnexoRow } from '../anexosRegistro';
import { camposAjuste, linhaAjusteNovo, type AjusteInput } from '../domain/ajuste';
import { acaoAoDesfazer, linhaBaixa, linhaBaixaEmLote, linhaDispensa, type OcorrenciaParaGravar } from '../domain/baixa';
import type { OcorrenciaDoMes } from '../domain/situacao';
import type { BaixaInput, FormaPagamento, Lancamento, StatusLancamento } from '../types';

export interface LancamentoRow {
  id: string;
  despesa_id: string;
  competencia: string;
  status: StatusLancamento;
  valor_previsto: number | string;
  vencimento: string;
  forma_pagamento: FormaPagamento;
  valor_pago: number | string | null;
  pago_em: string | null;
  nota_fiscal: string | null;
  motivo_dispensa: string | null;
  observacao: string | null;
  anexos: AnexoRow[] | null;
  created_at: string;
  updated_at: string;
}

export const mapLancamento = (row: LancamentoRow): Lancamento => ({
  id: row.id,
  despesaId: row.despesa_id,
  competencia: row.competencia,
  status: row.status,
  valorPrevisto: Number(row.valor_previsto),
  vencimento: row.vencimento,
  formaPagamento: row.forma_pagamento,
  valorPago: row.valor_pago === null ? null : Number(row.valor_pago),
  pagoEm: row.pago_em,
  notaFiscal: row.nota_fiscal,
  motivoDispensa: row.motivo_dispensa,
  observacao: row.observacao,
  anexos: (row.anexos ?? []).map(mapAnexo),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mensagemDeErro = (erro: { code?: string; message: string }, padrao: string): string => {
  // O trigger explica quando a competência não é cobrança da despesa.
  if (erro.code === '23514' && /cobrança prevista|não mudam/.test(erro.message)) return erro.message;
  if (erro.code === '23514') return 'Algum valor ficou fora do formato aceito. Confira e tente de novo.';
  if (erro.code === '42501') return 'Você não tem permissão para registrar pagamentos de Gastos de TI.';
  return erro.message || padrao;
};

/** upsert pela ocorrência: cria no primeiro toque, atualiza depois (RN15). */
const POR_OCORRENCIA = { onConflict: 'despesa_id,competencia' };

export type ResultadoBaixa = { ok: true; id: string } | { ok: false; erro: string };

export interface UseLancamentosTIResult {
  lancamentos: Lancamento[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Devolve o id para os anexos (comprovante) subirem em seguida. */
  registrarBaixa: (o: OcorrenciaParaGravar, input: BaixaInput) => Promise<ResultadoBaixa>;
  baixaEmLote: (ocorrencias: OcorrenciaDoMes[], pagoEm: string) => Promise<string | null>;
  dispensar: (o: OcorrenciaDoMes, motivo: string) => Promise<string | null>;
  /** Ajuste "só este mês" (RF11): cria o lançamento como 'previsto' no primeiro toque, ou atualiza sem mexer no status. */
  ajustar: (o: OcorrenciaDoMes, input: AjusteInput) => Promise<string | null>;
  desfazer: (o: OcorrenciaDoMes) => Promise<string | null>;
  adicionarAnexos: (lancamentoId: string, arquivos: File[]) => Promise<string | null>;
  removerAnexo: (lancamentoId: string, path: string) => Promise<string | null>;
}

/** Lançamentos de uma competência ('YYYY-MM-01'), filtrados no servidor. */
export function useLancamentosTI(competencia: string): UseLancamentosTIResult {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchLancamentos = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.from('ti_lancamentos').select('*').eq('competencia', competencia);
      if (fetchError) throw fetchError;
      if (requestIdRef.current !== requestId) return;
      setLancamentos(((data as LancamentoRow[] | null) ?? []).map(mapLancamento));
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      console.error('Erro ao carregar lançamentos de Gastos de TI:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os lançamentos.');
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [competencia]);

  useEffect(() => {
    fetchLancamentos();
  }, [fetchLancamentos]);

  const registrarBaixa = useCallback(
    async (o: OcorrenciaParaGravar, input: BaixaInput): Promise<ResultadoBaixa> => {
      const { data, error: erro } = await supabase
        .from('ti_lancamentos')
        .upsert(linhaBaixa(o, input), POR_OCORRENCIA)
        .select('id')
        .single();
      if (erro) return { ok: false, erro: mensagemDeErro(erro, 'Não foi possível registrar o pagamento.') };
      await fetchLancamentos();
      return { ok: true, id: (data as { id: string }).id };
    },
    [fetchLancamentos],
  );

  const baixaEmLote = useCallback(
    async (ocorrencias: OcorrenciaDoMes[], pagoEm: string): Promise<string | null> => {
      // Uma instrução só: ou todas as baixas entram, ou nenhuma.
      const { error: erro } = await supabase
        .from('ti_lancamentos')
        .upsert(ocorrencias.map((o) => linhaBaixaEmLote(o, pagoEm)), POR_OCORRENCIA);
      if (erro) return mensagemDeErro(erro, 'Não foi possível registrar os pagamentos.');
      await fetchLancamentos();
      return null;
    },
    [fetchLancamentos],
  );

  const dispensar = useCallback(
    async (o: OcorrenciaDoMes, motivo: string): Promise<string | null> => {
      const { error: erro } = await supabase.from('ti_lancamentos').upsert(linhaDispensa(o, motivo), POR_OCORRENCIA);
      if (erro) return mensagemDeErro(erro, 'Não foi possível dispensar a cobrança.');
      await fetchLancamentos();
      return null;
    },
    [fetchLancamentos],
  );

  const ajustar = useCallback(
    async (o: OcorrenciaDoMes, input: AjusteInput): Promise<string | null> => {
      // Com lançamento, só os campos do ajuste mudam: um ajuste depois da baixa
      // não pode transformar a cobrança paga de novo em "prevista".
      const { error: erro } = o.lancamento
        ? await supabase.from('ti_lancamentos').update(camposAjuste(input)).eq('id', o.lancamento.id)
        : await supabase.from('ti_lancamentos').insert(linhaAjusteNovo(o, input));
      if (erro) {
        if (erro.code === '23505') return 'Essa cobrança acabou de ser alterada por outra pessoa. Recarregue a página.';
        return mensagemDeErro(erro, 'Não foi possível ajustar a previsão.');
      }
      await fetchLancamentos();
      return null;
    },
    [fetchLancamentos],
  );

  const desfazer = useCallback(
    async (o: OcorrenciaDoMes): Promise<string | null> => {
      const lancamento = o.lancamento;
      const acao = acaoAoDesfazer(o);
      if (!lancamento || acao === 'nada') return null;
      if (acao === 'voltar_para_previsto') {
        const { error: erro } = await supabase
          .from('ti_lancamentos')
          .update({ status: 'previsto', valor_pago: null, pago_em: null, motivo_dispensa: null })
          .eq('id', lancamento.id);
        if (erro) return mensagemDeErro(erro, 'Não foi possível desfazer.');
      } else {
        const { error: erro } = await supabase.from('ti_lancamentos').delete().eq('id', lancamento.id);
        if (erro) return mensagemDeErro(erro, 'Não foi possível desfazer.');
        // A linha deixou de existir: os comprovantes dela não têm mais dono.
        await removerTodosOsAnexos(lancamento.anexos);
      }
      await fetchLancamentos();
      return null;
    },
    [fetchLancamentos],
  );

  const adicionarAnexos = useCallback(
    async (lancamentoId: string, arquivos: File[]): Promise<string | null> => {
      const erro = await adicionarAnexosAoRegistro('ti_lancamentos', lancamentoId, arquivos);
      await fetchLancamentos();
      return erro;
    },
    [fetchLancamentos],
  );

  const removerAnexo = useCallback(
    async (lancamentoId: string, path: string): Promise<string | null> => {
      const erro = await removerAnexoDoRegistro('ti_lancamentos', lancamentoId, path);
      if (!erro) await fetchLancamentos();
      return erro;
    },
    [fetchLancamentos],
  );

  return {
    lancamentos,
    loading,
    error,
    refetch: fetchLancamentos,
    registrarBaixa,
    baixaEmLote,
    dispensar,
    ajustar,
    desfazer,
    adicionarAnexos,
    removerAnexo,
  };
}
