import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { diasDeAtraso } from '../utils/formato';
import { padraoContem, valorCitadoPostgrest } from '../utils/buscaLike';
import { GLOSAS_ZERADAS, somarGlosasDoTitulo } from '../../../../api/_lib/faturamento/recursoGlosa.js';
import type {
  AlteracaoLancamento,
  BaixaInput,
  CancelamentoNfAnterior,
  CorrecaoLancamentoPayload,
  GlosaAplisTitulo,
  GlosaLancada,
  GlosaStatus,
  GlosasTitulo,
  LancamentosTitulo,
  NfCancelada,
  OperadoraResumo,
  TituloBaixa,
  TituloGuia,
  TituloReceber,
  TitulosFiltros,
  TituloLote,
} from '../types';
import { STATUS_GLOSA_EM_DISPUTA, STATUS_TITULOS_PENDENTES } from '../types';

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
/** Linhas por ida ao banco nas somas dos cards — o teto padrão do PostgREST. */
const FATIA_SOMA = 1000;

/** Somas dos cards da aba Títulos, sobre o recorte inteiro (todas as páginas). */
export interface TotaisTitulos {
  recebido: number;
  saldo: number;
  /** Glosado, Glosa recebida e Glosa acatada da foto do apLIS; null se a leitura falhou. */
  glosas: GlosasTitulo | null;
}

const centavos = (valor: number) => Math.round(valor * 100) / 100;
const TOTAIS_ZERADOS: TotaisTitulos = { recebido: 0, saldo: 0, glosas: GLOSAS_ZERADAS };

/** `lotes.aplis_id` (texto) → `fatlote.IdLote`; lote criado fora do apLIS fica de
 *  fora, e o mesmo lote vinculado duas vezes conta uma, como no saldo do banco. */
function idsAplis(aplisIds: (string | null | undefined)[]): number[] {
  return [...new Set(aplisIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0))];
}

/** Glosado, Glosa recebida e Glosa acatada por lote de faturamento, da foto de
 *  Glosas e Recursos (POST /api/faturamento/titulos-glosas-aplis). */
async function buscarGlosasAplisPorLote(lotes: number[]): Promise<Map<number, GlosasTitulo>> {
  if (lotes.length === 0) return new Map();
  const { porLote } = await chamarApi<{ porLote: Record<string, GlosasTitulo> }>(
    '/api/faturamento/titulos-glosas-aplis',
    'Não foi possível ler as glosas do apLIS.',
    { method: 'POST', body: { lotes: [...new Set(lotes)] } },
  );
  return new Map(Object.entries(porLote).map(([id, glosas]) => [Number(id), glosas]));
}

/** Nome (`user_profiles.name`) por id. `registrado_por_id` referencia
 *  auth.users, não user_profiles — sem FK direta o PostgREST não embeda o nome
 *  num select só, então resolve numa segunda ida. */
