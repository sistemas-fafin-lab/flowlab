import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { diasDeAtraso, idsOperadorasConsideradasMeta } from '../utils/formato';
import type {
  BaixaInput,
  GlosaLancamentoInput,
  OperadoraResumo,
  TituloBaixa,
  TituloGuia,
  TituloReceber,
  TitulosFiltros,
  TituloLote,
} from '../types';
import { STATUS_TITULOS_PENDENTES } from '../types';

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

type CampoAuditoriaOperadora = 'is_clinica_parceira' | 'nf_apos_pagamento' | 'is_considerada_meta';

/**
 * Issue 44: registra em `operadoras_audit_logs` a mudança de uma das flags de
 * exceção de operadora. Chamada só depois do UPDATE em `operadoras` ter
 * sucesso — as três funções que alteram essas flags fazem UPDATE direto do
 * client (sem RPC/handler de API no meio), então a auditoria também precisa
 * acontecer aqui, como uma segunda chamada Supabase.
 */
async function registrarAuditoriaOperadora(
  operadoraId: string,
  campo: CampoAuditoriaOperadora,
  valorNovo: boolean,
  motivo?: string,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada — não foi possível registrar a auditoria.');
  const { data: perfil } = await supabase
    .from('user_profiles')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();

  const { error: erro } = await supabase.from('operadoras_audit_logs').insert({
    operadora_id: operadoraId,
    campo,
    valor_anterior: !valorNovo,
    valor_novo: valorNovo,
    motivo: motivo ?? null,
    performed_by: user.id,
    performed_by_name: (perfil?.name as string | undefined) ?? user.email ?? 'Desconhecido',
  });
  if (erro) throw new Error(erro.message);
}

/**
 * Chamada autenticada a uma rota /api/faturamento/*: token da sessão, parsing
 * do corpo e checagem de `success` num lugar só — criarTitulo e
 * buscarEnvioLotes repetiam esse mesmo bloco ponta a ponta.
 */
