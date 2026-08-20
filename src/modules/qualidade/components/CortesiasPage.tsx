import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CortesiaDTO, StatusCuradoriaCortesia } from '../types';
import { AlertTriangle, Bell, Clock, RefreshCw, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CuradoriaDrawer } from './cortesias/CuradoriaDrawer.js';
import { NotificacoesModal } from './cortesias/NotificacoesModal.js';
import { ErrorState } from './ui/ErrorState.js';
import { SeletorPeriodoPorMes } from './ui/SeletorPeriodoPorMes.js';
import { Skeleton } from './ui/Skeleton.js';
import type { ColunaTabela } from './ui/TabelaExpansivel.js';
import { TabelaExpansivel } from './ui/TabelaExpansivel.js';
import { anoAtual } from '../anoAtual.js';
import { ErroApi, buscarCortesias, buscarNotificacoesCortesias, sincronizarCortesias } from '../cortesias.js';
import { useCanManageQualidade } from '../hooks/useCanManageQualidade.js';
import {
  contarNaoLidas,
  filtrarNaoLimpas,
  gravarLimpoAte,
  gravarUltimoVisto,
  lerLimpoAte,
  lerUltimoVisto,
} from '../domain/notificacoesCortesias.js';
import { usePeriodoCompartilhado } from '../providers/PeriodoProvider.js';

// Rótulos própiros para não colidir com o "pendente" de Prazo (autorização) —
// este é status de CURADORIA (workflow interno do time), sem relação com o
// prazo de autorização do LIS (pedido explícito do usuário, 2026-08-20).
const ROTULO_STATUS_CURADORIA: Record<StatusCuradoriaCortesia, string> = {
  pendente: 'Curadoria pendente',
  em_analise: 'Em análise',
  concluida: 'Concluída',
  descartada: 'Descartada',
};

