import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { notificarPagamento } from '../../pagamentos/notificarPagamento';
import { chaveGestor } from '../utils/departamentos';
import type { Departamento, PainelPagamentos, SituacaoGestor } from '../types';

interface DepartamentoRow {
  id: string;
  nome: string;
  ativo: boolean;
  aprovador_sc_id: string | null;
  departamento_responsaveis: { colaborador_id: string; autoriza_pagamentos: boolean }[] | null;
}

interface PainelRow {
  gestores: { departamento_id: string; colaborador_id: string; user_id: string | null; situacao: SituacaoGestor }[];
  pendentes: { departamento_id: string; autorizador_id: string; autorizador: string; quantidade: number; valor: number }[];
}


const mapPainel = (row: PainelRow | null): PainelPagamentos => {
  const painel: PainelPagamentos = { situacoes: {}, usuarios: {}, pendentes: [] };
  for (const g of row?.gestores ?? []) {
    painel.situacoes[chaveGestor(g.departamento_id, g.colaborador_id)] = g.situacao;
    painel.usuarios[chaveGestor(g.departamento_id, g.colaborador_id)] = g.user_id;
  }
  painel.pendentes = (row?.pendentes ?? []).map((p) => ({
    departamentoId: p.departamento_id,
    autorizadorId: p.autorizador_id,
    autorizador: p.autorizador,
    quantidade: Number(p.quantidade) || 0,
    valor: Number(p.valor) || 0,
  }));
  return painel;
};

const mapDepartamento = (row: DepartamentoRow): Departamento => ({
  id: row.id,
  nome: row.nome,
  ativo: row.ativo,
  aprovadorScId: row.aprovador_sc_id,
  responsavelIds: (row.departamento_responsaveis ?? []).map((r) => r.colaborador_id),
  autorizaPagamentosIds: (row.departamento_responsaveis ?? []).filter((r) => r.autoriza_pagamentos).map((r) => r.colaborador_id),
});

/** Erro do Postgres/PostgREST em mensagem para a tela; o 23505 é o índice único do nome. */
const mensagemDeErro = (erro: { code?: string; message: string }): string =>
  erro.code === '23505' ? 'Já existe um departamento com esse nome.' : erro.message;

interface UseDepartamentosResult {
  departamentos: Departamento[];
  /**
   * Situação de cada gestor e pedidos esperando autorização. null enquanto carrega ou sem
   * canManageDepartamentos (o banco recusa): a tela não acusa "sem gestor" sem saber.
   */
  painel: PainelPagamentos | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** As mutações devolvem a mensagem de erro, ou null se ok. */
  criar: (nome: string) => Promise<string | null>;
  renomear: (id: string, nome: string) => Promise<string | null>;
  /** Desativar é barrado pelo banco enquanto houver colaborador ativo no departamento. */
  definirAtivo: (id: string, ativo: boolean) => Promise<string | null>;
  definirAprovador: (id: string, colaboradorId: string | null) => Promise<string | null>;
  adicionarResponsavel: (id: string, colaboradorId: string) => Promise<string | null>;
  removerResponsavel: (id: string, colaboradorId: string) => Promise<string | null>;
  /** O banco barra desmarcar o último gestor apto ou quem tem pedidos esperando por ele. */
  definirAutorizaPagamentos: (id: string, colaboradorId: string, autoriza: boolean) => Promise<string | null>;
  /** Passa os pedidos que esperam `deUserId` para `paraUserId` e avisa o novo autorizador. */
  transferirAutorizacoes: (id: string, deUserId: string, paraUserId: string) => Promise<string | null>;
}

export function useDepartamentos(): UseDepartamentosResult {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [painel, setPainel] = useState<PainelPagamentos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchDepartamentos = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const [{ data, error: fetchError }, { data: painelData, error: painelError }] = await Promise.all([
        supabase
          .from('departamentos')
          .select('id, nome, ativo, aprovador_sc_id, departamento_responsaveis(colaborador_id, autoriza_pagamentos)')
          .order('nome', { ascending: true }),
        supabase.rpc('departamentos_painel_pagamentos'),
      ]);

      if (fetchError) throw fetchError;
      if (requestIdRef.current !== requestId) return;

      setDepartamentos(((data as DepartamentoRow[] | null) ?? []).map(mapDepartamento));
      // Sem canManageDepartamentos o painel é recusado: a aba segue sem a situação dos gestores.
      if (painelError) console.warn('Painel de gestores indisponível:', painelError.message);
      setPainel(painelError ? null : mapPainel(painelData as PainelRow | null));
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      console.error('Erro ao carregar departamentos:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os departamentos.');
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartamentos();
  }, [fetchDepartamentos]);

  /** Roda a escrita e recarrega a lista; devolve a mensagem de erro, ou null. */
  const executar = useCallback(
    async (escrita: PromiseLike<{ error: { code?: string; message: string } | null }>): Promise<string | null> => {
      try {
        const { error: erro } = await escrita;
        if (erro) return mensagemDeErro(erro);
        await fetchDepartamentos();
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : 'Não foi possível salvar.';
      }
    },
    [fetchDepartamentos],
  );

  const criar = useCallback(
    (nome: string) => executar(supabase.from('departamentos').insert({ nome: nome.trim() })),
    [executar],
  );

  const renomear = useCallback(
    (id: string, nome: string) => executar(supabase.from('departamentos').update({ nome: nome.trim() }).eq('id', id)),
    [executar],
  );

  const definirAtivo = useCallback(
    (id: string, ativo: boolean) => executar(supabase.from('departamentos').update({ ativo }).eq('id', id)),
    [executar],
  );

  const definirAprovador = useCallback(
    (id: string, colaboradorId: string | null) =>
      executar(supabase.from('departamentos').update({ aprovador_sc_id: colaboradorId }).eq('id', id)),
    [executar],
  );

  const adicionarResponsavel = useCallback(
    (id: string, colaboradorId: string) =>
      executar(supabase.from('departamento_responsaveis').insert({ departamento_id: id, colaborador_id: colaboradorId })),
    [executar],
  );

  const removerResponsavel = useCallback(
    (id: string, colaboradorId: string) =>
      executar(
        supabase.from('departamento_responsaveis').delete().eq('departamento_id', id).eq('colaborador_id', colaboradorId),
      ),
    [executar],
  );

  const definirAutorizaPagamentos = useCallback(
    (id: string, colaboradorId: string, autoriza: boolean) =>
      executar(
        supabase
          .from('departamento_responsaveis')
          .update({ autoriza_pagamentos: autoriza })
          .eq('departamento_id', id)
          .eq('colaborador_id', colaboradorId),
      ),
    [executar],
  );

  const transferirAutorizacoes = useCallback(
    async (id: string, deUserId: string, paraUserId: string): Promise<string | null> => {
      try {
        const { data, error: rpcError } = await supabase.rpc('payment_requests_transferir_autorizacao', {
          p_departamento: id,
          p_de: deUserId,
          p_para: paraUserId,
        });
        if (rpcError) return mensagemDeErro(rpcError);
        for (const pedido of (data as string[] | null) ?? []) void notificarPagamento(pedido, 'transferido');
        await fetchDepartamentos();
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : 'Não foi possível transferir.';
      }
    },
    [fetchDepartamentos],
  );

  return {
    departamentos,
    painel,
    loading,
    error,
    refetch: fetchDepartamentos,
    criar,
    renomear,
    definirAtivo,
    definirAprovador,
    adicionarResponsavel,
    removerResponsavel,
    definirAutorizaPagamentos,
    transferirAutorizacoes,
  };
}
