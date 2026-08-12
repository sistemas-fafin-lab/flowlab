import { useCallback } from 'react';
import type {
  LoteRecursoLegado,
  LotesMeta,
  ProcedimentoRecursoLegado,
  RecursosLegadoFiltros,
} from '../../billing/types';
import { buscarDetalheLegadoComCache } from './legado/api';
import { useLegadoListagem } from './legado/useLegadoListagem';

// Lista os lotes de recurso (fatloterecurso) pela rota /api/faturamento/recursos-legado
// e o detalhe de um lote (procedimentos) pela mesma rota com ?idLoteRecurso= — mesmo
// esqueleto de useFaturamentoLotes/useGlosasLegado, extraído para ./legado/.

const cacheSessao = new Map<string, { itens: LoteRecursoLegado[]; meta: LotesMeta }>();
const cacheDetalheSessao = new Map<number, ProcedimentoRecursoLegado[]>();

interface RespostaRecursosLegado {
  success?: boolean;
  error?: string;
  meta?: LotesMeta;
  recursos?: LoteRecursoLegado[];
}

interface RespostaDetalheRecurso {
  success?: boolean;
  error?: string;
  procedimentos?: ProcedimentoRecursoLegado[];
}

const MENSAGEM_ERRO_PADRAO = 'Não foi possível consultar os recursos do legado.';

interface UseRecursosLegadoResult {
  recursos: LoteRecursoLegado[];
  meta: LotesMeta | null;
  loading: boolean;
  error: string | null;
  refetch: (force?: boolean) => Promise<void>;
  /** Procedimentos do lote de recurso, sob demanda ao expandir a linha. */
  buscarProcedimentos: (idLoteRecurso: number, force?: boolean) => Promise<ProcedimentoRecursoLegado[]>;
}

export function useRecursosLegado(filtros: RecursosLegadoFiltros): UseRecursosLegadoResult {
  const { itens: recursos, meta, loading, error, refetch } = useLegadoListagem<
    LoteRecursoLegado,
    RecursosLegadoFiltros,
    LotesMeta,
    RespostaRecursosLegado
  >({
    filtros,
    rota: 'recursos-legado',
    cache: cacheSessao,
    chaveCache: (f) =>
      `${f.status ?? ''}|${f.fontePagadoraId ?? ''}|${f.pagina ?? 1}|${f.tamanho ?? 50}|${f.busca ?? ''}`,
    montarParams: (f, force) => {
      const params = new URLSearchParams();
      if (f.status !== undefined) params.set('status', String(f.status));
      if (f.fontePagadoraId) params.set('fontePagadoraId', String(f.fontePagadoraId));
      if (f.pagina) params.set('pagina', String(f.pagina));
      if (f.tamanho) params.set('tamanho', String(f.tamanho));
      if (f.busca) params.set('busca', f.busca);
      if (force) params.set('semCache', '1');
      return params;
    },
    extrairItens: (body) => body.recursos ?? [],
    extrairMeta: (body) => body.meta ?? null,
    mensagemErroPadrao: MENSAGEM_ERRO_PADRAO,
    aoForcar: () => cacheDetalheSessao.clear(),
  });

  const buscarProcedimentos = useCallback(async (
    idLoteRecurso: number,
    force = false,
  ): Promise<ProcedimentoRecursoLegado[]> =>
    buscarDetalheLegadoComCache<ProcedimentoRecursoLegado, RespostaDetalheRecurso>({
      rota: 'recursos-legado',
      paramId: 'idLoteRecurso',
      id: idLoteRecurso,
      force,
      cache: cacheDetalheSessao,
      extrairItens: (body) => body.procedimentos ?? [],
      mensagemErroPadrao: MENSAGEM_ERRO_PADRAO,
    }), []);

  return { recursos, meta, loading, error, refetch, buscarProcedimentos };
}

export default useRecursosLegado;