async function chamarApi<T = unknown>(
  path: string,
  mensagemPadrao: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T & { success?: boolean; error?: string }> {
  const token = await getToken();
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');

  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const body = (await res.json().catch(() => ({}))) as T & { success?: boolean; error?: string };
  if (!res.ok || !body.success) throw new Error(body.error || mensagemPadrao);
  return body;
}

// Formato cru devolvido pelo PostgREST — snake_case, com os embeds aninhados.
interface LinhaTitulo {
  id_nota: string;
  numero_nota: string | null;
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
  updated_at: string;
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
    statusAtualizadoEm: linha.updated_at,
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
  /** `DtaEnvio` ao vivo dos lotes informados (chave = aplisId), direto do apLIS —
   *  issue 15: revalida a expansão do título contra o snapshot desatualizado.
   *  Lança em falha de rede/túnel; quem chama decide o fallback (ver
   *  utils/envioAoVivo.ts), então nunca retorna silenciosamente vazio. */
  buscarEnvioLotes: (idsAplis: string[]) => Promise<Record<string, string | null>>;
  /** Baixas (`recebimentos`) do título, mais recente primeiro, com o nome de
   *  quem registrou já resolvido — issue 39. Sempre um array, nunca undefined. */
  buscarBaixas: (notaId: string) => Promise<TituloBaixa[]>;
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
  /** Issue 33: preenche/corrige o número da nota de um título já existente. */
  atualizarNumeroNota: (notaId: string, numeroNota: string) => Promise<string | null>;
  /** Issue 16: marca/desmarca uma operadora como clínica parceira. `motivo`
   *  é obrigatório (validado na UI) quando `valor` é `false`. */
  marcarClinicaParceira: (operadoraId: string, valor: boolean, motivo?: string) => Promise<string | null>;
  /** Issue 31: marca/desmarca a regra "NF só depois do pagamento" de uma operadora.
   *  `motivo` é obrigatório (validado na UI) quando `valor` é `false`. */
  alternarNfAposPagamento: (operadoraId: string, valor: boolean, motivo?: string) => Promise<string | null>;
  /** Marca/desmarca uma operadora como considerada na meta (whitelist de
   *  negócio, 03/09). `motivo` é obrigatório (validado na UI) quando `valor` é `false`. */
  marcarConsideradaMeta: (operadoraId: string, valor: boolean, motivo?: string) => Promise<string | null>;
}

export function useContasReceber(filtros: TitulosFiltros): UseContasReceberResult {
  const [titulos, setTitulos] = useState<TituloReceber[]>([]);
  const [operadoras, setOperadoras] = useState<OperadoraResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Desestruturado para que as deps do useCallback sejam primitivas — com o
  // objeto `filtros` cru, um novo literal a cada render refetcharia em loop.
  const { desde, ate, status, operadoraId, busca, ocultarParceiras, somentePendentes, pagina, tamanho } = filtros;

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
           valor_total, valor_recebido, valor_glosado, valor_saldo, status, observacoes, updated_at,
           operadoras(nome),
           nota_lote(lotes(id_lote, aplis_id, codigo_lote, status, data_envio, valor_total, qtd_requisicoes))`,
          { count: 'exact' },
        )
        // Issue 40: referência do período é vencimento, não emissão — decisão do
        // setor (2026-09-03). Nula não compara em gte/lte, então título sem
        // vencimento definido fica fora de qualquer range, sem tratamento à parte.
        .gte('data_vencimento', desde)
        .lte('data_vencimento', ate)
        .order('data_vencimento', { ascending: true, nullsFirst: false })
        .order('data_emissao', { ascending: false })
        .range(inicio, inicio + porPagina - 1);

      if (status) {
        query = query.eq('status', status);
      } else if (somentePendentes) {
        // Issue 38: atalho "Somente pendentes" — preset em cima do filtro de Status,
        // só entra quando não há status manual selecionado (ver conflito em TitulosList).
        query = query.in('status', STATUS_TITULOS_PENDENTES);
      }
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
      if (ocultarParceiras) {
        // Issue 16: a marcação mora em `operadoras`, não em `notas` — resolve pelos
        // ids já carregados (mesma origem do <select> de Operadora) e exclui, em vez
        // de embutir `operadoras(is_clinica_parceira)` no select e filtrar em memória,
        // o que quebraria a contagem/paginação server-side.
        const idsParceiras = operadoras.filter((o) => o.isClinicaParceira).map((o) => o.id);
        if (idsParceiras.length > 0) {
          query = query.not('operadora_id', 'in', `(${idsParceiras.join(',')})`);
        }
      }

      // Whitelist de negócio (03/09, sempre ativa — não é opção do usuário como
      // ocultarParceiras acima): só título de operadora marcada is_considerada_meta
      // conta. Antes de `operadoras` carregar (primeiro render) não filtra nada —
      // o efeito abaixo depende de `operadoras` e reexecuta refetch assim que
      // refetchOperadoras resolver, mesmo raciocínio de ordering do bloco acima.
      if (operadoras.length > 0) {
        query = query.in('operadora_id', idsOperadorasConsideradasMeta(operadoras));
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
  }, [desde, ate, status, operadoraId, busca, ocultarParceiras, somentePendentes, pagina, tamanho, operadoras]);

  useEffect(() => {
    void refetch();
    // Invalida a busca em voo no unmount (mesma guarda de useFaturamentoLotes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [refetch]);

  // Lista fixa para o seletor de filtro — não acompanha o período nem a página.
  const refetchOperadoras = useCallback(async () => {
    const { data } = await supabase
      .from('operadoras')
      .select('id_operadora, nome, aplis_id, is_clinica_parceira, nf_apos_pagamento, is_considerada_meta')
      .order('nome');
    setOperadoras((data ?? []).map((o) => ({
      id: o.id_operadora as string,
      nome: o.nome as string,
      aplisId: (o.aplis_id as string | null) ?? null,
      isClinicaParceira: Boolean(o.is_clinica_parceira),
      nfAposPagamento: Boolean(o.nf_apos_pagamento),
      consideradaMeta: Boolean(o.is_considerada_meta),
    })));
  }, []);

  useEffect(() => {
    void refetchOperadoras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buscarGuias = useCallback(async (loteId: string) => {
    const { data, error: erro } = await supabase
      .from('requisicoes')
      .select('id_requisicao, numero_guia, codigo_requisicao, data_execucao, valor, paciente_nome, procedimento_descricao')
      .eq('lote_id', loteId)
      .order('numero_guia');
    if (erro) throw new Error(erro.message);
    return (data ?? []).map((linha) => ({
      id: linha.id_requisicao as string,
      numeroGuia: linha.numero_guia as string,
      codigoRequisicao: (linha.codigo_requisicao as string | null) ?? null,
      dataExecucao: (linha.data_execucao as string | null) ?? null,
      valor: num(linha.valor as number),
      pacienteNome: (linha.paciente_nome as string | null) ?? null,
      procedimentoDescricao: (linha.procedimento_descricao as string | null) ?? null,
    }));
  }, []);

  const buscarEnvioLotes = useCallback(async (idsAplis: string[]): Promise<Record<string, string | null>> => {
    if (idsAplis.length === 0) return {};
    const body = await chamarApi<{ envios?: Record<string, string | null> }>(
      `/api/faturamento/titulo-lotes-envio?idsLote=${idsAplis.join(',')}`,
      'Não foi possível revalidar o envio dos lotes.',
    );
    return body.envios ?? {};
  }, []);

  // Issue 39: histórico de baixas por título, sob demanda ao expandir a linha
  // (mesmo padrão de buscarGuias). `registrado_por_id` referencia auth.users,
  // não user_profiles — sem FK direta entre as duas tabelas o PostgREST não
  // embeda o nome num select só, então resolve em duas idas: as baixas, depois
  // os nomes dos ids distintos encontrados.
  const buscarBaixas = useCallback(async (notaId: string): Promise<TituloBaixa[]> => {
    const { data, error: erro } = await supabase
      .from('recebimentos')
      .select('id_receb, data_receb, valor_recebido, registrado_por_id, created_at')
      .eq('nota_id', notaId)
      .order('data_receb', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (erro) throw new Error(erro.message);
    const linhas = data ?? [];

    const idsUsuarios = [...new Set(
      linhas.map((l) => l.registrado_por_id as string | null).filter((id): id is string => Boolean(id)),
    )];
    let nomePorId: Record<string, string> = {};
    if (idsUsuarios.length > 0) {
      const { data: perfis, error: erroPerfis } = await supabase
        .from('user_profiles')
        .select('id, name')
        .in('id', idsUsuarios);
      if (erroPerfis) throw new Error(erroPerfis.message);
      nomePorId = Object.fromEntries((perfis ?? []).map((p) => [p.id as string, p.name as string]));
    }

    return linhas.map((linha) => ({
      id: linha.id_receb as string,
      dataReceb: (linha.data_receb as string | null) ?? null,
      valorRecebido: num(linha.valor_recebido as number),
      registradoPorNome: linha.registrado_por_id
        ? (nomePorId[linha.registrado_por_id as string] ?? null)
        : null,
      createdAt: linha.created_at as string,
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
      await chamarApi(
        '/api/faturamento/titulo-criar',
        'Não foi possível criar o título.',
        { method: 'POST', body: dados },
      );

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

  // Issue 33: via API (não supabase.rpc() direto) — ver o comentário do
  // handler sobre por que este segue o padrão em vez de fat_registrar_baixa.
  const atualizarNumeroNota = useCallback(async (
    notaId: string,
    numeroNota: string,
  ): Promise<string | null> => {
    setError(null);
    try {
      await chamarApi(
        '/api/faturamento/titulo-atualizar-numero-nota',
        'Não foi possível atualizar o número da nota.',
        { method: 'POST', body: { idNota: notaId, numeroNota } },
      );
      await refetch();
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível atualizar o número da nota.';
      setError(msg);
      return msg;
    }
  }, [refetch]);

  // Issue 16: UPDATE direto, sem RPC — é uma marcação de negócio isolada, sem
  // invariante cruzando outra tabela. Gate de canManageBilling já é a RLS de
  // `operadoras` (política `_update_billing` de 20260807120000); o front só
  // repete o gate pra esconder o controle de quem não pode usá-lo.
  const marcarClinicaParceira = useCallback(async (
    operadoraId: string,
    valor: boolean,
    motivo?: string,
  ): Promise<string | null> => {
    try {
      const { error: erro } = await supabase
        .from('operadoras')
        .update({ is_clinica_parceira: valor })
        .eq('id_operadora', operadoraId);
      if (erro) throw new Error(erro.message);
      await refetchOperadoras();
    } catch (err) {
      return err instanceof Error ? err.message : 'Não foi possível atualizar a operadora.';
    }
    // A marcação já foi persistida e refletida na tela acima — uma falha aqui
    // é só do registro de auditoria, não deve ser reportada como se o toggle
    // tivesse falhado.
    try {
      await registrarAuditoriaOperadora(operadoraId, 'is_clinica_parceira', valor, motivo);
      return null;
    } catch (err) {
      const detalhe = err instanceof Error ? err.message : 'motivo desconhecido';
      return `Operadora atualizada, mas o registro de auditoria falhou: ${detalhe}`;
    }
  }, [refetchOperadoras]);

  // Issue 31: mesmo padrão de marcarClinicaParceira acima — UPDATE direto,
  // mesma RLS (`_update_billing`), mesma marcação de negócio isolada.
  const alternarNfAposPagamento = useCallback(async (
    operadoraId: string,
    valor: boolean,
    motivo?: string,
  ): Promise<string | null> => {
    try {
      const { error: erro } = await supabase
        .from('operadoras')
        .update({ nf_apos_pagamento: valor })
        .eq('id_operadora', operadoraId);
      if (erro) throw new Error(erro.message);
      await refetchOperadoras();
    } catch (err) {
      return err instanceof Error ? err.message : 'Não foi possível atualizar a operadora.';
    }
    // A marcação já foi persistida e refletida na tela acima — uma falha aqui
    // é só do registro de auditoria, não deve ser reportada como se o toggle
    // tivesse falhado.
    try {
      await registrarAuditoriaOperadora(operadoraId, 'nf_apos_pagamento', valor, motivo);
      return null;
    } catch (err) {
      const detalhe = err instanceof Error ? err.message : 'motivo desconhecido';
      return `Operadora atualizada, mas o registro de auditoria falhou: ${detalhe}`;
    }
  }, [refetchOperadoras]);

  // Mesmo padrão de marcarClinicaParceira/alternarNfAposPagamento acima — UPDATE
  // direto, mesma RLS (`_update_billing`), mesma marcação de negócio isolada.
  const marcarConsideradaMeta = useCallback(async (
    operadoraId: string,
    valor: boolean,
    motivo?: string,
  ): Promise<string | null> => {
    try {
      const { error: erro } = await supabase
        .from('operadoras')
        .update({ is_considerada_meta: valor })
        .eq('id_operadora', operadoraId);
      if (erro) throw new Error(erro.message);
      await refetchOperadoras();
    } catch (err) {
      return err instanceof Error ? err.message : 'Não foi possível atualizar a operadora.';
    }
    // A marcação já foi persistida e refletida na tela acima — uma falha aqui
    // é só do registro de auditoria, não deve ser reportada como se o toggle
    // tivesse falhado.
    try {
      await registrarAuditoriaOperadora(operadoraId, 'is_considerada_meta', valor, motivo);
      return null;
    } catch (err) {
      const detalhe = err instanceof Error ? err.message : 'motivo desconhecido';
      return `Operadora atualizada, mas o registro de auditoria falhou: ${detalhe}`;
    }
  }, [refetchOperadoras]);

  return {
    titulos,
    operadoras,
    total,
    loading,
    error,
    refetch,
    refetchOperadoras,
    buscarGuias,
    buscarEnvioLotes,
    buscarBaixas,
    criarTitulo,
    registrarBaixa,
    lancarGlosas,
    cancelarTitulo,
    atualizarNumeroNota,
    marcarClinicaParceira,
    alternarNfAposPagamento,
    marcarConsideradaMeta,
  };
}
