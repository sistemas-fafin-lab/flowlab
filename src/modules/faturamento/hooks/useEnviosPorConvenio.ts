import type {
  ConvenioEnvioResumo,
  EnviosPorConvenioFiltros,
  EnviosPorConvenioMeta,
} from '../types';
import { useLegadoListagem } from './legado/useLegadoListagem';

// Lista os convênios com movimentação no período pela rota
// /api/faturamento/envios-por-convenio — já agregado no servidor (uma linha por
// fonte pagadora), sem paginação: mesmo esqueleto de useFaturamentoLotes, mas sem
// `buscarRequisicoes`, porque esta tela não abre detalhe por lote.

const cacheSessao = new Map<string, { itens: ConvenioEnvioResumo[]; meta: EnviosPorConvenioMeta }>();

interface RespostaEnviosPorConvenio {
  success?: boolean;
  error?: string;
  meta?: EnviosPorConvenioMeta;
  convenios?: ConvenioEnvioResumo[];
}

const MENSAGEM_ERRO_PADRAO = 'Não foi possível consultar os envios por convênio.';

interface UseEnviosPorConvenioResult {
  convenios: ConvenioEnvioResumo[];
  meta: EnviosPorConvenioMeta | null;
  loading: boolean;
  error: string | null;
  refetch: (force?: boolean) => Promise<void>;
}

export function useEnviosPorConvenio(filtros: EnviosPorConvenioFiltros): UseEnviosPorConvenioResult {
  const { itens: convenios, meta, loading, error, refetch } = useLegadoListagem<
    ConvenioEnvioResumo,
    EnviosPorConvenioFiltros,
    EnviosPorConvenioMeta,
    RespostaEnviosPorConvenio
  >({
    filtros,
    rota: 'envios-por-convenio',
    cache: cacheSessao,
    chaveCache: (f) => `${f.periodoIni}|${f.periodoFim}|${[...(f.status ?? [])].sort((a, b) => a - b).join(',')}`,
    montarParams: (f, force) => {
      const params = new URLSearchParams({ periodoIni: f.periodoIni, periodoFim: f.periodoFim });
      if (f.status && f.status.length > 0) params.set('status', f.status.join(','));
      if (force) {
        // O servidor também cacheia (TTL 3 min) — sem furar os dois, o "Atualizar"
        // devolveria a mesma resposta.
        params.set('semCache', '1');
      }
      return params;
    },
    extrairItens: (body) => body.convenios ?? [],
    extrairMeta: (body) => body.meta ?? null,
    mensagemErroPadrao: MENSAGEM_ERRO_PADRAO,
  });

  return { convenios, meta, loading, error, refetch };
}
