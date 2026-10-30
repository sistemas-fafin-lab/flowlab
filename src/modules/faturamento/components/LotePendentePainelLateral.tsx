import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import type { LotePendencia, RequisicaoPendencia } from '../types';
import StatusFaturamentoChips from './StatusFaturamentoChips';
import { BotaoTarefas, StatusRequisicao, type RequisicaoDasTarefas } from './TarefasRequisicao';
import { corStatusFaturamento } from '../utils/corStatusFaturamento';
import { formatCurrency, formatData, formatDataHoraAplis } from '../utils/formato';

// Requisições de um lote sem NF/RPS num painel lateral — mesmo padrão do
// TituloPainelLateral, substituindo a antiga linha expansível de
// PendenciasNaoFaturadas. Montado com `key` do lote, então o estado abaixo é
// sempre de um lote só.

interface Props {
  lote: LotePendencia;
  /** Sobe a cada "Atualizar" da lista: relê as requisições ignorando o cache. */
  recarga: number;
  /** O modal de tarefas está aberto por cima: o Esc é dele, não do painel. */
  camadaSobreposta: boolean;
  onFechar: () => void;
  onAbrirTarefas: (requisicao: RequisicaoDasTarefas) => void;
  buscarRequisicoes: (idLote: number, force?: boolean) => Promise<RequisicaoPendencia[]>;
}

const ValorResumo: React.FC<{ rotulo: string; valor: string }> = ({ rotulo, valor }) => (
  <div className="rounded-lg bg-gray-50 dark:bg-gray-700/40 px-3 py-2">
    <p className="text-[11px] text-gray-500 dark:text-gray-400">{rotulo}</p>
    <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{valor}</p>
  </div>
);

const LotePendentePainelLateral: React.FC<Props> = ({
  lote,
  recarga,
  camadaSobreposta,
  onFechar,
  onAbrirTarefas,
  buscarRequisicoes,
}) => {
  const [requisicoes, setRequisicoes] = useState<RequisicaoPendencia[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Esc fecha uma camada por vez: com o modal de tarefas por cima, o painel fica.
  useEffect(() => {
    if (camadaSobreposta) return;
    const fecharNoEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onFechar();
    };
    document.addEventListener('keydown', fecharNoEsc);
    return () => document.removeEventListener('keydown', fecharNoEsc);
  }, [camadaSobreposta, onFechar]);

  // A página atrás não rola enquanto o painel está aberto.
  useEffect(() => {
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflowAnterior; };
  }, []);

  useEffect(() => {
    setRequisicoes(null);
    setErro(null);
    let cancelado = false;
    void buscarRequisicoes(lote.idLote, recarga > 0)
      .then((lista) => { if (!cancelado) setRequisicoes(lista); })
      .catch((err) => {
        if (!cancelado) setErro(err instanceof Error ? err.message : 'Não foi possível carregar as requisições.');
      });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recarga]);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/25 dark:bg-black/45 backdrop-blur-sm animate-fade-in"
        onClick={onFechar}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Requisições do lote ${lote.idLote}`}
        className="fixed inset-y-2 right-2 z-50 w-[760px] max-w-[calc(100vw-1rem)] flex flex-col rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl animate-slide-in-right"
      >
        {/* ── Cabeçalho: resumo do lote ───────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Lote {lote.idLote}
                </h2>
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                  {lote.statusLabel}
                </span>
              </div>
              <p
                className="mt-0.5 text-sm text-gray-600 dark:text-gray-300 truncate"
                title={lote.fontePagadora.razaoSocial ?? undefined}
              >
                {lote.fontePagadora.nome ?? 'Não identificada'}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                criado em {formatData(lote.dtaCriacao)}
              </p>
            </div>
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar detalhes"
              title="Fechar (Esc)"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ValorResumo rotulo="Requisições" valor={String(lote.qtdRequisicoes)} />
            <ValorResumo rotulo="Valor" valor={formatCurrency(lote.valor)} />
          </div>

          <StatusFaturamentoChips resumo={lote.statusFaturamento} />
        </div>

        {/* ── Corpo: requisições do lote ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {erro ? (
            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {erro}
            </p>
          ) : requisicoes === null ? (
            <p className="text-xs text-gray-400 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Carregando requisições...
            </p>
          ) : requisicoes.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhuma requisição cobrada neste lote.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 whitespace-nowrap">
                  <th className="py-1 pr-2">Requisição</th>
                  <th className="py-1 pr-2">Paciente</th>
                  <th className="py-1 pr-2">Status</th>
                  <th className="py-1 pr-2">NF/RPS</th>
                  <th className="py-1 pr-2" title="Data de liberação do laudo">Laudo</th>
                  <th className="py-1 pr-2" title="Data em que a guia foi recebida no faturamento">Recebido</th>
                  <th className="py-1 text-right">Valor</th>
                  <th className="py-1 pl-2 w-10"><span className="sr-only">Tarefas</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {requisicoes.map((req) => (
                  <tr key={req.idRequisicao} className="text-gray-600 dark:text-gray-300 align-top">
                    <td className="py-1.5 pr-2">
                      <div className="font-mono whitespace-nowrap">{req.codRequisicao ?? `#${req.idRequisicao}`}</div>
                      <div className="text-gray-400 whitespace-nowrap">guia {req.numGuiaConvenio ?? '—'}</div>
                    </td>
                    <td className="py-1.5 pr-2">
                      <div className="truncate max-w-[160px]" title={req.paciente ?? undefined}>{req.paciente ?? '—'}</div>
                      <div className="text-gray-400 tabular-nums whitespace-nowrap">
                        solicitação {formatData(req.dtaSolicitacao)}
                      </div>
                    </td>
                    <td className="py-1.5 pr-2 space-y-1">
                      {req.eventoFaturLabel ? (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${corStatusFaturamento(req.codEventoFatur, req.eventoFaturLabel)}`}
                        >
                          {req.eventoFaturLabel}
                        </span>
                      ) : <div>—</div>}
                      <div>
                        <StatusRequisicao codEvento={req.codEvento} label={req.eventoLabel} compacto />
                      </div>
                    </td>
                    <td className="py-1.5 pr-2">
                      {req.nfeNumero
                        ? (
                          <span
                            title="Requisição já tem NF/RPS individual, mesmo o lote não tendo — confira antes de cobrar de novo."
                            className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                          >
                            {req.nfeNumero}{req.numeroRPS ? ` / ${req.numeroRPS}` : ''}
                          </span>
                        )
                        : '—'}
                    </td>
                    <td className="py-1.5 pr-2 tabular-nums whitespace-nowrap">{formatData(req.dtaFinalizacao)}</td>
                    <td className="py-1.5 pr-2 tabular-nums whitespace-nowrap" title={formatDataHoraAplis(req.recebidoFaturamento)}>
                      {formatData(req.recebidoFaturamento?.slice(0, 10))}
                    </td>
                    <td className="py-1.5 text-right tabular-nums whitespace-nowrap">{formatCurrency(req.valor)}</td>
                    <td className="py-1.5 pl-2 text-center">
                      <BotaoTarefas
                        qtdTotal={req.qtdTarefas}
                        qtdAbertas={req.qtdTarefasAbertas}
                        onClick={() => onAbrirTarefas({ idRequisicao: req.idRequisicao, codRequisicao: req.codRequisicao })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
};

export default LotePendentePainelLateral;