async function nomesDosUsuarios(ids: (string | null)[]): Promise<Record<string, string>> {
  const distintos = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (distintos.length === 0) return {};
  const { data, error } = await supabase.from('user_profiles').select('id, name').in('id', distintos);
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((p) => [p.id as string, p.name as string]));
}

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
export async function chamarApi<T = unknown>(
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

/** Uma baixa (com suas glosas) pela RPC `fat_registrar_baixa`, sem reler nada.
 *  Também usado pelo "Aplicar baixas e glosas do apLIS", que lança várias em sequência. */
export async function rpcRegistrarBaixa(dados: BaixaInput): Promise<void> {
  const { error } = await supabase.rpc('fat_registrar_baixa', {
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
  if (error) throw new Error(error.message);
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
      protocolo: string | null;
      valor_total: number | string;
      qtd_requisicoes: number | null;
      responsavel_fechamento: string | null;
    } | null;
  }[] | null;
}

const SELECT_TITULO = `id_nota, numero_nota, operadora_id, data_emissao, data_vencimento, competencia,
  valor_total, valor_recebido, valor_saldo, status, observacoes, updated_at,
  operadoras(nome),
  nota_lote(lotes(id_lote, aplis_id, codigo_lote, status, data_envio, protocolo, valor_total, qtd_requisicoes, responsavel_fechamento))`;

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
      protocolo: lote.protocolo,
      valorTotal: num(lote.valor_total),
      qtdRequisicoes: lote.qtd_requisicoes ?? 0,
      responsavelFechamento: lote.responsavel_fechamento,
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
    valorSaldo: num(linha.valor_saldo),
    // Preenchido pelo refetch, depois da leitura da foto do apLIS.
    glosasAplis: null,
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
  /** Somas de recebido, glosas e saldo de todos os títulos do recorte (todas as páginas). */
  totais: TotaisTitulos;
  loading: boolean;
  error: string | null;
  /** Falha ao ler as glosas do apLIS: a lista segue, com as três colunas em "—". */
  erroGlosasAplis: string | null;
  refetch: () => Promise<void>;
  /** Recarrega o seletor de operadoras — chamado depois de sincronizar com o apLIS. */
  refetchOperadoras: () => Promise<void>;
  /** Um título pelo id, fora dos filtros da lista — a conferência com o apLIS
   *  abre títulos que não estão na página atual. */
  buscarTitulo: (notaId: string) => Promise<TituloReceber>;
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
  /** Glosas do apLIS dos lotes do título (`lotes.aplis_id`), uma por requisição. */
  buscarGlosasAplis: (lotesAplis: number[]) => Promise<GlosaAplisTitulo[]>;
  /** Baixas (com todos os campos digitados e as glosas de cada uma) e glosas
   *  sem baixa do título, para a correção pelo "Editar título". */
  buscarLancamentos: (notaId: string) => Promise<LancamentosTitulo>;
  /** Histórico de correções de lançamentos do título, mais recente primeiro. */
  buscarAlteracoes: (notaId: string) => Promise<AlteracaoLancamento[]>;
  /** NFs anteriores do título canceladas no portal da prefeitura, mais recente
   *  primeiro (.scratch/faturamento-nf-cancelada). */
  buscarNfsCanceladas: (notaId: string) => Promise<NfCancelada[]>;
  /** Corrige uma baixa (ou as glosas sem baixa) — ver utils/correcaoLancamento.ts. */
  corrigirLancamento: (payload: CorrecaoLancamentoPayload) => Promise<string | null>;
  /** Exclui uma baixa e as glosas dela, com motivo obrigatório. */
  excluirBaixa: (recebimentoId: string, motivo: string) => Promise<string | null>;
  criarTitulo: (dados: {
    idsLote: number[];
    numeroNota: string;
    dataEmissao: string;
    competencia?: string;
    dataVencimento?: string;
    observacoes?: string;
  }) => Promise<string | null>;
  registrarBaixa: (dados: BaixaInput) => Promise<string | null>;
  cancelarTitulo: (notaId: string) => Promise<string | null>;
  /** Issue 33: preenche/corrige o número da nota de um título já existente.
   *  Com `cancelamento`, a NF anterior entra no histórico de NFs canceladas. */
  atualizarNumeroNota: (
    notaId: string,
    numeroNota: string,
    cancelamento?: CancelamentoNfAnterior,
  ) => Promise<string | null>;
  /** Issue 46: remove o vínculo de um lote a um título já existente, com motivo
   *  obrigatório. Bloqueado pela RPC se o título já tem baixa registrada, está
   *  cancelado, ou o lote é o único do título. */
  desvincularLote: (notaId: string, loteId: string, motivo: string) => Promise<string | null>;
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
  const [totais, setTotais] = useState<TotaisTitulos>(TOTAIS_ZERADOS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [erroGlosasAplis, setErroGlosasAplis] = useState<string | null>(null);

  // Desestruturado para que as deps do useCallback sejam primitivas — com o
  // objeto `filtros` cru, um novo literal a cada render refetcharia em loop.
  const {
    desde, ate, status, operadoraId, busca, ocultarParceiras, somentePendentes, glosa,
    divergenteAplis, idsDivergentesAplis, pagina, tamanho,
  } = filtros;

  // Descarta respostas de buscas antigas: trocar de página/filtro rápido pode
  // devolver fora de ordem e sobrescrever o resultado novo com o velho.
  const buscaAtual = useRef(0);

  const refetch = useCallback(async () => {
    const reqId = ++buscaAtual.current;
    setLoading(true);
    setError(null);
    setErroGlosasAplis(null);

    const porPagina = tamanho ?? TAMANHO_PADRAO;
    const inicio = ((pagina ?? 1) - 1) * porPagina;

    // Filtro "Divergente do apLIS" sem divergente a mostrar (ou sem a
    // conferência, que a tela avisa à parte): nem vai ao banco — `in.()`
    // vazio e "ignorar o filtro" seriam as duas respostas erradas.
    if (divergenteAplis && (!idsDivergentesAplis || idsDivergentesAplis.length === 0)) {
      setTitulos([]);
      setTotal(0);
      setTotais(TOTAIS_ZERADOS);
      setLoading(false);
      return;
    }

    try {
      // Resolvidos antes de montar as consultas: a busca por código de lote
      // precisa de uma ida ao banco, e as duas consultas abaixo usam o mesmo recorte.
      let condicoesBusca: string | null = null;
      if (busca?.trim()) {
        const termo = busca.trim();
        // `%` e `_` digitados são literais, não curinga — ver utils/buscaLike.ts
        // (dentro do or() o escape precisa sobreviver ao parser do PostgREST).
        const padrao = padraoContem(termo);
        const citado = valorCitadoPostgrest(padrao);
        const condicoes = [
          `numero_nota.ilike.${citado}`,
          `competencia.ilike.${citado}`,
          `observacoes.ilike.${citado}`,
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
        // Código do lote também mora numa tabela à parte (nota_lote é N:N com
        // lotes) — mesma resolução em dois passos usada acima pra operadora:
        // busca os títulos vinculados a lotes cujo código ou protocolo bate e
        // inclui os ids no or() como `id_nota.in.(...)`.
        const { data: lotesBatidos } = await supabase
          .from('nota_lote')
          .select('id_nota, lotes!inner(codigo_lote, protocolo)')
          .or(`codigo_lote.ilike.${citado},protocolo.ilike.${citado}`, { referencedTable: 'lotes' });
        const idsPorLote = [...new Set((lotesBatidos ?? []).map((l) => l.id_nota as string))];
        if (idsPorLote.length > 0) {
          condicoes.push(`id_nota.in.(${idsPorLote.join(',')})`);
        }
        condicoesBusca = condicoes.join(',');
      }
      if (reqId !== buscaAtual.current) return;

      // Issue 16: a marcação mora em `operadoras`, não em `notas` — resolve pelos
      // ids já carregados (mesma origem do <select> de Operadora) e exclui, em vez
      // de embutir `operadoras(is_clinica_parceira)` no select e filtrar em memória,
      // o que quebraria a contagem/paginação server-side.
      const idsParceiras = ocultarParceiras
        ? operadoras.filter((o) => o.isClinicaParceira).map((o) => o.id)
        : [];

      /** `notas` com todos os filtros da tela, sem ordem nem paginação. */
      const filtrada = (colunas: string, opcoes?: { count: 'exact' }) => {
        let query = supabase
          .from('notas')
          .select(`${colunas}${glosa ? ', glosas(id_glosa)' : ''}`, opcoes)
          // Referência do período é a EMISSÃO (revisão de 2026-09-24 sobre a
          // issue 40, que tinha escolhido vencimento): filtrar por vencimento
          // fazia um título emitido em agosto sumir do período de agosto. A
          // emissão nunca é nula, então nenhum título fica fora de todo range.
          .gte('data_emissao', desde)
          .lte('data_emissao', ate);

        if (status) {
          query = query.eq('status', status);
        } else if (somentePendentes) {
          // Issue 38: atalho "Somente pendentes" — preset em cima do filtro de Status,
          // só entra quando não há status manual selecionado (ver conflito em TitulosList).
          query = query.in('status', STATUS_TITULOS_PENDENTES);
        }
        if (operadoraId) query = query.eq('operadora_id', operadoraId);
        // Os ids vêm da conferência (rota própria, MySQL do apLIS) — recorte no
        // servidor para contagem e paginação continuarem certas.
        if (divergenteAplis && idsDivergentesAplis) query = query.in('id_nota', idsDivergentesAplis);
        // Filtro "Glosa": o embed `glosas(id_glosa)` só entra no select quando o
        // filtro está ativo, e o recorte é feito no servidor (is null / not is null
        // sobre o embed), então contagem e paginação continuam certas.
        if (glosa === 'com') {
          query = query.not('glosas', 'is', null);
        } else if (glosa === 'aberta') {
          query = query.in('glosas.status', STATUS_GLOSA_EM_DISPUTA).not('glosas', 'is', null);
        } else if (glosa === 'sem') {
          query = query.is('glosas', null);
        }
        if (condicoesBusca) query = query.or(condicoesBusca);
        if (idsParceiras.length > 0) {
          query = query.not('operadora_id', 'in', `(${idsParceiras.join(',')})`);
        }

        // Issue 37: título é lançamento manual do setor, não uma agregação de
        // meta — NÃO filtra por is_considerada_meta aqui (ao contrário do
        // Dashboard/Pendências/AgingDetalheModal, que agregam só as fontes da
        // whitelist). Removido: um filtro incondicional que tinha sido
        // adicionado por engano nesta query, escondendo títulos reais de
        // operadora fora da whitelist mesmo com o dropdown já corrigido.
        return query;
      };

      // Cards de totais da aba Títulos: soma do recorte inteiro, não da página.
      // Lido em fatias porque o PostgREST corta cada resposta em 1000 linhas.
      // Recebido e saldo saem de `notas`; as glosas, dos lotes de cada título
      // (`lotesPorTitulo`), somadas depois de ler a foto do apLIS.
      const somarTotais = async (): Promise<{ recebido: number; saldo: number; lotesPorTitulo: number[][] }> => {
        const soma = { recebido: 0, saldo: 0 };
        const lotesPorTitulo: number[][] = [];
        for (let deslocamento = 0; ; deslocamento += FATIA_SOMA) {
          const { data: fatia, error: erroFatia } = await filtrada('valor_recebido, valor_saldo, nota_lote(lotes(aplis_id))')
            .order('id_nota')
            .range(deslocamento, deslocamento + FATIA_SOMA - 1);
          if (erroFatia) throw new Error(erroFatia.message);
          const linhas = (fatia ?? []) as unknown as {
            valor_recebido: number | string;
            valor_saldo: number | string;
            nota_lote: { lotes: { aplis_id: string | null } | null }[] | null;
          }[];
          for (const linha of linhas) {
            soma.recebido += num(linha.valor_recebido);
            soma.saldo += num(linha.valor_saldo);
            lotesPorTitulo.push(idsAplis((linha.nota_lote ?? []).map((v) => v.lotes?.aplis_id)));
          }
          if (linhas.length < FATIA_SOMA) {
            return { recebido: centavos(soma.recebido), saldo: centavos(soma.saldo), lotesPorTitulo };
          }
        }
      };

      const [{ data, count, error: erro }, somas] = await Promise.all([
        filtrada(SELECT_TITULO, { count: 'exact' })
          .order('data_vencimento', { ascending: true, nullsFirst: false })
          .order('data_emissao', { ascending: false })
          .range(inicio, inicio + porPagina - 1),
        somarTotais(),
      ]);
      if (reqId !== buscaAtual.current) return;
      if (erro) throw new Error(erro.message);
      const daPagina = (data as unknown as LinhaTitulo[] ?? []).map(normalizar);

      // Os lotes da página estão entre os do recorte: uma ida só ao apLIS.
      // Falha aqui não derruba a lista — só as três colunas de glosa ficam em "—".
      let porLote: Map<number, GlosasTitulo> | null = null;
      try {
        porLote = await buscarGlosasAplisPorLote(somas.lotesPorTitulo.flat());
      } catch (errGlosas) {
        if (reqId !== buscaAtual.current) return;
        setErroGlosasAplis(errGlosas instanceof Error ? errGlosas.message : 'Não foi possível ler as glosas do apLIS.');
      }
      if (reqId !== buscaAtual.current) return;

      // O total é a soma das colunas dos títulos: os lotes de todos juntos.
      const glosasDosLotes = (lotes: number[]) => (porLote ? somarGlosasDoTitulo(lotes, porLote) : null);
      setTitulos(daPagina.map((t) => ({ ...t, glosasAplis: glosasDosLotes(idsAplis(t.lotes.map((l) => l.aplisId))) })));
      setTotal(count ?? 0);
      setTotais({ recebido: somas.recebido, saldo: somas.saldo, glosas: glosasDosLotes(somas.lotesPorTitulo.flat()) });
    } catch (err) {
      if (reqId !== buscaAtual.current) return;
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os títulos.');
      setTitulos([]);
      setTotal(0);
      setTotais(TOTAIS_ZERADOS);
    } finally {
      if (reqId === buscaAtual.current) setLoading(false);
    }
  }, [
    desde, ate, status, operadoraId, busca, ocultarParceiras, somentePendentes, glosa,
    divergenteAplis, idsDivergentesAplis, pagina, tamanho, operadoras,
  ]);

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

  const buscarTitulo = useCallback(async (notaId: string): Promise<TituloReceber> => {
    const { data, error: erro } = await supabase
      .from('notas')
      .select(SELECT_TITULO)
      .eq('id_nota', notaId)
      .maybeSingle();
    if (erro) throw new Error(erro.message);
    if (!data) throw new Error('Título não encontrado.');
    return normalizar(data as unknown as LinhaTitulo);
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
  // (mesmo padrão de buscarGuias).
  const buscarBaixas = useCallback(async (notaId: string): Promise<TituloBaixa[]> => {
    const { data, error: erro } = await supabase
      .from('recebimentos')
      .select('id_receb, data_receb, valor_recebido, registrado_por_id, created_at')
      .eq('nota_id', notaId)
      .order('data_receb', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (erro) throw new Error(erro.message);
    const linhas = data ?? [];
    const nomePorId = await nomesDosUsuarios(linhas.map((l) => l.registrado_por_id as string | null));

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

  // Glosas do apLIS do título para a linha expandida: de onde vêm as colunas
  // Glosado, Glosa recebida e Glosa acatada (foto de Glosas e Recursos).
  const buscarGlosasAplis = useCallback(async (lotesAplis: number[]): Promise<GlosaAplisTitulo[]> => {
    if (lotesAplis.length === 0) return [];
    const { glosas } = await chamarApi<{ glosas: GlosaAplisTitulo[] }>(
      `/api/faturamento/titulo-glosas-aplis?lotes=${[...new Set(lotesAplis)].join(',')}`,
      'Não foi possível ler as glosas do apLIS.',
    );
    return glosas;
  }, []);

  // Correção de lançamentos (.scratch/titulos-edicao-lancamentos): baixas com
  // todos os campos digitados, cada uma com as glosas lançadas junto, mais as
  // glosas sem baixa ("Lançar glosa" e backfill).
  const buscarLancamentos = useCallback(async (notaId: string): Promise<LancamentosTitulo> => {
    const [recebimentos, glosas] = await Promise.all([
      supabase
        .from('recebimentos')
        .select('id_receb, data_receb, valor_recebido, forma_recebimento, banco_nome, banco_conta, observacoes, registrado_por_id, created_at')
        .eq('nota_id', notaId)
        // Só as que contam no recebido do título (filtro de fat_recalcular_nota);
        // as 'previsto' do legado não são pagamento e a RPC recusa corrigi-las.
        .in('status', ['recebido', 'parcial'])
        .order('data_receb', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('glosas')
        .select('id_glosa, recebimento_id, valor, motivo, requisicao_id, lote_id, status')
        .eq('nota_id', notaId)
        .order('created_at', { ascending: true }),
    ]);
    if (recebimentos.error) throw new Error(recebimentos.error.message);
    if (glosas.error) throw new Error(glosas.error.message);

    const porBaixa = new Map<string | null, GlosaLancada[]>();
    for (const linha of glosas.data ?? []) {
      const chave = (linha.recebimento_id as string | null) ?? null;
      const lista = porBaixa.get(chave) ?? [];
      lista.push({
        id: linha.id_glosa as string,
        valor: num(linha.valor as number),
        motivo: (linha.motivo as string | null) ?? '',
        requisicaoId: (linha.requisicao_id as string | null) ?? null,
        loteId: (linha.lote_id as string | null) ?? null,
        status: linha.status as GlosaStatus,
      });
      porBaixa.set(chave, lista);
    }

    const linhas = recebimentos.data ?? [];
    const nomePorId = await nomesDosUsuarios(linhas.map((l) => l.registrado_por_id as string | null));
    return {
      baixas: linhas.map((linha) => ({
        id: linha.id_receb as string,
        valorRecebido: num(linha.valor_recebido as number),
        dataReceb: (linha.data_receb as string | null) ?? null,
        formaRecebimento: (linha.forma_recebimento as string | null) ?? null,
        bancoNome: (linha.banco_nome as string | null) ?? null,
        bancoConta: (linha.banco_conta as string | null) ?? null,
        observacoes: (linha.observacoes as string | null) ?? null,
        registradoPorNome: linha.registrado_por_id
          ? (nomePorId[linha.registrado_por_id as string] ?? null)
          : null,
        glosas: porBaixa.get(linha.id_receb as string) ?? [],
      })),
      glosasSemBaixa: porBaixa.get(null) ?? [],
    };
  }, []);

  const buscarAlteracoes = useCallback(async (notaId: string): Promise<AlteracaoLancamento[]> => {
    const { data, error: erro } = await supabase
      .from('notas_lancamentos_audit_logs')
      .select('id, entidade, acao, campo, valor_anterior, valor_novo, motivo, performed_by_name, performed_at')
      .eq('nota_id', notaId)
      .order('performed_at', { ascending: false });
    if (erro) throw new Error(erro.message);
    return (data ?? []).map((linha) => ({
      id: linha.id as string,
      entidade: linha.entidade as AlteracaoLancamento['entidade'],
      acao: linha.acao as AlteracaoLancamento['acao'],
      campo: (linha.campo as string | null) ?? null,
      valorAnterior: (linha.valor_anterior as string | null) ?? null,
      valorNovo: (linha.valor_novo as string | null) ?? null,
      motivo: linha.motivo as string,
      feitoPorNome: linha.performed_by_name as string,
      feitoEm: linha.performed_at as string,
    }));
  }, []);

  // A RLS de fat_nfs_canceladas já restringe a leitura a canViewBilling ou
  // canManageBilling.
  const buscarNfsCanceladas = useCallback(async (notaId: string): Promise<NfCancelada[]> => {
    const { data, error: erro } = await supabase
      .from('fat_nfs_canceladas')
      .select('id, numero_nota, data_cancelamento, motivo, registrado_por_nome')
      .eq('nota_id', notaId)
      .order('data_cancelamento', { ascending: false })
      .order('registrado_em', { ascending: false });
    if (erro) throw new Error(erro.message);
    return (data ?? []).map((linha) => ({
      id: linha.id as string,
      numeroNota: linha.numero_nota as string,
      dataCancelamento: linha.data_cancelamento as string,
      motivo: linha.motivo as string,
      registradoPorNome: linha.registrado_por_nome as string,
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
      await rpcRegistrarBaixa(dados);
      await refetch();
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível registrar a baixa.';
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

  // RPC direto, como fat_registrar_baixa: não depende de nada que o navegador
  // não alcance, e a RPC revalida canManageBilling e grava a auditoria na
  // mesma transação.
  const corrigirLancamento = useCallback(async (
    payload: CorrecaoLancamentoPayload,
  ): Promise<string | null> => {
    setError(null);
    try {
      const { error: erro } = await supabase.rpc('fat_corrigir_lancamento', { p: payload });
      if (erro) throw new Error(erro.message);
      await refetch();
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível corrigir o lançamento.';
      setError(msg);
      return msg;
    }
  }, [refetch]);

  const excluirBaixa = useCallback(async (recebimentoId: string, motivo: string): Promise<string | null> => {
    setError(null);
    try {
      const { error: erro } = await supabase.rpc('fat_excluir_baixa', {
        p_recebimento_id: recebimentoId,
        p_motivo: motivo,
      });
      if (erro) throw new Error(erro.message);
      await refetch();
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível excluir a baixa.';
      setError(msg);
      return msg;
    }
  }, [refetch]);

  // Issue 33: via API (não supabase.rpc() direto) — ver o comentário do
  // handler sobre por que este segue o padrão em vez de fat_registrar_baixa.
  const atualizarNumeroNota = useCallback(async (
    notaId: string,
    numeroNota: string,
    cancelamento?: CancelamentoNfAnterior,
  ): Promise<string | null> => {
    setError(null);
    const body = {
      idNota: notaId,
      numeroNota,
      ...(cancelamento && {
        nfAnteriorCancelada: true,
        motivoCancelamento: cancelamento.motivo,
        dataCancelamento: cancelamento.dataCancelamento,
      }),
    };
    try {
      await chamarApi(
        '/api/faturamento/titulo-atualizar-numero-nota',
        'Não foi possível atualizar o número da nota.',
        { method: 'POST', body },
      );
      await refetch();
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível atualizar o número da nota.';
      setError(msg);
      return msg;
    }
  }, [refetch]);

  // Issue 46: via API (não supabase.rpc() direto), mesmo padrão de
  // atualizarNumeroNota acima. Ao contrário de marcarClinicaParceira/etc., a
  // RPC grava o log de auditoria na mesma transação — não há passo de
  // auditoria separado a repetir aqui.
  const desvincularLote = useCallback(async (
    notaId: string,
    loteId: string,
    motivo: string,
  ): Promise<string | null> => {
    setError(null);
    try {
      await chamarApi(
        '/api/faturamento/titulo-desvincular-lote',
        'Não foi possível desvincular o lote.',
        { method: 'POST', body: { idNota: notaId, idLote: loteId, motivo } },
      );
      await refetch();
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível desvincular o lote.';
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
    totais,
    loading,
    error,
    erroGlosasAplis,
    refetch,
    refetchOperadoras,
    buscarTitulo,
    buscarGuias,
    buscarEnvioLotes,
    buscarBaixas,
    buscarGlosasAplis,
    buscarLancamentos,
    buscarAlteracoes,
    buscarNfsCanceladas,
    corrigirLancamento,
    excluirBaixa,
    criarTitulo,
    registrarBaixa,
    cancelarTitulo,
    atualizarNumeroNota,
    desvincularLote,
    marcarClinicaParceira,
    alternarNfAposPagamento,
    marcarConsideradaMeta,
  };
}
