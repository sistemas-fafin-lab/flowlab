import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Clock, CreditCard, MessageSquare, X } from 'lucide-react';
import { useTarefasRequisicao } from '../hooks/useTarefasRequisicao';
import { formatDataHoraAplis } from '../utils/formato';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';

// Peças das colunas novas das três listas de Contas a Receber → Pendências
// (Sem NF, Particulares e Sem lote): o chip do status da requisição, o ícone de
// tarefas com o contador das abertas e o modal que lista as tarefas do apLIS.

/** Eventos de laudo concluído (`requisicao.CodEvento`), conferidos no banco em
 *  27/10/2026: são os únicos com `DtaFinalizacao` preenchida. */
const EVENTOS_CONCLUIDOS = new Set([11, 56]);
const EVENTO_CANCELADO = 8;

function corStatusRequisicao(codEvento: number | null): string {
  if (codEvento !== null && EVENTOS_CONCLUIDOS.has(codEvento)) {
    return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
  }
  if (codEvento === EVENTO_CANCELADO) {
    return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
  }
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
}

/** Chip "Status da requisição": verde concluído, vermelho cancelado, cinza o resto.
 *  `compacto` para a sub-tabela de requisições do lote, que usa fonte menor. */
export const StatusRequisicao: React.FC<{ codEvento: number | null; label: string | null; compacto?: boolean }> = ({
  codEvento,
  label,
  compacto = false,
}) => {
  if (codEvento === null && !label) return <span className="text-gray-400">—</span>;
  const tamanho = compacto ? 'py-0.5 text-[11px]' : 'py-1 text-xs';
  return (
    <span className={`inline-flex px-2 rounded-full font-medium whitespace-nowrap ${tamanho} ${corStatusRequisicao(codEvento)}`}>
      {label ?? `Evento ${codEvento}`}
    </span>
  );
};

/** Ícone de tarefas da linha: com contador quando há tarefa aberta, esmaecido sem nenhuma. */
export const BotaoTarefas: React.FC<{ qtdAbertas: number; onClick: () => void }> = ({ qtdAbertas, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title={qtdAbertas > 0 ? `${qtdAbertas} tarefa${qtdAbertas === 1 ? '' : 's'} em aberto` : 'Ver tarefas da requisição'}
    aria-label="Ver tarefas da requisição"
    className={`relative inline-flex p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
      qtdAbertas > 0
        ? 'text-gray-700 dark:text-gray-200'
        : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400'
    }`}
  >
    <CreditCard className="w-4 h-4" />
    {qtdAbertas > 0 && (
      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-semibold leading-4 text-center tabular-nums">
        {qtdAbertas > 99 ? '99+' : qtdAbertas}
      </span>
    )}
  </button>
);

export interface RequisicaoDasTarefas {
  idRequisicao: number;
  codRequisicao: string | null;
}

interface ModalProps {
  /** Nulo = fechado. */
  requisicao: RequisicaoDasTarefas | null;
  onFechar: () => void;
}

/** Modal só de leitura com as tarefas do apLIS da requisição, de todos os setores. */
export const TarefasRequisicaoModal: React.FC<ModalProps> = ({ requisicao, onFechar }) => {
  const { tarefas, loading, error } = useTarefasRequisicao(requisicao?.idRequisicao ?? null);

  useEffect(() => {
    if (!requisicao) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [requisicao, onFechar]);

  if (!requisicao) return null;

  const abertas = tarefas.filter((t) => !t.concluida).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onFechar}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Tarefas da requisição{' '}
              <span className="font-mono">{requisicao.codRequisicao ?? `#${requisicao.idRequisicao}`}</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {loading || error
                ? 'Tarefas do apLIS, de todos os setores'
                : `${tarefas.length} tarefa${tarefas.length === 1 ? '' : 's'}, ${abertas} em aberto`}{' '}
              — dados até ontem (D-1)
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12"><LoadingSpinner /></div>
          ) : error ? (
            <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : tarefas.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <MessageSquare className="w-6 h-6" />
              Nenhuma tarefa para esta requisição.
            </div>
          ) : (
            <ul className="space-y-3">
              {tarefas.map((t) => (
                <li key={t.codTarefa} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {t.tipo ?? 'Tarefa'}
                      {t.destino && <span className="font-normal text-gray-500 dark:text-gray-400"> · Para: {t.destino}</span>}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDataHoraAplis(t.data)}</span>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-line break-words">{t.mensagem ?? '—'}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{t.remetente ? `De: ${t.remetente}` : ''}</span>
                    {t.concluida ? (
                      <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                        <CheckCircle2 size={12} /> Concluída{t.dataConclusao ? ` em ${formatDataHoraAplis(t.dataConclusao)}` : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                        <Clock size={12} /> Em aberto
                      </span>
                    )}
                  </div>
                  {t.obsConclusao && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line break-words border-t border-gray-100 dark:border-gray-700 pt-1">
                      {t.obsConclusao}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
