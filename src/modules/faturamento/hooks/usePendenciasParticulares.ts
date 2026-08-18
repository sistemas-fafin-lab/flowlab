import type {
  ParticularesPendentesFiltros,
  ParticularesPendentesMeta,
  RequisicaoParticularPendencia,
} from '../types';
import { useLegadoListagem } from './legado/useLegadoListagem';

// Lista as requisições particulares pendentes (laudo liberado, sem NF) pela rota
// /api/faturamento/pendencias-particulares. Mesmo esqueleto de
// usePendenciasNaoFaturadas, mas sem o detalhe sob demanda: aqui a requisição já
// É a unidade da lista, não há lote pra expandir.

const cacheSessao = new Map<string, { itens: RequisicaoParticularPendencia[]; meta: ParticularesPendentesMeta }>();

interface RespostaParticularesPendentes {
  success?: boolean;
  error?: string;
  meta?: ParticularesPendentesMeta;
  requisicoes?: RequisicaoParticularPendencia[];
}

const MENSAGEM_ERRO_PADRAO = 'Não foi possível consultar as pendências de particulares.';

interface UsePendenciasParticularesResult {
  requisicoes: RequisicaoParticularPendencia[];
  meta: ParticularesPendentesMeta | null;
  loading: boolean;
  error: string | null;
  refetch: (force?: boolean) => Promise<void>;
}

export function usePendenciasParticulares(
  filtros: ParticularesPendentesFiltros,
): UsePendenciasParticularesResult {
  const { itens: requisicoes, meta, loading, error, refetch } = useLegadoListagem<
    RequisicaoParticularPendencia,
    ParticularesPendentesFiltros,
    ParticularesPendentesMeta,
    RespostaParticularesPendentes
  >({
    filtros,
    rota: 'pendencias-particulares',
    cache: cacheSessao,
    chaveCache: (f) => `${f.desde ?? ''}|${f.ate ?? ''}|${f.pagina ?? 1}|${f.tamanho ?? 50}`,
    montarParams: (f, force) => {
      const params = new URLSearchParams();
      if (f.desde) params.set('desde', f.desde);
      if (f.ate) params.set('ate', f.ate);
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
