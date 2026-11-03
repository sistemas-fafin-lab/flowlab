import React, { useEffect, useState } from 'react';
import { Loader2, Save, StickyNote, Trash2, X } from 'lucide-react';
import ConfirmDialog from '../../../components/ConfirmDialog';
import DatePicker from '../../../components/DatePicker';
import { removerAtividade, salvarAtividade } from '../hooks/useCalendarioEnvios';
import type { AtividadeCalendario } from '../types';
import { formatData, formatDataHora } from '../utils/formato';

// Atividade do Calendário de envios (treinamento, reunião ou qualquer outra): só um
// lembrete num dia, com título, horário opcional e descrição. Sem status, fora dos
// Atrasados e da sugestão. `atividade` ausente cria; presente, abre para editar e
// remover. Sem canManageCalendarioEnvios (`podeGerenciar` falso) o modal só mostra.

const CAMPO =
  'w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white/70 text-slate-800 dark:bg-gray-800/80 dark:border-gray-700 dark:text-gray-100';

interface Props {
  /** Ausente: nova atividade. */
  atividade?: AtividadeCalendario;
  /** Dia sugerido para a nova atividade: o dia da grade em que se clicou. */
  dataInicial: string;
  podeGerenciar: boolean;
  onFechar: () => void;
  onAlterado: () => void;
}

const AtividadeModal: React.FC<Props> = ({ atividade, dataInicial, podeGerenciar, onFechar, onAlterado }) => {
  const [titulo, setTitulo] = useState(atividade?.titulo ?? '');
  const [data, setData] = useState(atividade?.data ?? dataInicial);
  const [horario, setHorario] = useState(atividade?.horario ?? '');
  const [descricao, setDescricao] = useState(atividade?.descricao ?? '');
  const [salvando, setSalvando] = useState(false);
  const [confirmandoRemover, setConfirmandoRemover] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const fecharNoEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !salvando && !confirmandoRemover) onFechar(); };
    window.addEventListener('keydown', fecharNoEsc);
    return () => window.removeEventListener('keydown', fecharNoEsc);
  }, [onFechar, salvando, confirmandoRemover]);

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await salvarAtividade({ id: atividade?.id ?? null, data, titulo, horario: horario || null, descricao: descricao || null });
      onAlterado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível gravar a atividade.');
      setSalvando(false);
    }
  };

  const remover = async (alvo: AtividadeCalendario) => {
    setConfirmandoRemover(false);
    setSalvando(true);
    setErro(null);
    try {
      await removerAtividade(alvo.id);
      onAlterado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível remover a atividade.');
      setSalvando(false);
    }
  };

  const tituloModal = atividade ? (podeGerenciar ? 'Editar atividade' : 'Atividade') : 'Nova atividade';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full animate-scale-in" role="dialog" aria-modal="true" aria-labelledby="atividade-titulo">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 id="atividade-titulo" className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            {tituloModal}
          </h2>
          <button
            onClick={onFechar}
            disabled={salvando}
            aria-label="Fechar"
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 p-1.5 rounded-full transition-all duration-200 hover:rotate-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {podeGerenciar ? (
          <div className="px-6 py-5 space-y-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
              Título
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={120}
                placeholder="Ex.: Treinamento TISS, Reunião com a coordenação"
                className={`mt-1 ${CAMPO}`}
                autoFocus
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                Data
                <DatePicker value={data} onChange={(v) => v && setData(v)} controlClass={`mt-1 ${CAMPO}`} />
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                Horário <span className="font-normal text-gray-400">(opcional)</span>
                <input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} className={`mt-1 ${CAMPO}`} />
              </label>
            </div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
              Descrição <span className="font-normal text-gray-400">(opcional)</span>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Local, link, quem participa…"
                className={`mt-1 ${CAMPO} resize-y`}
              />
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              A atividade é só um lembrete: não tem envio a marcar e não muda a sugestão do mês.
            </p>
            {atividade?.alteradoPorNome && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Alterada por {atividade.alteradoPorNome} em {formatDataHora(atividade.alteradoEm)}
              </p>
            )}
            {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
          </div>
        ) : (
          atividade && (
            <div className="px-6 py-5 space-y-2">
              <p className="text-base font-medium text-gray-900 dark:text-gray-100">{atividade.titulo}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {formatData(atividade.data)} · {atividade.horario ?? 'dia todo'}
              </p>
              {atividade.descricao && (
                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">{atividade.descricao}</p>
              )}
              {atividade.criadoPorNome && (
                <p className="text-xs text-gray-400 dark:text-gray-500">Lançada por {atividade.criadoPorNome}</p>
              )}
            </div>
          )
        )}

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl flex items-center justify-between gap-3">
          <div>
            {podeGerenciar && atividade && (
              <button
                onClick={() => setConfirmandoRemover(true)}
                disabled={salvando}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-xl text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4" />
                Remover
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onFechar}
              disabled={salvando}
              className="px-5 py-2.5 text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 font-medium dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              {podeGerenciar ? 'Cancelar' : 'Fechar'}
            </button>
            {podeGerenciar && (
              <button
                onClick={() => void salvar()}
                disabled={salvando || !titulo.trim() || !data}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-violet-600 text-white font-medium rounded-xl shadow-md shadow-violet-500/25 hover:from-violet-600 hover:to-violet-700 disabled:opacity-50"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </button>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={confirmandoRemover}
        title="Remover atividade"
        message={atividade && <>{atividade.titulo} sai do dia {formatData(atividade.data)}.</>}
        confirmText="Remover"
        onConfirm={() => { if (atividade) void remover(atividade); }}
        onCancel={() => setConfirmandoRemover(false)}
        type="danger"
      />
    </div>
  );
};

export default AtividadeModal;
