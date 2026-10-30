import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Loader2, X, XCircle } from 'lucide-react';
import type { AlteracaoCampo, DadosPessoais, SolicitacaoAlteracao } from '../../types';
import { formatDataBR } from '../../utils/colaboradorFormato';
import { CAMPO_DADOS_PESSOAIS_LABEL } from '../../utils/rotulosDadosPessoais';
import { formatarValorCampo } from '../../utils/solicitacaoAlteracao';

const formatHora = (iso: string): string =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** "Campo: antes → depois"; com `atuais`, avisa quando o valor mudou desde o pedido. */
const ListaAlteracoes: React.FC<{ alteracoes: AlteracaoCampo[]; atuais?: DadosPessoais }> = ({ alteracoes, atuais }) => (
  <ul className="space-y-1.5 text-sm">
    {alteracoes.map((a) => {
      const atual = atuais ? (atuais[a.campo]?.trim() || null) : undefined;
      const mudou = atuais !== undefined && atual !== a.de;
      return (
        <li key={a.campo}>
          <span className="font-medium text-gray-700 dark:text-gray-200">{CAMPO_DADOS_PESSOAIS_LABEL[a.campo]}:</span>{' '}
          <span className="text-gray-500 dark:text-gray-400 line-through decoration-gray-400/60">{formatarValorCampo(a.campo, a.de)}</span>
          <span className="mx-1.5 text-gray-400">→</span>
          <span className="font-medium text-gray-900 dark:text-white">{formatarValorCampo(a.campo, a.para)}</span>
          {mudou && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-3 h-3" />
              Valor atual mudou desde o pedido: {formatarValorCampo(a.campo, atual ?? null)}
            </span>
          )}
        </li>
      );
    })}
  </ul>
);

const botaoSecundario =
  'px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

// ─── RH: decidir ─────────────────────────────────────────────────────────────

interface SolicitacaoPendenteRHProps {
  solicitacao: SolicitacaoAlteracao;
  colaboradorNome: string;
  /** Dados atuais, para o alerta de "valor atual mudou". */
  atuais: DadosPessoais;
  /** canManageColaboradores: sem ela, o banner aparece sem ações. */
  podeDecidir: boolean;
  /** Outra edição em andamento na ficha. */
  bloqueado: boolean;
  onDecidir: (aprovar: boolean, motivo?: string) => Promise<void>;
}

export const SolicitacaoPendenteRH: React.FC<SolicitacaoPendenteRHProps> = ({
  solicitacao,
  colaboradorNome,
  atuais,
  podeDecidir,
  bloqueado,
  onDecidir,
}) => {
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState<'aprovar' | 'recusar' | null>(null);

  const decidir = async (aprovar: boolean) => {
    setEnviando(aprovar ? 'aprovar' : 'recusar');
    await onDecidir(aprovar, aprovar ? undefined : motivo);
    setEnviando(null);
  };

  return (
    <div className="mb-5 rounded-2xl border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 p-4">
      <div className="flex items-start gap-3">
        <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-100">Solicitação de alteração pendente</p>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
              Enviada por {colaboradorNome} em {formatDataBR(solicitacao.createdAt)} às {formatHora(solicitacao.createdAt)}
            </p>
          </div>
          <ListaAlteracoes alteracoes={solicitacao.alteracoes} atuais={atuais} />

          {podeDecidir &&
            (recusando ? (
              <div className="space-y-2">
                <label htmlFor="motivo-recusa" className="block text-xs font-medium text-gray-600 dark:text-gray-300">
                  Motivo da recusa (opcional, enviado ao colaborador)
                </label>
                <textarea
                  id="motivo-recusa"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  maxLength={500}
                  rows={2}
                  disabled={enviando !== null}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => setRecusando(false)} disabled={enviando !== null} className={botaoSecundario}>
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => decidir(false)}
                    disabled={enviando !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {enviando === 'recusar' && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirmar recusa
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRecusando(true)}
                  disabled={bloqueado || enviando !== null}
                  title={bloqueado ? 'Conclua a edição em andamento antes' : undefined}
                  className={botaoSecundario}
                >
                  Recusar
                </button>
                <button
                  type="button"
                  onClick={() => decidir(true)}
                  disabled={bloqueado || enviando !== null}
                  title={bloqueado ? 'Conclua a edição em andamento antes' : undefined}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {enviando === 'aprovar' && <Loader2 className="w-4 h-4 animate-spin" />}
                  Aprovar alteração
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

// ─── Colaborador: acompanhar ─────────────────────────────────────────────────

interface SolicitacaoEmAnaliseProps {
  solicitacao: SolicitacaoAlteracao;
  onCancelar: () => Promise<void>;
}

export const SolicitacaoEmAnalise: React.FC<SolicitacaoEmAnaliseProps> = ({ solicitacao, onCancelar }) => {
  const [cancelando, setCancelando] = useState(false);

  const cancelar = async () => {
    setCancelando(true);
    await onCancelar();
    setCancelando(false);
  };

  return (
    <div className="mb-5 rounded-2xl border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 p-4">
      <div className="flex items-start gap-3">
        <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-100">Alteração em análise pelo RH</p>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/80">Enviada em {formatDataBR(solicitacao.createdAt)}</p>
          </div>
          <ListaAlteracoes alteracoes={solicitacao.alteracoes} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-amber-800/80 dark:text-amber-200/80">Os dados atuais continuam valendo até a aprovação.</p>
            <button type="button" onClick={cancelar} disabled={cancelando} className={botaoSecundario}>
              {cancelando ? 'Cancelando...' : 'Cancelar solicitação'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SolicitacaoResultadoProps {
  solicitacao: SolicitacaoAlteracao;
  onDispensar: () => void;
}

export const SolicitacaoResultado: React.FC<SolicitacaoResultadoProps> = ({ solicitacao, onDispensar }) => {
  const aprovada = solicitacao.status === 'aprovada';
  const data = solicitacao.decididoEm ? formatDataBR(solicitacao.decididoEm) : null;
  const Icone = aprovada ? CheckCircle2 : XCircle;

  return (
    <div
      className={`mb-5 rounded-2xl border p-4 flex items-start gap-3 ${
        aprovada
          ? 'border-emerald-200 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-900/20'
          : 'border-red-200 dark:border-red-700/60 bg-red-50 dark:bg-red-900/20'
      }`}
    >
      <Icone className={`w-5 h-5 flex-shrink-0 mt-0.5 ${aprovada ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} />
      <div className="min-w-0 flex-1 text-sm">
        <p className={`font-semibold ${aprovada ? 'text-emerald-900 dark:text-emerald-100' : 'text-red-900 dark:text-red-100'}`}>
          {aprovada ? 'Alteração aprovada pelo RH' : 'Alteração recusada pelo RH'}
        </p>
        <p className="text-gray-600 dark:text-gray-300">
          {aprovada ? `Seus dados foram atualizados em ${data}.` : `Sua solicitação foi analisada em ${data}.`}
        </p>
        {!aprovada && solicitacao.motivoRecusa && (
          <p className="mt-1 text-gray-700 dark:text-gray-200">Motivo: {solicitacao.motivoRecusa}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDispensar}
        title="Dispensar"
        aria-label="Dispensar aviso"
        className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
