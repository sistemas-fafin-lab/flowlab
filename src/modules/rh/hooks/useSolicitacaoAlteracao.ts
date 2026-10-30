import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { AlteracaoCampo, SolicitacaoAlteracao, StatusSolicitacaoAlteracao } from '../types';
import { alteracoesDoBanco, alteracoesParaRpc } from '../utils/solicitacaoAlteracao';

interface SolicitacaoRow {
  id: string;
  colaborador_id: string;
  alteracoes: unknown;
  status: StatusSolicitacaoAlteracao;
  motivo_recusa: string | null;
  decidido_em: string | null;
  resultado_visto_em: string | null;
  created_at: string;
}

const mapSolicitacao = (row: SolicitacaoRow): SolicitacaoAlteracao => ({
  id: row.id,
  colaboradorId: row.colaborador_id,
  alteracoes: alteracoesDoBanco(row.alteracoes),
  status: row.status,
  motivoRecusa: row.motivo_recusa,
  decididoEm: row.decidido_em,
  resultadoVistoEm: row.resultado_visto_em,
  createdAt: row.created_at,
});

/** Mensagem do RAISE EXCEPTION da RPC, ou a genérica. */
const mensagemErro = (erro: { message?: string } | null, generica: string): string => erro?.message?.trim() || generica;

export interface UseSolicitacaoAlteracaoResult {
  /** Solicitação pendente, se houver. */
  pendente: SolicitacaoAlteracao | null;
  /** Última decidida (aprovada/recusada) cujo aviso o colaborador ainda não dispensou. */
  resultado: SolicitacaoAlteracao | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Cada ação devolve a mensagem de erro ou null, e recarrega. */
  solicitar: (alteracoes: AlteracaoCampo[]) => Promise<string | null>;
  cancelar: (id: string) => Promise<string | null>;
  decidir: (id: string, aprovar: boolean, motivo?: string) => Promise<string | null>;
  dispensarResultado: (id: string) => Promise<string | null>;
}

/** Solicitação de alteração de dados pessoais de um colaborador (RLS: RH ou o próprio). */
export function useSolicitacaoAlteracao(colaboradorId: string): UseSolicitacaoAlteracaoResult {
  const [ultima, setUltima] = useState<SolicitacaoAlteracao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const carregar = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      // Canceladas não geram aviso; a mais recente entre as demais decide o que mostrar.
      const { data, error: erro } = await supabase
        .from('colaborador_solicitacoes_alteracao')
        .select('id, colaborador_id, alteracoes, status, motivo_recusa, decidido_em, resultado_visto_em, created_at')
        .eq('colaborador_id', colaboradorId)
        .neq('status', 'cancelada')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (erro) throw erro;
      if (requestIdRef.current !== requestId) return;
      setUltima(data ? mapSolicitacao(data as SolicitacaoRow) : null);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      console.error('Erro ao carregar solicitação de alteração:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a solicitação de alteração.');
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [colaboradorId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const executar = useCallback(
    async (rpc: string, args: Record<string, unknown>, generica: string): Promise<string | null> => {
      const { error: erro } = await supabase.rpc(rpc, args);
      // Recarrega também no erro: "não está mais pendente" significa que o estado mudou.
      await carregar();
      if (erro) {
        console.error(`Erro em ${rpc}:`, erro);
        return mensagemErro(erro, generica);
      }
      return null;
    },
    [carregar],
  );

  const solicitar = useCallback(
    (alteracoes: AlteracaoCampo[]) =>
      executar('rh_solicitar_alteracao', { p_alteracoes: alteracoesParaRpc(alteracoes) }, 'Não foi possível enviar sua solicitação.'),
    [executar],
  );
  const cancelar = useCallback(
    (id: string) => executar('rh_cancelar_solicitacao', { p_id: id }, 'Não foi possível cancelar a solicitação.'),
    [executar],
  );
  const decidir = useCallback(
    (id: string, aprovar: boolean, motivo?: string) =>
      executar('rh_decidir_solicitacao', { p_id: id, p_aprovar: aprovar, p_motivo: motivo?.trim() || null }, 'Não foi possível registrar a decisão.'),
    [executar],
  );
  const dispensarResultado = useCallback(
    (id: string) => executar('rh_dispensar_resultado', { p_id: id }, 'Não foi possível dispensar o aviso.'),
    [executar],
  );

  const pendente = ultima?.status === 'pendente' ? ultima : null;
  const resultado =
    ultima && (ultima.status === 'aprovada' || ultima.status === 'recusada') && !ultima.resultadoVistoEm ? ultima : null;

  return { pendente, resultado, loading, error, refetch: carregar, solicitar, cancelar, decidir, dispensarResultado };
}
