import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { diasDeAtraso } from '../utils/formato';
import type {
  BaixaInput,
  GlosaLancamentoInput,
  OperadoraResumo,
  TituloGuia,
  TituloReceber,
  TitulosFiltros,
  TituloLote,
} from '../types';

// Títulos a receber, suas baixas e glosas.
//
// Diferente do useFaturamentoLotes, a leitura aqui vai DIRETO ao Supabase: os
// títulos moram no Postgres do FlowLab e a RLS instalada em 20260807120000 já
// exige canViewBilling/canManageBilling. Só a criação passa por rota serverless,
// porque ela precisa ler o MySQL do laboratório para congelar o snapshot.
//
// As mutações vão pelas RPCs `fat_*` em vez de INSERTs soltos: uma baixa e as
// glosas que a explicam precisam entrar na mesma transação, senão o saldo do
// título fica mentindo entre um statement e outro.

const TAMANHO_PADRAO = 25;

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// Formato cru devolvido pelo PostgREST — snake_case, com os embeds aninhados.
interface LinhaTitulo {
  id_nota: string;
  numero_nota: string;
  operadora_id: string;
  data_emissao: string;
  data_vencimento: string | null;
  competencia: string | null;
  valor_total: number | string;
  valor_recebido: number | string;
  valor_glosado: number | string;
  valor_saldo: number | string;
  status: TituloReceber['status'];
  observacoes: string | null;
  operadoras: { nome: string } | null;
  nota_lote: {
    lotes: {
      id_lote: string;
      aplis_id: string | null;
      codigo_lote: string;
      status: string | null;
      data_envio: string | null;
      valor_total: number | string;
      qtd_requisicoes: number | null;
    } | null;
  }[] | null;
}

const num = (bruto: number | string | null | undefined): number => {
  const n = Number(bruto ?? 0);
  return Number.isFinite(n) ? n : 0;
};

function normalizar(linha: LinhaTitulo): TituloReceber {
  const lotes: TituloLote[] = (linha.nota_lote ?? [])
    .map((vinculo) => vinculo.lotes)
    .filter((lote): lote is NonNullable<typeof lote> => lote !== null)
    .map((lote) => ({
      id: lote.id_lote,
      aplisId: lote.aplis_id,
      codigoLote: lote.codigo_lote,
      statusLabel: lote.status,
      dataEnvio: lote.data_envio,
      valorTotal: num(lote.valor_total),
      qtdRequisicoes: lote.qtd_requisicoes ?? 0,
    }));

  return {
    id: linha.id_nota,
    numeroNota: linha.numero_nota,
    operadoraId: linha.operadora_id,
    operadoraNome: linha.operadoras?.nome ?? null,
    dataEmissao: linha.data_emissao,
    dataVencimento: linha.data_vencimento,
    competencia: linha.competencia,
    valorTotal: num(linha.valor_total),
    valorRecebido: num(linha.valor_recebido),
    valorGlosado: num(linha.valor_glosado),
    valorSaldo: num(linha.valor_saldo),
    status: linha.status,
    observacoes: linha.observacoes,
    diasAtraso: diasDeAtraso(linha.data_vencimento),
    lotes,
  };
}

