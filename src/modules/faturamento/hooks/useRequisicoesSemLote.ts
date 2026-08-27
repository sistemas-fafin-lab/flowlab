import type {
  RequisicaoSemLotePendencia,
  RequisicoesSemLoteFiltros,
  RequisicoesSemLoteMeta,
} from '../types';
import { useLegadoListagem } from './legado/useLegadoListagem';

// Lista as requisições de convênio sem NENHUM lote vinculado (issue 21 do
// feedback) pela rota /api/faturamento/pendencias-sem-lote. Mesmo esqueleto de
// usePendenciasParticulares — aqui também a requisição já é a unidade da lista,
// não há lote pra expandir.

const cacheSessao = new Map<string, { itens: RequisicaoSemLotePendencia[]; meta: RequisicoesSemLoteMeta }>();

interface RespostaRequisicoesSemLote {
  success?: boolean;
  error?: string;
  meta?: RequisicoesSemLoteMeta;
  requisicoes?: RequisicaoSemLotePendencia[];
}

const MENSAGEM_ERRO_PADRAO = 'Não foi possível consultar as requisições sem lote.';

interface UseRequisicoesSemLoteResult {
  requisicoes: RequisicaoSemLotePendencia[];
  meta: RequisicoesSemLoteMeta | null;
  loading: boolean;
  error: string | null;
  refetch: (force?: boolean) => Promise<void>;
}

export function useRequisicoesSemLote(
  filtros: RequisicoesSemLoteFiltros,
): UseRequisicoesSemLoteResult {
  const { itens: requisicoes, meta, loading, error, refetch } = useLegadoListagem<
    RequisicaoSemLotePendencia,
    RequisicoesSemLoteFiltros,
    RequisicoesSemLoteMeta,
    RespostaRequisicoesSemLote
  >({
    filtros,
    rota: 'pendencias-sem-lote',
    cache: cacheSessao,
    chaveCache: (f) => `${f.desde ?? ''}|${f.ate ?? ''}|${f.operadoraId ?? ''}|${f.pagina ?? 1}|${f.tamanho ?? 50}`,
    montarParams: (f, force) => {
      const params = new URLSearchParams();
      if (f.desde) params.set('desde', f.desde);
      if (f.ate) params.set('ate', f.ate);
      if (f.operadoraId) params.set('operadoraId', String(f.operadoraId));
      if (f.pagina) params.set('pagina', String(f.pagina));
      if (f.tamanho) params.set('tamanho', String(f.tamanho));
      if (force) params.set('semCache', '1');
      return params;
    },
    extrairItens: (body) => body.requisicoes ?? [],
    extrairMeta: (body) => body.meta ?? null,
    mensagemErroPadrao: MENSAGEM_ERRO_PADRAO,
  });

  return { requisicoes, meta, loading, error, refetch };
}
