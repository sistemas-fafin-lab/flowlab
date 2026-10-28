import React, { useEffect } from 'react';
import { CalendarClock, Check, History, Loader2, Trash2, Undo2, X } from 'lucide-react';
import { useHistoricoAgendamento } from '../hooks/useCalendarioEnvios';
import type { AcaoHistoricoAgendamento, AgendamentoEnvio, EventoHistoricoAgendamento, RegraEnvio } from '../types';
import { formatData, formatDataHora } from '../utils/formato';
import { ESTILO_STATUS } from './estiloStatusEnvio';
import SeloForaDaJanela from './SeloForaDaJanela';

// Detalhe de um Agendamento de envio (Calendário de envios): a observação da regra,
// os convênios membros (agrupadores como AMHPDF), status, data de envio, quem marcou
// e o histórico completo. Quem tem canManageCalendarioEnvios (gate no pai) marca ou
// desmarca, move para outro dia e remove daqui; as ações abrem os modais do pai.

interface Props {
  agendamento: AgendamentoEnvio;
  regra: RegraEnvio | undefined;
  podeGerenciar: boolean;
  onFechar: () => void;
  onMarcar: () => void;
  onDesmarcar: () => void;
  onMover: () => void;
  onRemover: () => void;
}

const NOME_ACAO: Record<AcaoHistoricoAgendamento, string> = {
  criou: 'Criou',
  moveu: 'Moveu',
  marcou: 'Marcou como enviado',
  desmarcou: 'Desmarcou o envio',
  confirmou_aplis: 'Confirmado no apLIS',
  removeu: 'Removeu',
};

const dataDoCampo = (valores: Record<string, unknown> | null, campo: string): string | null => {
  const valor = valores?.[campo];
  return typeof valor === 'string' ? formatData(valor) : null;
};

/** O que mudou na linha do histórico, em texto. */
function descreverEvento({ acao, antes, depois }: EventoHistoricoAgendamento): string | null {
  switch (acao) {
    case 'criou': {
      const origem = depois?.origem === 'manual' ? 'à mão' : 'pela sugestão';
      return `para ${dataDoCampo(depois, 'data_prevista') ?? '—'}, ${origem}`;
    }
    case 'moveu':
      return `de ${dataDoCampo(antes, 'data_prevista') ?? '—'} para ${dataDoCampo(depois, 'data_prevista') ?? '—'}`;
    case 'marcou': {
      const anterior = dataDoCampo(antes, 'data_envio');
      const nova = dataDoCampo(depois, 'data_envio') ?? '—';
      return anterior ? `envio de ${anterior} para ${nova}` : `envio em ${nova}`;
    }
    case 'desmarcou':
      return dataDoCampo(antes, 'data_envio') && `estava enviado em ${dataDoCampo(antes, 'data_envio')}`;
    case 'confirmou_aplis':
      return depois?.lote_aplis_confirmado != null ? `lote ${String(depois.lote_aplis_confirmado)}` : null;
    case 'removeu':
      return `previsto para ${dataDoCampo(antes, 'data_prevista') ?? '—'}${depois?.pela_sugestao ? ', ao regerar a sugestão' : ''}`;
  }
}

const Campo: React.FC<{ rotulo: string; children: React.ReactNode }> = ({ rotulo, children }) => (
  <div>
    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{rotulo}</dt>
    <dd className="text-sm text-gray-900 dark:text-gray-100">{children}</dd>
  </div>
);

const BOTAO = 'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl';

const DetalheAgendamentoModal: React.FC<Props> = ({
  agendamento,
  regra,
  podeGerenciar,
  onFechar,
  onMarcar,
  onDesmarcar,
  onMover,
  onRemover,
}) => {
  const { historico, error } = useHistoricoAgendamento(agendamento.id);
  const estilo = ESTILO_STATUS[agendamento.status];
  const enviado = agendamento.dataEnvio !== null;

  useEffect(() => {
    const fecharNoEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', fecharNoEsc);
    return () => window.removeEventListener('keydown', fecharNoEsc);
  }, [onFechar]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalhe-agendamento-titulo"
      >
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="detalhe-agendamento-titulo" className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              {regra?.convenio ?? 'Convênio removido'}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${estilo.pilula}`}>{estilo.nome}</span>
              {agendamento.foraDaJanela && <SeloForaDaJanela />}
              {agendamento.loteAplisConfirmado !== null && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                  confirmado no apLIS
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 p-1.5 rounded-full transition-all duration-200 hover:rotate-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto">
          {regra?.observacao && (
            <p className="text-sm rounded-xl px-3 py-2 bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800/60">
              {regra.observacao}
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Campo rotulo="Data prevista">{formatData(agendamento.dataPrevista)}</Campo>
            <Campo rotulo="Origem">
              {agendamento.origem === 'manual' ? 'Manual' : 'Sugestão'}
              {agendamento.editado && ' · editado'}
            </Campo>
            <Campo rotulo="Data de envio">{enviado ? formatData(agendamento.dataEnvio) : '—'}</Campo>
            <Campo rotulo="Marcado por">
              {agendamento.marcadoPorNome ?? (enviado && agendamento.loteAplisConfirmado !== null ? 'Confirmação automática' : '—')}
              {agendamento.marcadoEm && (
                <span className="block text-xs text-gray-500 dark:text-gray-400">{formatDataHora(agendamento.marcadoEm)}</span>
              )}
            </Campo>
            {agendamento.loteAplisConfirmado !== null && (
              <Campo rotulo="Lote do apLIS">{agendamento.loteAplisConfirmado}</Campo>
            )}
          </dl>

          {regra?.membros && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">Convênios membros</h3>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{regra.membros}</p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
              <History className="w-4 h-4" />
              Histórico
            </h3>
            {error ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : !historico ? (
              <p className="mt-2 text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Carregando…</p>
            ) : historico.length === 0 ? (
              <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">Sem registros.</p>
            ) : (
              <ol className="mt-2 space-y-2 border-l-2 border-gray-100 dark:border-gray-700 pl-3">
                {historico.map((evento, i) => {
                  const detalhe = descreverEvento(evento);
                  return (
                    <li key={i} className="text-sm">
                      <p className="text-gray-900 dark:text-gray-100">
                        <span className="font-medium">{NOME_ACAO[evento.acao]}</span>
                        {detalhe && <span className="text-gray-600 dark:text-gray-300"> {detalhe}</span>}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {evento.porNome ?? 'Sistema'} · {formatDataHora(evento.em)}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>

        {podeGerenciar && (
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl flex flex-wrap justify-between gap-2">
            <button
              onClick={onRemover}
              className={`${BOTAO} text-red-700 bg-red-50 hover:bg-red-100 dark:text-red-300 dark:bg-red-900/20 dark:hover:bg-red-900/40`}
            >
              <Trash2 className="w-4 h-4" />
              Remover
            </button>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onMover}
                className={`${BOTAO} text-blue-700 bg-blue-50 hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/20 dark:hover:bg-blue-900/40`}
              >
                <CalendarClock className="w-4 h-4" />
                Mover
              </button>
              {enviado ? (
                <button
                  onClick={onDesmarcar}
                  className={`${BOTAO} text-yellow-800 bg-yellow-50 hover:bg-yellow-100 dark:text-yellow-200 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/40`}
                >
                  <Undo2 className="w-4 h-4" />
                  Desmarcar
                </button>
              ) : (
                <button
                  onClick={onMarcar}
                  className={`${BOTAO} text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-md shadow-green-500/25`}
                >
                  <Check className="w-4 h-4" />
                  Marcar enviado
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DetalheAgendamentoModal;
