import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { anoAtual } from '../../anoAtual.js';
import { ErroApiQualidade } from '../../qualidadeApi.js';
import { ErrorState } from './ErrorState.js';
import { SeletorPeriodoPorMes } from './SeletorPeriodoPorMes.js';
import { Skeleton } from './Skeleton.js';
import type { ColunaTabela, CorTabela } from './TabelaExpansivel.js';
import { TabelaExpansivel } from './TabelaExpansivel.js';

interface PeriodoFiltro {
  inicio: string;
  fim: string;
}

interface PaginaWorklistProps<TResposta, TLinha> {
  titulo: string;
  descricao: string;
  /** Prefixo da queryKey (`[dominio, filtro]`) e chave invalidada pelo sync. */
  dominio: string;
  periodo: PeriodoFiltro;
  onMudarPeriodo: (periodo: PeriodoFiltro) => void;
  canManage: boolean;
  queryFn: (filtro: PeriodoFiltro) => Promise<TResposta>;
  syncFn: (filtro: PeriodoFiltro) => Promise<unknown>;
  errorTitulo: string;
  descricaoGuardaPeriodo?: string;
  mensagemVazio: (resposta: TResposta) => string;
  /** Extrai as linhas da tabela a partir da resposta — identidade nas páginas 1 linha = 1 registro, agrupamento/filtro nas outras. */
  linhas: (resposta: TResposta) => TLinha[];
  colunas: ColunaTabela<TLinha>[] | ((resposta: TResposta) => ColunaTabela<TLinha>[]);
  tituloTabela: string;
  cor: CorTabela;
  chaveLinha: (item: TLinha) => string;
  onClickLinha: (item: TLinha) => void;
  classeLinha?: (item: TLinha) => string;
  /** Conteúdo extra no header, antes do botão Sincronizar (sino de notificação, link "Cotas"). */
  extraHeader?: ReactNode;
  /** Conteúdo acima da tabela (métricas, alertas, card-filtro) — recebe a resposta mesmo antes de carregar (`undefined`), cada página decide o que mostrar nesse meio-tempo. */
  acimaDaTabela?: (resposta: TResposta | undefined) => ReactNode;
  /** Conteúdo abaixo da tabela, só depois de a resposta carregar (ex.: card de exportação do Câncer). */
  abaixoDaTabela?: (resposta: TResposta) => ReactNode;
  /** Drawer(s)/modal(is) da página — recebe a resposta (pode ser `undefined`) para casos como o Câncer, onde o drawer precisa de `parametrosFixos`. */
  drawer?: (resposta: TResposta | undefined) => ReactNode;
}

/**
 * Esqueleto comum às 4 worklists de Qualidade (Ocorrências, Cortesias, IHQ,
 * Câncer): header com botão Sincronizar, seletor de período + guarda,
 * loading/erro/vazio, `TabelaExpansivel`. Cada página fica com colunas,
 * drawer e os slots (`extraHeader`, `acimaDaTabela`, `abaixoDaTabela`) que
 * cobrem o que é só dela.
 */
export function PaginaWorklist<TResposta, TLinha>({
  titulo,
  descricao,
  dominio,
  periodo,
  onMudarPeriodo,
  canManage,
  queryFn,
  syncFn,
  errorTitulo,
  descricaoGuardaPeriodo = 'Selecione o período para carregar a worklist.',
  mensagemVazio,
  linhas,
  colunas,
  tituloTabela,
  cor,
  chaveLinha,
  onClickLinha,
  classeLinha,
  extraHeader,
  acimaDaTabela,
  abaixoDaTabela,
  drawer,
}: PaginaWorklistProps<TResposta, TLinha>) {
  const queryClient = useQueryClient();
  const { inicio, fim } = periodo;
  const periodoCompleto = Boolean(inicio && fim);
  const filtro = useMemo(() => ({ inicio, fim }), [inicio, fim]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [dominio, filtro],
    queryFn: () => queryFn(filtro),
    enabled: periodoCompleto,
  });

  const sync = useMutation({
    mutationFn: () => syncFn(filtro),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [dominio] }),
  });

  const linhasExibidas = data ? linhas(data) : [];
  const colunasResolvidas = data ? (typeof colunas === 'function' ? colunas(data) : colunas) : [];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{titulo}</h1>
          <p className="text-sm text-gray-600 dark:text-slate-400">{descricao}</p>
        </div>
        <div className="flex gap-2">
          {extraHeader}
          {canManage && (
            <button
              type="button"
              disabled={!periodoCompleto || sync.isPending}
              onClick={() => sync.mutate()}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-500/25 transition-all duration-200 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${sync.isPending ? 'animate-spin' : ''}`} aria-hidden />
              Sincronizar
            </button>
          )}
        </div>
      </div>

      <SeletorPeriodoPorMes inicio={inicio} fim={fim} anoPadrao={anoAtual()} onMudar={onMudarPeriodo} />

      {!periodoCompleto && <p className="text-sm text-gray-500 dark:text-slate-400">{descricaoGuardaPeriodo}</p>}

      {periodoCompleto && (
        <>
          {acimaDaTabela?.(data)}

          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => (
                <Skeleton key={n} className="h-12 w-full" />
              ))}
            </div>
          )}

          {isError && (
            <ErrorState
              titulo={errorTitulo}
              descricao={
                error instanceof ErroApiQualidade && error.status === 401
                  ? 'Sua sessão não está autenticada. Faça login novamente.'
                  : 'Verifique sua conexão ou tente novamente.'
              }
              aoTentarNovamente={() => refetch()}
            />
          )}

          {!isLoading && !isError && data && linhasExibidas.length === 0 && (
            <p className="glass-surface rounded-2xl p-8 text-center text-sm text-gray-500 dark:text-slate-400">
              {mensagemVazio(data)}
            </p>
          )}

          {!isLoading && !isError && data && linhasExibidas.length > 0 && (
            <TabelaExpansivel
              titulo={tituloTabela}
              caption={tituloTabela}
              colunas={colunasResolvidas}
              dados={linhasExibidas}
              chaveLinha={chaveLinha}
              onClickLinha={onClickLinha}
              classeLinha={classeLinha}
              cor={cor}
            />
          )}

          {data && abaixoDaTabela?.(data)}
        </>
      )}

      {drawer?.(data)}
    </div>
  );
}
