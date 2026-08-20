import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IhqDTO, NivelConfianca, StatusCuradoriaIhq } from '../types';
import { RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { VinculoDrawer } from './ihq/VinculoDrawer.js';
import { ErrorState } from './ui/ErrorState.js';
import { SeletorPeriodoPorMes } from './ui/SeletorPeriodoPorMes.js';
import { Skeleton } from './ui/Skeleton.js';
import type { ColunaTabela } from './ui/TabelaExpansivel.js';
import { TabelaExpansivel } from './ui/TabelaExpansivel.js';
import { anoAtual } from '../anoAtual.js';
import { buscarIhqLista, ErroApi, sincronizarIhq } from '../ihq.js';
import { useCanManageQualidade } from '../hooks/useCanManageQualidade.js';
import { usePeriodoCompartilhado } from '../providers/PeriodoProvider.js';

const BADGE_CONFIANCA: Record<NivelConfianca, string> = {
  alta: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  media: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  baixa: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  nenhuma: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const BADGE_STATUS: Record<StatusCuradoriaIhq, string> = {
  pendente: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  em_analise: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  concluida: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  descartada: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const BADGE_STATUS_LIS: Record<NonNullable<IhqDTO['statusLis']>, string> = {
  concluido: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  cancelado: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  em_andamento: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
};

const ROTULO_STATUS_LIS: Record<NonNullable<IhqDTO['statusLis']>, string> = {
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  em_andamento: 'Em andamento',
};

// Split manual (sem `new Date`) para não sofrer deslocamento de fuso horário
// ao formatar uma data `YYYY-MM-DD` vinda do banco.
function formatarData(data: string | null): string {
  if (!data) return '—';
  const [ano, mes, dia] = data.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

interface LinhaAgrupadaIhq {
  codRequisicaoIhq: string;
  /** Bloco escolhido para representar a requisição — o mais recente por data de solicitação. */
  principal: IhqDTO;
  /** Todos os blocos desta requisição na aba atual, incluindo o principal — cada um mantém sua própria curadoria em `qa_ihq_solicitacoes`. */
  blocos: IhqDTO[];
}

/**
 * A unidade de acompanhamento é a REQUISIÇÃO, nunca o bloco — mesmo
 * comportamento da planilha que este módulo substitui
 * (`Acompanhamento_Exames_Imunohistoquimicos.csv`: 1 linha por requisição,
 * mesmo quando o LIS registra mais de uma tarefa de bloco para ela). Uma
 * requisição pode gerar mais de uma tarefa de envio de bloco no LIS — cada
 * uma vira sua própria linha em `qa_ihq_solicitacoes` — mas a worklist
 * mostra e abre sempre a requisição como um todo, usando o bloco mais
 * recente como representante. Pedido explícito do usuário (2026-08-18).
 */
function agruparPorRequisicao(itens: IhqDTO[]): LinhaAgrupadaIhq[] {
  const porRequisicao = new Map<string, IhqDTO[]>();
  for (const item of itens) {
    const grupo = porRequisicao.get(item.codRequisicaoIhq) ?? [];
    grupo.push(item);
    porRequisicao.set(item.codRequisicaoIhq, grupo);
  }
  return [...porRequisicao.entries()].map(([codRequisicaoIhq, blocosDoGrupo]) => {
    const ordenados = [...blocosDoGrupo].sort((a, b) =>
      (b.dtaSolicitacaoBloco ?? '').localeCompare(a.dtaSolicitacaoBloco ?? ''),
    );
    return { codRequisicaoIhq, principal: ordenados[0]!, blocos: ordenados };
  });
}

function TriEstado({ valor }: { valor: boolean | null }) {
  if (valor === null) return <span className="text-gray-400 dark:text-slate-500">—</span>;
  return valor ? (
    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
      Sim
    </span>
  ) : (
    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
      Não
    </span>
  );
}

export function Ihq() {
  const queryClient = useQueryClient();
  const canManage = useCanManageQualidade();
  const { periodo: periodoSalvo, definirPeriodo } = usePeriodoCompartilhado();
  const { inicio, fim } = periodoSalvo;
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);

  const periodoCompleto = Boolean(inicio && fim);

  const filtro = useMemo(() => ({ inicio, fim }), [inicio, fim]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ihq', filtro],
    queryFn: () => buscarIhqLista(filtro),
    enabled: periodoCompleto,
  });

  const sync = useMutation({
    mutationFn: () => sincronizarIhq({ inicio, fim }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ihq'] }),
  });

  const linhasAgrupadas = useMemo(() => agruparPorRequisicao(data ?? []), [data]);

  const colunas: ColunaTabela<LinhaAgrupadaIhq>[] = [
    {
      chave: 'admissao',
      titulo: 'Data de admissão',
      valor: (grupo) => grupo.principal.dtaAdmissao ?? '',
      render: (grupo) => formatarData(grupo.principal.dtaAdmissao),
      larguraMin: 'min-w-[8rem]',
    },
    {
      chave: 'requisicao',
      titulo: 'Nº da requisição',
      valor: (grupo) => grupo.codRequisicaoIhq,
      filtravel: true,
      larguraMin: 'min-w-[9rem]',
    },
    {
      chave: 'paciente',
      titulo: 'Nome do paciente',
      valor: (grupo) => grupo.principal.nomePacienteLis ?? '',
      quebrarLinha: true,
      filtravel: true,
      larguraMin: 'min-w-[14rem]',
    },
    {
      chave: 'material',
      titulo: 'Material',
      valor: (grupo) => grupo.principal.materialLis ?? '',
      quebrarLinha: true,
      larguraMin: 'min-w-[12rem]',
    },
    {
      chave: 'medicoSolicitante',
      titulo: 'Médico solicitante',
      valor: (grupo) => grupo.principal.medicoSolicitante ?? '',
      quebrarLinha: true,
      filtravel: true,
      larguraMin: 'min-w-[14rem]',
    },
    {
      chave: 'dtaSolicitacaoBloco',
      titulo: 'Data da solicitação do bloco',
      valor: (grupo) => grupo.principal.dtaSolicitacaoBloco ?? '',
      render: (grupo) => formatarData(grupo.principal.dtaSolicitacaoBloco),
      larguraMin: 'min-w-[10rem]',
    },
    {
      chave: 'patologista',
      titulo: 'Patologista (laudo)',
      valor: (grupo) => grupo.principal.patologistaLis ?? '',
      larguraMin: 'min-w-[12rem]',
    },
    {
      chave: 'confianca',
      titulo: 'Confiança do vínculo',
      valor: (grupo) => grupo.principal.vinculoConfianca ?? 'nenhuma',
      filtravel: true,
      tipoFiltro: 'select',
      render: (grupo) => (
        // Confiança sempre visível, mesmo quando "alta" (nunca omitida)
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            grupo.principal.vinculoConfianca ? BADGE_CONFIANCA[grupo.principal.vinculoConfianca] : BADGE_CONFIANCA.nenhuma
          }`}
        >
          {grupo.principal.vinculoConfianca ?? 'nenhuma'}
        </span>
      ),
      larguraMin: 'min-w-[10rem]',
    },
    {
      chave: 'envio',
      titulo: 'Data de envio',
      valor: (grupo) => grupo.principal.dtaEnvioBloco ?? '',
      render: (grupo) =>
        grupo.principal.dtaEnvioBloco
          ? `${formatarData(grupo.principal.dtaEnvioBloco)}${grupo.principal.dtaEnvioProveniencia === 'curadoria' ? '' : ' (aprox.)'}`
          : '—',
      larguraMin: 'min-w-[10rem]',
    },
    {
      chave: 'statusLis',
      titulo: 'Status',
      valor: (grupo) => grupo.principal.statusLis ?? '',
      filtravel: true,
      tipoFiltro: 'select',
      render: (grupo) =>
        grupo.principal.statusLis ? (
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${BADGE_STATUS_LIS[grupo.principal.statusLis]}`}>
            {ROTULO_STATUS_LIS[grupo.principal.statusLis]}
          </span>
        ) : (
          '—'
        ),
      larguraMin: 'min-w-[9rem]',
    },
    {
      chave: 'blocoRetornou',
      titulo: 'Bloco retornou ao lab?',
      valor: (grupo) => (grupo.principal.blocoRetornou === null ? '' : grupo.principal.blocoRetornou ? 'sim' : 'nao'),
      render: (grupo) => (
        <span className="inline-flex items-center gap-1">
          <TriEstado valor={grupo.principal.blocoRetornou} />
          {/* R4 — padrão de detecção não validado contra dado real; nunca apresentar como fato confirmado. */}
          {grupo.principal.blocoRetornou !== null && (
            <span className="text-[0.65rem] text-amber-600 dark:text-amber-400" title="Detecção não validada contra dado real (R4).">
              não confirmado
            </span>
          )}
        </span>
      ),
      larguraMin: 'min-w-[10rem]',
    },
    {
      chave: 'dtaRetornoBloco',
      titulo: 'Quando (retorno)',
      valor: (grupo) => grupo.principal.dtaRetornoBloco ?? '',
      render: (grupo) => formatarData(grupo.principal.dtaRetornoBloco),
      larguraMin: 'min-w-[8rem]',
    },
    {
      chave: 'laminaEnviada',
      titulo: 'Lâmina enviada?',
      valor: (grupo) => (grupo.principal.laminaEnviada === null ? '' : grupo.principal.laminaEnviada ? 'sim' : 'nao'),
      render: (grupo) => <TriEstado valor={grupo.principal.laminaEnviada} />,
      larguraMin: 'min-w-[8rem]',
    },
    {
      chave: 'observacoes',
      titulo: 'Observações',
      valor: (grupo) => grupo.principal.observacoes ?? '',
      quebrarLinha: true,
      larguraMin: 'min-w-[14rem]',
    },
    {
      chave: 'status',
      titulo: 'Status (curadoria)',
      valor: (grupo) => grupo.principal.statusCuradoria,
      filtravel: true,
      tipoFiltro: 'select',
      render: (grupo) => (
        <>
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${BADGE_STATUS[grupo.principal.statusCuradoria]}`}>
            {grupo.principal.statusCuradoria}
          </span>
          {grupo.principal.revisaoPendente && (
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">IHQ</h1>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Blocos enviados ao laboratório parceiro externo. Metade dos dados é heurística ou texto livre — a
            confiança do vínculo fica sempre visível, nunca escondida.
          </p>
        </div>
        <div className="flex gap-2">
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
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => (
                <Skeleton key={n} className="h-12 w-full" />
              ))}
            </div>
          )}

          {isError && (
            <ErrorState
              titulo="Não foi possível carregar IHQ"
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
              Nenhuma solicitação registrada neste período. Verifique o período ou sincronize com o LIS.
            </p>
          )}

          {!isLoading && !isError && linhasAgrupadas.length > 0 && (
            <TabelaExpansivel
              titulo="IHQ"
              caption="IHQ"
              colunas={colunas}
              dados={linhasAgrupadas}
              chaveLinha={(grupo) => grupo.codRequisicaoIhq}
              onClickLinha={(grupo) => setIdSelecionado(grupo.principal.id)}
              cor="purple"
            />
          )}
        </>
      )}

      {idSelecionado && (
        <VinculoDrawer id={idSelecionado} canManage={canManage} onFechar={() => setIdSelecionado(null)} />
      )}
    </div>
  );
}
