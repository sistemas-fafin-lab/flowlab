import { useCallback } from 'react';
import type {
  LotePendencia,
  PendenciasFiltros,
  PendenciasMeta,
  RequisicaoPendencia,
} from '../types';
import { buscarDetalheLegadoComCache } from './legado/api';
import { useLegadoListagem } from './legado/useLegadoListagem';

// Lista os lotes pendentes (sem NF/RPS, fora da janela normal) pela rota
// /api/faturamento/pendencias-nao-faturadas e o detalhe de um lote (requisições,
// com a situação de NF individual quando existe) pela
// /api/faturamento/pendencia-lote-detalhe. Mesmo esqueleto de useFaturamentoLotes —
// hook à parte porque a fonte é outra consulta no MySQL, com seu próprio par
// loading/error.

const cacheSessao = new Map<string, { itens: LotePendencia[]; meta: PendenciasMeta }>();
const cacheDetalheSessao = new Map<number, RequisicaoPendencia[]>();

interface RespostaPendencias {
  success?: boolean;
  error?: string;
  meta?: PendenciasMeta;
  lotes?: LotePendencia[];
}

interface RespostaDetalhe {
  success?: boolean;
  error?: string;
  requisicoes?: RequisicaoPendencia[];
}

const MENSAGEM_ERRO_PADRAO = 'Não foi possível consultar as pendências.';

interface UsePendenciasNaoFaturadasResult {
  lotes: LotePendencia[];
  meta: PendenciasMeta | null;
  loading: boolean;
  error: string | null;
  refetch: (force?: boolean) => Promise<void>;
  /** Requisições do lote, sob demanda ao expandir a linha. */
  buscarRequisicoes: (idLote: number, force?: boolean) => Promise<RequisicaoPendencia[]>;
}

export function usePendenciasNaoFaturadas(filtros: PendenciasFiltros): UsePendenciasNaoFaturadasResult {
  const { itens: lotes, meta, loading, error, refetch } = useLegadoListagem<
    LotePendencia,
    PendenciasFiltros,
    PendenciasMeta,
    RespostaPendencias
  >({
    filtros,
    rota: 'pendencias-nao-faturadas',
    cache: cacheSessao,
    chaveCache: (f) =>
      `${f.desde ?? ''}|${f.ate ?? ''}|${f.operadoraId ?? ''}|${f.status ?? ''}|${f.pagina ?? 1}|${f.tamanho ?? 50}`,
    montarParams: (f, force) => {
      const params = new URLSearchParams();
      if (f.desde) params.set('desde', f.desde);
      if (f.ate) params.set('ate', f.ate);
      if (f.operadoraId) params.set('operadoraId', String(f.operadoraId));
      if (f.status) params.set('status', String(f.status));
      if (f.pagina) params.set('pagina', String(f.pagina));
      if (f.tamanho) params.set('tamanho', String(f.tamanho));
      if (force) params.set('semCache', '1');
      return params;
    },
    extrairItens: (body) => body.lotes ?? [],
    extrairMeta: (body) => body.meta ?? null,
    mensagemErroPadrao: MENSAGEM_ERRO_PADRAO,
    aoForcar: () => cacheDetalheSessao.clear(),
  });

  const buscarRequisicoes = useCallback(async (
    idLote: number,
    force = false,
  ): Promise<RequisicaoPendencia[]> =>
    buscarDetalheLegadoComCache<RequisicaoPendencia, RespostaDetalhe>({
      rota: 'pendencia-lote-detalhe',
      paramId: 'idLote',
      id: idLote,
      force,
      cache: cacheDetalheSessao,
      extrairItens: (body) => body.requisicoes ?? [],
      mensagemErroPadrao: MENSAGEM_ERRO_PADRAO,
    }), []);

  return { lotes, meta, loading, error, refetch, buscarRequisicoes };
}
