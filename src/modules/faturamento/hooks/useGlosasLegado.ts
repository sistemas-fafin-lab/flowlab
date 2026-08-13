import type { GlosaRequisicaoLegado, GlosasLegadoFiltros, LotesMeta } from '../types';
import { useLegadoListagem } from './legado/useLegadoListagem';

// Lista as glosas do legado (fatrequisicaoprocedimento.IdMotivoGlosa) pela rota
// /api/faturamento/glosas-legado — mesmo esqueleto de useFaturamentoLotes/
// useRecursosLegado, extraído para ./legado/useLegadoListagem.
//
// Hook à parte de useGlosas (glosas nativas) de propósito: fontes, filtros (período
// obrigatório aqui) e formato de resposta são diferentes, e cada aba tem seu próprio
// par loading/error para não piscar o spinner da outra.

// Cache de sessão (module-level): evita refetch ao alternar páginas. O servidor
// também cacheia (TTL 3 min); expira no F5 porque é memória.
const cacheSessao = new Map<string, { itens: GlosaRequisicaoLegado[]; meta: LotesMeta }>();

interface RespostaGlosasLegado {
  success?: boolean;
  error?: string;
  meta?: LotesMeta;
  glosas?: GlosaRequisicaoLegado[];
}

interface UseGlosasLegadoResult {
  glosas: GlosaRequisicaoLegado[];
  meta: LotesMeta | null;
  loading: boolean;
  error: string | null;
  refetch: (force?: boolean) => Promise<void>;
}

export function useGlosasLegado(filtros: GlosasLegadoFiltros): UseGlosasLegadoResult {
  const { itens: glosas, meta, loading, error, refetch } = useLegadoListagem<
    GlosaRequisicaoLegado,
    GlosasLegadoFiltros,
    LotesMeta,
    RespostaGlosasLegado
  >({
    filtros,
    rota: 'glosas-legado',
    cache: cacheSessao,
    chaveCache: (f) =>
      `${f.periodoIni}|${f.periodoFim}|${f.fontePagadoraId ?? ''}|${f.pagina ?? 1}|${f.tamanho ?? 50}|${f.busca ?? ''}`,
    montarParams: (f, force) => {
      const params = new URLSearchParams({ periodoIni: f.periodoIni, periodoFim: f.periodoFim });
      if (f.fontePagadoraId) params.set('fontePagadoraId', String(f.fontePagadoraId));
      if (f.pagina) params.set('pagina', String(f.pagina));
      if (f.tamanho) params.set('tamanho', String(f.tamanho));
      if (f.busca) params.set('busca', f.busca);
      if (force) params.set('semCache', '1');
      return params;
    },
    extrairItens: (body) => body.glosas ?? [],
    extrairMeta: (body) => body.meta ?? null,
    mensagemErroPadrao: 'Não foi possível consultar as glosas do legado.',
  });

  return { glosas, meta, loading, error, refetch };
}

export default useGlosasLegado;