const BADGE_STATUS: Record<StatusCuradoriaCortesia, string> = {
  pendente: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  em_analise: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  concluida: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  descartada: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const OPCOES_FILTRO_STATUS_CURADORIA: { valor: StatusCuradoriaCortesia; rotulo: string; cor: 'gray' | 'blue' | 'green' }[] = [
  { valor: 'pendente', rotulo: ROTULO_STATUS_CURADORIA.pendente, cor: 'gray' },
  { valor: 'em_analise', rotulo: ROTULO_STATUS_CURADORIA.em_analise, cor: 'blue' },
  { valor: 'concluida', rotulo: ROTULO_STATUS_CURADORIA.concluida, cor: 'green' },
  { valor: 'descartada', rotulo: ROTULO_STATUS_CURADORIA.descartada, cor: 'gray' },
];

// "Não autorizada" — pendente sem autorização cujo prazo em aberto já venceu
// (R1, ver cortesiasRegras.ts). Nunca foi de fato aprovada, por isso tem cor
// e destaque de linha diferentes de "fora do prazo" (que É aprovada, só que
// tarde).
const BADGE_PRAZO: Record<CortesiaDTO['situacaoPrazo'], string> = {
  dentro_prazo: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  fora_prazo: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  sem_autorizacao: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  nao_autorizada: 'bg-rose-200 text-rose-900 dark:bg-rose-900/60 dark:text-rose-200',
};

const ROTULO_PRAZO: Record<CortesiaDTO['situacaoPrazo'], string> = {
  dentro_prazo: 'Dentro do prazo',
  fora_prazo: 'Fora do prazo',
  sem_autorizacao: 'Sem autorização',
  nao_autorizada: 'Não autorizada',
};

function formatarMoeda(valor: number | null): string {
  if (valor === null) return '—';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Split manual (sem `new Date`) para não sofrer deslocamento de fuso horário
// ao formatar uma data `YYYY-MM-DD` vinda do banco.
function formatarData(data: string | null): string {
  if (!data) return '—';
  const [ano, mes, dia] = data.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

const INTERVALO_POLL_NOTIFICACOES_MS = 60_000;

export function Cortesias() {
  const queryClient = useQueryClient();
  const canManage = useCanManageQualidade();
  const { periodo: periodoSalvo, definirPeriodo } = usePeriodoCompartilhado();
  const { inicio, fim } = periodoSalvo;
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);
  // "Pendente" aqui é sobre a AUTORIZAÇÃO no LIS (ainda sem `dtaAutorizacao`),
  // não sobre o status de curadoria — pedido explícito do usuário
  // (2026-08-19): o card funciona como filtro, não como aba de workflow.
  const [somentePendentesAutorizacao, setSomentePendentesAutorizacao] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Sino de notificação de Cortesias — hoje local a esta tela, não integrado
  // ao NotificationBell central do FlowLab (fase-2-integrar-flowlab-main,
  // design.md D7.3: reaproveitar em vez de duplicar — pendente, ver tasks.md).
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false);
  const [ultimoVisto, setUltimoVisto] = useState(lerUltimoVisto);
  const [limpoAte, setLimpoAte] = useState(lerLimpoAte);
  const notificacoes = useQuery({
    queryKey: ['notificacoes-cortesias'],
    queryFn: () => buscarNotificacoesCortesias(null),
    refetchInterval: INTERVALO_POLL_NOTIFICACOES_MS,
  });
  const notificacoesVisiveis = filtrarNaoLimpas(notificacoes.data ?? [], limpoAte);
  const naoLidas = contarNaoLidas(notificacoesVisiveis, ultimoVisto);
  function abrirNotificacoes() {
    setNotificacoesAbertas(true);
  }
  function marcarNotificacoesComoLidas() {
    const maisRecente = notificacoes.data?.[0]?.sincronizadoEm;
    if (maisRecente) {
      gravarUltimoVisto(maisRecente);
      setUltimoVisto(maisRecente);
    }
  }
  function fecharNotificacoes() {
    setNotificacoesAbertas(false);
    marcarNotificacoesComoLidas();
  }
  // "Limpar" tira tudo da LISTA (não é exclusão real — a cortesia continua
  // existindo, só o item de notificação some do modal). Novas notificações
  // sincronizadas depois deste instante voltam a aparecer normalmente.
  function limparNotificacoes() {
    const agora = new Date().toISOString();
    gravarLimpoAte(agora);
    setLimpoAte(agora);
    marcarNotificacoesComoLidas();
  }

  // Abre direto a partir de uma notificação (`/cortesias?abrir=<id>`) — o
  // drawer busca por id, independente do período/aba selecionados aqui.
  useEffect(() => {
    const idParaAbrir = searchParams.get('abrir');
    if (!idParaAbrir) return;
    setIdSelecionado(idParaAbrir);
    setSearchParams((atuais) => {
      const novos = new URLSearchParams(atuais);
      novos.delete('abrir');
      return novos;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  const periodoCompleto = Boolean(inicio && fim);

  const filtro = useMemo(() => ({ inicio, fim }), [inicio, fim]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['cortesias', filtro],
    queryFn: () => buscarCortesias(filtro),
    enabled: periodoCompleto,
  });

  const sync = useMutation({
    mutationFn: () => sincronizarCortesias({ inicio, fim }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cortesias'] }),
  });

  const pendentesAutorizacao = useMemo(
    () => (data ?? []).filter((item) => item.situacaoPrazo === 'sem_autorizacao'),
    [data],
  );

  const itensExibidos = somentePendentesAutorizacao ? pendentesAutorizacao : (data ?? []);

  const colunas: ColunaTabela<CortesiaDTO>[] = [
    { chave: 'requisicao', titulo: 'Requisição', valor: (item) => item.codRequisicao, filtravel: true, larguraMin: 'min-w-[8rem]' },
    {
      chave: 'paciente',
      titulo: 'Paciente',
      // PII (P10) — lida do LIS sob demanda a cada carregamento, nunca persistida em qa_cortesias.
      valor: (item) => item.nomePacienteLis ?? '',
      quebrarLinha: true,
      filtravel: true,
      larguraMin: 'min-w-[14rem]',
    },
    {
      chave: 'clinica',
      titulo: 'Clínica',
      valor: (item) => item.clinicaNome ?? '',
      quebrarLinha: true,
      filtravel: true,
      larguraMin: 'min-w-[14rem]',
    },
    {
      chave: 'exame',
      titulo: 'Exame',
      valor: (item) => item.exameNome ?? '',
      quebrarLinha: true,
      larguraMin: 'min-w-[14rem]',
    },
    { chave: 'dtaSolicitacao', titulo: 'Data solicitação', valor: (item) => item.dtaSolicitacao, render: (item) => formatarData(item.dtaSolicitacao), larguraMin: 'min-w-[9rem]' },
    { chave: 'dtaAutorizacao', titulo: 'Data autorização', valor: (item) => item.dtaAutorizacao, render: (item) => formatarData(item.dtaAutorizacao), larguraMin: 'min-w-[9rem]' },
    {
      chave: 'prazo',
      titulo: 'Prazo',
      valor: (item) => ROTULO_PRAZO[item.situacaoPrazo],
      filtravel: true,
      tipoFiltro: 'select',
      render: (item) => (
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${BADGE_PRAZO[item.situacaoPrazo]}`}>
          {ROTULO_PRAZO[item.situacaoPrazo]}
        </span>
      ),
      larguraMin: 'min-w-[10rem]',
    },
    { chave: 'motivo', titulo: 'Motivo', valor: (item) => item.motivoNome ?? '', filtravel: true, larguraMin: 'min-w-[10rem]' },
    { chave: 'classificacao', titulo: 'Classificação', valor: (item) => item.classificacaoNome ?? '', filtravel: true, larguraMin: 'min-w-[10rem]' },
    {
      chave: 'valorParticular',
      titulo: 'Valor particular',
      valor: (item) => item.valorParticular ?? item.valorParticularCorrigido ?? undefined,
      render: (item) => {
        const valorEfetivo = item.valorParticular ?? item.valorParticularCorrigido;
        return (
          <>
            {valorEfetivo === null ? (
              <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                Não cadastrado
              </span>
            ) : (
              <span className="text-gray-700 dark:text-slate-300">{formatarMoeda(valorEfetivo)}</span>
            )}
            {item.valorParticular === null && item.valorParticularCorrigido !== null && (
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                ajustado
              </span>
            )}
          </>
        );
      },
      larguraMin: 'min-w-[8rem]',
    },
    { chave: 'valorCobrado', titulo: 'Valor cobrado', valor: (item) => item.valorCobrado ?? undefined, render: (item) => formatarMoeda(item.valorCobrado), larguraMin: 'min-w-[8rem]' },
    {
      chave: 'valorConcedido',
      titulo: 'Valor concedido',
      valor: (item) => item.valorConcedidoCorrigido ?? item.valorConcedido ?? undefined,
      render: (item) => {
        const valorEfetivo = item.valorConcedidoCorrigido ?? item.valorConcedido;
        return (
          <>
            {valorEfetivo === null ? (
              <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                Não cadastrado
              </span>
            ) : (
              <span className="text-gray-700 dark:text-slate-300">{formatarMoeda(valorEfetivo)}</span>
            )}
            {item.valorConcedidoCorrigido !== null && (
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                ajustado
              </span>
            )}
            {item.divergenciaValores && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                divergência
              </span>
            )}
          </>
        );
      },
      larguraMin: 'min-w-[10rem]',
    },
    {
      chave: 'autorizadoPor',
      titulo: 'Autorizado por',
      valor: (item) => item.autorizadoPorCorrigidoNome ?? item.autorizadoPorLis ?? '',
      quebrarLinha: true,
      filtravel: true,
      larguraMin: 'min-w-[10rem]',
    },
    // Observações (LIS) deixa as rows muito altas e já está disponível por
    // completo no CuradoriaDrawer (clique na linha) — não repetir na tabela.
    {
      chave: 'status',
      titulo: 'Status da curadoria',
      valor: (item) => item.statusCuradoria,
      filtravel: true,
      tipoFiltro: 'select',
      opcoesFiltro: OPCOES_FILTRO_STATUS_CURADORIA,
      render: (item) => (
        <>
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${BADGE_STATUS[item.statusCuradoria]}`}>
            {ROTULO_STATUS_CURADORIA[item.statusCuradoria]}
          </span>
          {item.revisaoPendente && (
            <span className="ml-2 rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
              revisão pendente
            </span>
          )}
        </>
      ),
      larguraMin: 'min-w-[12rem]',
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Cortesias</h1>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Exames concedidos sem cobrança, com prazo de aprovação, cota por clínica e conferência de valores.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={abrirNotificacoes}
            aria-label={`Notificações${naoLidas > 0 ? ` — ${naoLidas} não lida(s)` : ''}`}
            className="relative flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all duration-200 hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/5"
          >
            <Bell className="h-4 w-4" aria-hidden />
            {naoLidas > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                {naoLidas}
              </span>
            )}
          </button>
          <Link
            to="/qualidade/cortesias/cotas"
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all duration-200 hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/5"
          >
            <Wallet className="h-4 w-4" aria-hidden />
            Cotas
          </Link>
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

      <SeletorPeriodoPorMes
        inicio={inicio}
        fim={fim}
        anoPadrao={anoAtual()}
        onMudar={definirPeriodo}
      />

      {!periodoCompleto && (
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Selecione o período para carregar a worklist.
        </p>
      )}

      {periodoCompleto && (
        <>
          <button
            type="button"
            aria-pressed={somentePendentesAutorizacao}
            onClick={() => setSomentePendentesAutorizacao((v) => !v)}
            className={`flex w-full max-w-xs items-center gap-3 rounded-2xl border p-4 text-left transition-all duration-200 sm:w-auto ${
              somentePendentesAutorizacao
                ? 'border-amber-300 bg-amber-50 shadow-md shadow-amber-500/20 dark:border-amber-500/40 dark:bg-amber-900/20'
                : 'glass-surface border-transparent hover:border-amber-200 dark:hover:border-amber-500/30'
            }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
              <Clock className="h-5 w-5 text-white" aria-hidden />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Pendentes (sem autorização)
              </p>
              <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{pendentesAutorizacao.length}</p>
            </div>
          </button>

          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => (
                <Skeleton key={n} className="h-12 w-full" />
              ))}
            </div>
          )}

          {isError && (
            <ErrorState
              titulo="Não foi possível carregar cortesias"
              descricao={
                error instanceof ErroApi && error.status === 401
                  ? 'Sua sessão não está autenticada. Faça login novamente.'
                  : 'Verifique sua conexão ou tente novamente.'
              }
              aoTentarNovamente={() => refetch()}
            />
          )}

          {!isLoading && !isError && data && data.length === 0 && (
            <p className="glass-surface rounded-2xl p-8 text-center text-sm text-gray-500 dark:text-slate-400">
              Nenhuma cortesia registrada neste período. Verifique o período ou sincronize com o LIS.
            </p>
          )}

          {!isLoading && !isError && data && data.length > 0 && itensExibidos.length === 0 && (
            <p className="glass-surface rounded-2xl p-8 text-center text-sm text-gray-500 dark:text-slate-400">
              Nenhuma cortesia pendente de autorização neste período. ✓
            </p>
          )}

          {!isLoading && !isError && itensExibidos.length > 0 && (
            <TabelaExpansivel
              titulo="Cortesias"
              caption="Cortesias"
              colunas={colunas}
              dados={itensExibidos}
              chaveLinha={(item) => item.id}
              onClickLinha={(item) => setIdSelecionado(item.id)}
              classeLinha={(item) =>
                item.situacaoPrazo === 'nao_autorizada'
                  ? 'bg-rose-100 dark:bg-rose-950/50'
                  : item.aprovadaForaDoPrazo
                    ? 'bg-red-50 dark:bg-red-950/30'
                    : ''
              }
              cor="amber"
            />
          )}
        </>
      )}

      {idSelecionado && (
        <CuradoriaDrawer id={idSelecionado} canManage={canManage} onFechar={() => setIdSelecionado(null)} />
      )}

      {notificacoesAbertas && (
        <NotificacoesModal
          notificacoes={notificacoesVisiveis}
          carregando={notificacoes.isLoading}
          agora={Date.now()}
          onFechar={fecharNotificacoes}
          onLimpar={limparNotificacoes}
        />
      )}
    </div>
  );
}