interface UseContasReceberResult {
  titulos: TituloReceber[];
  operadoras: OperadoraResumo[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Recarrega o seletor de operadoras — chamado depois de sincronizar com o apLIS. */
  refetchOperadoras: () => Promise<void>;
  /** Guias congeladas de um lote, sob demanda ao expandir a linha. Sempre um
   *  array — nunca undefined, mesmo sem nenhuma guia. */
  buscarGuias: (loteId: string) => Promise<TituloGuia[]>;
  criarTitulo: (dados: {
    idsLote: number[];
    numeroNota: string;
    dataEmissao: string;
    competencia?: string;
    dataVencimento?: string;
    observacoes?: string;
  }) => Promise<string | null>;
  registrarBaixa: (dados: BaixaInput) => Promise<string | null>;
  lancarGlosas: (notaId: string, glosas: GlosaLancamentoInput[]) => Promise<string | null>;
  cancelarTitulo: (notaId: string) => Promise<string | null>;
}

export function useContasReceber(filtros: TitulosFiltros): UseContasReceberResult {
  const [titulos, setTitulos] = useState<TituloReceber[]>([]);
  const [operadoras, setOperadoras] = useState<OperadoraResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Desestruturado para que as deps do useCallback sejam primitivas — com o
  // objeto `filtros` cru, um novo literal a cada render refetcharia em loop.
  const { desde, ate, status, operadoraId, busca, pagina, tamanho } = filtros;

  // Descarta respostas de buscas antigas: trocar de página/filtro rápido pode
  // devolver fora de ordem e sobrescrever o resultado novo com o velho.
  const buscaAtual = useRef(0);

  const refetch = useCallback(async () => {
    const reqId = ++buscaAtual.current;
    setLoading(true);
    setError(null);

    const porPagina = tamanho ?? TAMANHO_PADRAO;
    const inicio = ((pagina ?? 1) - 1) * porPagina;

    try {
      let query = supabase
        .from('notas')
        .select(
          `id_nota, numero_nota, operadora_id, data_emissao, data_vencimento, competencia,
           valor_total, valor_recebido, valor_glosado, valor_saldo, status, observacoes,
           operadoras(nome),
           nota_lote(lotes(id_lote, aplis_id, codigo_lote, status, data_envio, valor_total, qtd_requisicoes))`,
          { count: 'exact' },
        )
        .gte('data_emissao', desde)
        .lte('data_emissao', ate)
        .order('data_vencimento', { ascending: true, nullsFirst: false })
        .order('data_emissao', { ascending: false })
        .range(inicio, inicio + porPagina - 1);

      if (status) query = query.eq('status', status);
      if (operadoraId) query = query.eq('operadora_id', operadoraId);
      if (busca?.trim()) {
        const termo = busca.trim();
        // `%` e `_` do operador viram curinga do LIKE; escapa antes de compor.
        // Aspas duplas escapam vírgula/parênteses do termo dentro do or() do PostgREST.
        const termoLike = termo.replace(/[%_]/g, '\\$&').replace(/"/g, '\\"');
        const condicoes = [
          `numero_nota.ilike."%${termoLike}%"`,
          `competencia.ilike."%${termoLike}%"`,
          `observacoes.ilike."%${termoLike}%"`,
        ];
        // Nome da operadora não dá pra filtrar direto no embed aninhado do or() —
        // resolve os ids pela lista já carregada (mesma origem do dropdown) e
        // inclui como operadora_id.in.(...).
        const idsOperadora = operadoras
          .filter((o) => o.nome.toLowerCase().includes(termo.toLowerCase()))
          .map((o) => o.id);
        if (idsOperadora.length > 0) {
          condicoes.push(`operadora_id.in.(${idsOperadora.join(',')})`);
        }
        query = query.or(condicoes.join(','));
      }

      const { data, count, error: erro } = await query;
      if (reqId !== buscaAtual.current) return;
      if (erro) throw new Error(erro.message);

      setTitulos((data as unknown as LinhaTitulo[] ?? []).map(normalizar));
      setTotal(count ?? 0);
    } catch (err) {
      if (reqId !== buscaAtual.current) return;
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os títulos.');
      setTitulos([]);
      setTotal(0);
    } finally {
      if (reqId === buscaAtual.current) setLoading(false);
    }
  }, [desde, ate, status, operadoraId, busca, pagina, tamanho, operadoras]);

  useEffect(() => {
    void refetch();
    // Invalida a busca em voo no unmount (mesma guarda de useFaturamentoLotes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [refetch]);

  // Lista fixa para o seletor de filtro — não acompanha o período nem a página.
  const refetchOperadoras = useCallback(async () => {
    const { data } = await supabase.from('operadoras').select('id_operadora, nome').order('nome');
    setOperadoras((data ?? []).map((o) => ({ id: o.id_operadora as string, nome: o.nome as string })));
  }, []);

  useEffect(() => {
    void refetchOperadoras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buscarGuias = useCallback(async (loteId: string) => {
    const { data, error: erro } = await supabase
      .from('requisicoes')
      .select('id_requisicao, numero_guia, data_execucao, valor, paciente_nome, procedimento_descricao')
      .eq('lote_id', loteId)
      .order('numero_guia');
    if (erro) throw new Error(erro.message);
    return (data ?? []).map((linha) => ({
      id: linha.id_requisicao as string,
      numeroGuia: linha.numero_guia as string,
      dataExecucao: (linha.data_execucao as string | null) ?? null,
      valor: num(linha.valor as number),
      pacienteNome: (linha.paciente_nome as string | null) ?? null,
      procedimentoDescricao: (linha.procedimento_descricao as string | null) ?? null,
    }));
  }, []);

  const criarTitulo = useCallback(async (dados: {
    idsLote: number[];
    numeroNota: string;
    dataEmissao: string;
    competencia?: string;
    dataVencimento?: string;
    observacoes?: string;
  }): Promise<string | null> => {
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const res = await fetch('/api/faturamento/titulo-criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(dados),
      });
      const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !body.success) throw new Error(body.error || 'Não foi possível criar o título.');

      await refetch();
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível criar o título.';
      setError(msg);
      return msg;
    }
  }, [refetch]);

  const registrarBaixa = useCallback(async (dados: BaixaInput): Promise<string | null> => {
    setError(null);
    try {
      const { error: erro } = await supabase.rpc('fat_registrar_baixa', {
        p: {
          notaId: dados.notaId,
          valorRecebido: dados.valorRecebido,
          dataRecebimento: dados.dataRecebimento,
          bancoNome: dados.bancoNome ?? null,
          bancoConta: dados.bancoConta ?? null,
          formaRecebimento: dados.formaRecebimento ?? null,
          observacoes: dados.observacoes ?? null,
          glosas: dados.glosas.map((g) => ({
            valor: g.valor,
            motivo: g.motivo,
            codigoGlosa: g.codigoGlosa ?? null,
            status: g.status ?? 'aberta',
            requisicaoId: g.requisicaoId ?? null,
            loteId: g.loteId ?? null,
          })),
        },
      });
      if (erro) throw new Error(erro.message);
      await refetch();
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível registrar a baixa.';
      setError(msg);
      return msg;
    }
  }, [refetch]);

  // Glosa avulsa: a que chega no demonstrativo ANTES de qualquer pagamento.
  // INSERT direto, e não fat_registrar_baixa com valor zero — isso criaria uma
  // baixa fantasma de R$ 0 na lista de recebimentos do título. É justamente para
  // esse caso que a migration tornou glosas.recebimento_id nullable. Uma linha
  // só, então não há nada a tornar atômico; a trigger recalcula o saldo.
  const lancarGlosas = useCallback(async (
    notaId: string,
    glosas: GlosaLancamentoInput[],
  ): Promise<string | null> => {
    setError(null);
    if (glosas.length === 0) return null;
    try {
      // Um INSERT só com o array inteiro: as N glosas de um mesmo demonstrativo
      // entram juntas ou não entram, sem precisar de RPC para isso.
      const { error: erro } = await supabase.from('glosas').insert(
        glosas.map((glosa) => ({
          nota_id: notaId,
          recebimento_id: null,
          requisicao_id: glosa.requisicaoId ?? null,
          lote_id: glosa.loteId ?? null,
          valor: glosa.valor,
          motivo: glosa.motivo,
          codigo_glosa: glosa.codigoGlosa ?? null,
          status: glosa.status ?? 'aberta',
        })),
      );
      if (erro) throw new Error(erro.message);
      await refetch();
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível lançar as glosas.';
      setError(msg);
      return msg;
    }
  }, [refetch]);

  // UPDATE direto: cancelar é só uma troca de status, e a trigger de recálculo
  // preserva 'cancelada' em cima de qualquer baixa que já existisse.
  const cancelarTitulo = useCallback(async (notaId: string): Promise<string | null> => {
    setError(null);
    try {
      const { error: erro } = await supabase
        .from('notas')
        .update({ status: 'cancelada' })
        .eq('id_nota', notaId);
      if (erro) throw new Error(erro.message);
      await refetch();
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível cancelar o título.';
      setError(msg);
      return msg;
    }
  }, [refetch]);

  return {
    titulos,
    operadoras,
    total,
    loading,
    error,
    refetch,
    refetchOperadoras,
    buscarGuias,
    criarTitulo,
    registrarBaixa,
    lancarGlosas,
    cancelarTitulo,
  };
}
