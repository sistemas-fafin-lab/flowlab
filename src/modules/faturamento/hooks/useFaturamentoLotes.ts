import { useCallback } from 'react';
import type {
  LoteFaturamento,
  LotesFiltros,
  LotesMeta,
  RequisicaoLote,
} from '../types';
import { buscarDetalheLegadoComCache } from './legado/api';
import { useLegadoListagem } from './legado/useLegadoListagem';

// Lista os lotes de faturamento pela rota /api/faturamento/lotes e o detalhe de um
// lote (requisições + procedimentos) pela /api/faturamento/lote-detalhe.
//
// Não lê o Supabase: os dados vêm do MySQL de backup do laboratório, cujas credenciais
// são server-side, então a consulta passa pela function, que valida o JWT da sessão +
// canViewBilling. Por isso é um hook à parte de useContasReceber/useGlosas — cada um
// com seu próprio par loading/error, para uma busca de faturas não piscar o spinner
// das outras abas.
//
// O esqueleto de cache/guarda-de-corrida/fetch (comum a useGlosasLegado e
// useRecursosLegado) mora em ./legado/useLegadoListagem.

// Cache de sessão (module-level): evita refetch ao alternar páginas ou abas. O
// servidor também tem cache (TTL 3 min), então o pior caso já é rápido. Expira no
// F5 porque é memória; o "Atualizar" chama refetch direto, que ignora o cache.
const cacheSessao = new Map<string, { itens: LoteFaturamento[]; meta: LotesMeta }>();
const cacheDetalheSessao = new Map<number, RequisicaoLote[]>();

interface RespostaLotes {
  success?: boolean;
  error?: string;
  meta?: LotesMeta;
  lotes?: LoteFaturamento[];
}

interface RespostaDetalhe {
  success?: boolean;
  error?: string;
  requisicoes?: RequisicaoLote[];
}

const MENSAGEM_ERRO_PADRAO = 'Não foi possível consultar o faturamento.';

interface UseFaturamentoLotesResult {
  lotes: LoteFaturamento[];
  meta: LotesMeta | null;
  loading: boolean;
  error: string | null;
  refetch: (force?: boolean) => Promise<void>;
  /**
   * Requisições do lote com seus procedimentos, sob demanda ao expandir a linha.
   * `force` fura o cache de sessão e o do servidor — é o caminho do "Atualizar".
   */
  buscarRequisicoes: (idLote: number, force?: boolean) => Promise<RequisicaoLote[]>;
}

export function useFaturamentoLotes(filtros: LotesFiltros): UseFaturamentoLotesResult {
  const { itens: lotes, meta, loading, error, refetch } = useLegadoListagem<
    LoteFaturamento,
    LotesFiltros,
    LotesMeta,
    RespostaLotes
  >({
    filtros,
    rota: 'lotes',
    cache: cacheSessao,
    chaveCache: (f) =>
      `${f.periodoIni}|${f.periodoFim}|${f.pagina ?? 1}|${f.tamanho ?? 50}|${f.statusLote ?? ''}|${f.busca ?? ''}`,
    montarParams: (f, force) => {
      const params = new URLSearchParams({ periodoIni: f.periodoIni, periodoFim: f.periodoFim });
      if (f.pagina) params.set('pagina', String(f.pagina));
      if (f.tamanho) params.set('tamanho', String(f.tamanho));
      if (f.statusLote) params.set('statusLote', String(f.statusLote));
      if (f.busca) params.set('busca', f.busca);
      if (force) {
        // O servidor também cacheia (TTL 3 min). Sem furar os dois, o "Atualizar"
        // devolveria exatamente a mesma resposta e o botão não faria nada.
        params.set('semCache', '1');
      }
      return params;
    },
    extrairItens: (body) => body.lotes ?? [],
    extrairMeta: (body) => body.meta ?? null,
    mensagemErroPadrao: MENSAGEM_ERRO_PADRAO,
    // O detalhe já carregado envelhece junto: se a listagem mudou, as requisições
    // daquele lote podem ter mudado também.
    aoForcar: () => cacheDetalheSessao.clear(),
  });

  // Rota separada: o detalhe é uma consulta por lote (dezenas de linhas), caro demais
  // para vir junto da listagem.
  const buscarRequisicoes = useCallback(async (
    idLote: number,
    force = false,
  ): Promise<RequisicaoLote[]> =>
    buscarDetalheLegadoComCache<RequisicaoLote, RespostaDetalhe>({
      rota: 'lote-detalhe',
      paramId: 'idLote',
      id: idLote,
      force,
      cache: cacheDetalheSessao,
      extrairItens: (body) => body.requisicoes ?? [],
      mensagemErroPadrao: MENSAGEM_ERRO_PADRAO,
    }), []);

  return { lotes, meta, loading, error, refetch, buscarRequisicoes };
}
